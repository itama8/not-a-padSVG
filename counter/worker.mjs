import { DurableObject } from 'cloudflare:workers';

const MAX_BATCH = 100;
const CLIENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/want') return new Response('Not found', { status: 404 });
    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket required', { status: 426 });
    }
    const origin = request.headers.get('Origin');
    if (origin !== url.origin && origin !== env.SITE_ORIGIN) {
      return new Response('Origin forbidden', { status: 403 });
    }
    return env.WANT_COUNTER.getByName('not-padgtp').fetch(request);
  },
};

export class WantCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, clicks INTEGER NOT NULL)');
    this.sql.exec('INSERT OR IGNORE INTO counter (id, clicks) VALUES (1, 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS counter_clients (client TEXT PRIMARY KEY, accepted INTEGER NOT NULL)');
  }

  accepted(client) {
    return this.sql.exec('SELECT accepted FROM counter_clients WHERE client = ?', client).toArray()[0]?.accepted ?? 0;
  }

  snapshot(socket, total) {
    const client = socket.deserializeAttachment();
    socket.send(client ? JSON.stringify({ total, accepted: this.accepted(client) }) : String(total));
  }

  fetch(request) {
    const id = new URL(request.url).searchParams.get('client');
    if (id !== null && !CLIENT_ID.test(id)) return new Response('Invalid client ID', { status: 400 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    if (id) server.serializeAttachment(id);
    const { clicks } = this.sql.exec('SELECT clicks FROM counter WHERE id = 1').one();
    this.snapshot(server, clicks);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    const client = socket.deserializeAttachment();
    let delta = 1;
    let total;
    if (client) {
      if (typeof message !== 'string' || !/^\d{1,16}$/.test(message) || !Number.isSafeInteger(Number(message))) {
        socket.close(1008, 'Invalid click sequence');
        return;
      }
      const through = Number(message);
      const accepted = this.accepted(client);
      delta = through - accepted;
      if (delta > MAX_BATCH) {
        socket.close(1008, 'Click batch too large');
        return;
      }
      if (delta <= 0) {
        const { clicks } = this.sql.exec('SELECT clicks FROM counter WHERE id = 1').one();
        this.snapshot(socket, clicks);
        return;
      }
      total = this.ctx.storage.transactionSync(() => {
        this.sql.exec(`INSERT INTO counter_clients (client, accepted) VALUES (?, ?)
          ON CONFLICT(client) DO UPDATE SET accepted = excluded.accepted`, client, through);
        return this.sql.exec('UPDATE counter SET clicks = clicks + ? WHERE id = 1 RETURNING clicks', delta).one().clicks;
      });
    } else {
      if (message !== 'click') {
        socket.close(1008, 'Expected click');
        return;
      }
      total = this.sql.exec('UPDATE counter SET clicks = clicks + 1 WHERE id = 1 RETURNING clicks').one().clicks;
    }
    for (const peer of this.ctx.getWebSockets()) {
      if (peer.readyState === WebSocket.OPEN) this.snapshot(peer, total);
    }
  }

  webSocketClose(socket) {
    socket.close();
  }
}
