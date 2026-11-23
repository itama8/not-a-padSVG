import { DurableObject } from 'cloudflare:workers';

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
  }

  fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const { clicks } = this.sql.exec('SELECT clicks FROM counter WHERE id = 1').one();
    server.send(String(clicks));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    if (message !== 'click') {
      socket.close(1008, 'Expected click');
      return;
    }
    const { clicks } = this.sql.exec('UPDATE counter SET clicks = clicks + 1 WHERE id = 1 RETURNING clicks').one();
    for (const peer of this.ctx.getWebSockets()) {
      if (peer.readyState === WebSocket.OPEN) peer.send(String(clicks));
    }
  }
}
