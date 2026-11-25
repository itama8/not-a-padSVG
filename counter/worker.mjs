import { DurableObject } from 'cloudflare:workers';
import { BUDGETS, SESSION_TTL, spend } from './policy.mjs';

const MAX_BATCH = 100;
const CLIENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['/api/want', '/api/want/session'].includes(url.pathname)) return new Response('Not found', { status: 404 });
    const origin = request.headers.get('Origin');
    if (origin !== url.origin && origin !== env.SITE_ORIGIN) return new Response('Origin forbidden', { status: 403 });
    if (url.pathname === '/api/want/session') {
      if (request.method !== 'POST') return new Response('POST required', { status: 405 });
      const response = await env.WANT_COUNTER.getByName('not-padgtp').fetch(request);
      return new Response(response.body, { status: response.status, headers: {
        'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
      } });
    }
    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket required', { status: 426 });
    }
    return env.WANT_COUNTER.getByName('not-padgtp').fetch(request);
  },
};

export class WantCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, clicks INTEGER NOT NULL)');
    this.sql.exec('INSERT OR IGNORE INTO counter (id, clicks) VALUES (1, 0), (2, 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS counter_clients (client TEXT PRIMARY KEY, accepted INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS counter_budget (scope TEXT PRIMARY KEY, state TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS counter_secret (id INTEGER PRIMARY KEY, secret TEXT NOT NULL)');
    this.sql.exec('INSERT OR IGNORE INTO counter_secret VALUES (1, ?)', hex(crypto.getRandomValues(new Uint8Array(32))));
    const { secret } = this.sql.exec('SELECT secret FROM counter_secret WHERE id = 1').one();
    this.key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  }

  async sign(value) {
    return hex(await crypto.subtle.sign('HMAC', await this.key, encoder.encode(value)));
  }

  budget(scope) {
    const row = this.sql.exec('SELECT state FROM counter_budget WHERE scope = ?', scope).toArray()[0];
    return row ? JSON.parse(row.state) : null;
  }

  flagged(session, now = Date.now()) {
    return ['session:' + session.id, 'ip:' + session.ip].some(scope => (this.budget(scope)?.flaggedUntil ?? 0) > now);
  }

  accepted(client) {
    return this.sql.exec('SELECT accepted FROM counter_clients WHERE client = ?', client).toArray()[0]?.accepted ?? 0;
  }

  snapshot(socket) {
    const session = socket.deserializeAttachment();
    if (!session || typeof session !== 'object') { socket.close(1008, 'Session required'); return; }
    const diverted = this.flagged(session);
    const { clicks } = this.sql.exec('SELECT clicks FROM counter WHERE id = ?', diverted ? 2 : 1).one();
    socket.send(JSON.stringify({ total: clicks, accepted: this.accepted(session.client), diverted }));
  }

  async fetch(request) {
    const url = new URL(request.url);
    // Only Cloudflare's connecting-IP header is used; the raw address is never stored.
    const ip = await this.sign('ip:' + (request.headers.get('CF-Connecting-IP') || 'local'));
    if (url.pathname === '/api/want/session') {
      const payload = { id: crypto.randomUUID(), ip, expires: Date.now() + SESSION_TTL };
      const body = btoa(JSON.stringify(payload));
      return Response.json({ token: body + '.' + await this.sign(body), expires: payload.expires });
    }
    const token = url.searchParams.get('session') || '';
    const [body, signature] = token.split('.');
    let session;
    try {
      if (!/^[0-9a-f]{64}$/.test(signature) || token.split('.').length !== 2) throw new Error();
      const bytes = Uint8Array.from(signature.match(/../g), byte => parseInt(byte, 16));
      if (!await crypto.subtle.verify('HMAC', await this.key, bytes, encoder.encode(body))) throw new Error();
      session = JSON.parse(atob(body));
      if (!CLIENT_ID.test(session.id) || session.ip !== ip || session.expires <= Date.now()) throw new Error();
    } catch (_) { return new Response('Session required', { status: 401 }); }
    const id = url.searchParams.get('client');
    if (!CLIENT_ID.test(id ?? '')) return new Response('Client ID required', { status: 400 });
    session.client = session.id + ':' + id;
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(session);
    this.snapshot(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    const session = socket.deserializeAttachment();
    if (!session || typeof session !== 'object' || session.expires <= Date.now()) { socket.close(1008, 'Session expired'); return; }
    if (typeof message !== 'string' || !/^\d{1,16}$/.test(message) || !Number.isSafeInteger(Number(message))) {
      socket.close(1008, 'Invalid click sequence'); return;
    }
    const through = Number(message);
    const delta = through - this.accepted(session.client);
    if (delta > MAX_BATCH) { socket.close(1008, 'Click batch too large'); return; }
    if (delta <= 0) { this.snapshot(socket); return; }
    this.ctx.storage.transactionSync(() => {
      const now = Date.now();
      let diverted = false;
      for (const [kind, value] of [['session', session.id], ['ip', session.ip]]) {
        const scope = kind + ':' + value;
        const state = spend(this.budget(scope), delta, now, BUDGETS[kind]);
        diverted ||= state.flaggedUntil > now;
        this.sql.exec('INSERT INTO counter_budget VALUES (?, ?) ON CONFLICT(scope) DO UPDATE SET state = excluded.state', scope, JSON.stringify(state));
      }
      this.sql.exec(`INSERT INTO counter_clients (client, accepted) VALUES (?, ?)
        ON CONFLICT(client) DO UPDATE SET accepted = excluded.accepted`, session.client, through);
      this.sql.exec('UPDATE counter SET clicks = clicks + ? WHERE id = ?', delta, diverted ? 2 : 1);
    });
    for (const peer of this.ctx.getWebSockets()) {
      if (peer.readyState === WebSocket.OPEN) {
        try { this.snapshot(peer); } catch (_) { peer.close(1011, 'Snapshot failed'); }
      }
    }
  }

  webSocketClose(socket) { socket.close(); }
}
