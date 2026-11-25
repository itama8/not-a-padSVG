import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { BUDGETS, FLAG_TTL, SESSION_TTL, spend } from '../counter/policy.mjs';

// Exercise the real Worker against SQLite; only Cloudflare's host/socket APIs are stand-ins.
const source = (await readFile(new URL('../counter/worker.mjs', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx) { this.ctx = ctx; } }')
  .replace("'./policy.mjs'", JSON.stringify(new URL('../counter/policy.mjs', import.meta.url).href));
const { WantCounter, default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function fixture() {
  const db = new DatabaseSync(':memory:');
  const sockets = [];
  const ctx = {
    storage: {
      sql: { exec(query, ...bindings) {
        const statement = db.prepare(query);
        const rows = statement.columns().length ? statement.all(...bindings) : (statement.run(...bindings), []);
        return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
      } },
      transactionSync(fn) {
        db.exec('BEGIN');
        try { const value = fn(); db.exec('COMMIT'); return value; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    },
    getWebSockets: () => sockets,
  };
  let counter = new WantCounter(ctx, {});
  const session = (id = crypto.randomUUID(), ip = 'hashed-ip') => ({ id, ip, client: id + ':' + crypto.randomUUID(), expires: Date.now() + SESSION_TTL });
  const socket = (identity = session()) => {
    const peer = { readyState: 1, messages: [], deserializeAttachment: () => identity,
      send(data) { this.messages.push(JSON.parse(data)); }, close(code) { this.closed = code; this.readyState = 3; } };
    sockets.push(peer);
    return peer;
  };
  globalThis.WebSocket = { OPEN: 1 };
  return { db, ctx, session, socket, get counter() { return counter; },
    restart() { counter = new WantCounter(ctx, {}); },
    total(id) { return Number(db.prepare('SELECT clicks FROM counter WHERE id = ?').get(id).clicks); } };
}

test('budgets allow human bursts, refill, and retain a flag for 24 hours', () => {
  let state = spend(null, 100, 0, BUDGETS.session);
  assert.equal(state.flaggedUntil, 0);
  state = spend(state, 20, 0, BUDGETS.session);
  state = spend(state, 12, 1000, BUDGETS.session);
  assert.equal(state.flaggedUntil, 0);
  state = spend(state, 1, 1000, BUDGETS.session);
  assert.equal(state.flaggedUntil, 1000 + FLAG_TTL);
  assert.ok(spend(state, 1, 60_000, BUDGETS.session).flaggedUntil > 60_000);
  assert.equal(spend(state, 1, 1001 + FLAG_TTL, BUDGETS.session).flaggedUntil, 0);
});

test('threshold batch and subsequent clicks divert; retries and restart preserve totals', () => {
  const f = fixture(), peer = f.socket(), normal = f.socket(f.session(undefined, 'other-ip'));
  f.counter.webSocketMessage(peer, '100');
  assert.equal(f.total(1), 100);
  f.counter.webSocketMessage(peer, '200');
  assert.equal(f.total(1), 100);
  assert.equal(f.total(2), 100);
  assert.equal(peer.messages.at(-1).diverted, true);
  assert.equal(normal.messages.at(-1).diverted, false);
  f.counter.webSocketMessage(peer, '200');
  assert.equal(f.total(2), 100);
  f.restart();
  const reconnect = f.socket(peer.deserializeAttachment());
  f.counter.webSocketMessage(reconnect, '201');
  assert.equal(f.total(2), 101);
  assert.equal(reconnect.messages.at(-1).accepted, 201);
  assert.equal(reconnect.messages.at(-1).total, 101);
  f.db.close();
});

test('tabs share session budgets; rotating sessions still shares the IP budget', () => {
  const f = fixture(), id = crypto.randomUUID();
  f.counter.webSocketMessage(f.socket(f.session(id)), '100');
  const tab = f.socket(f.session(id));
  f.counter.webSocketMessage(tab, '100');
  assert.equal(tab.messages.at(-1).diverted, true);
  for (let i = 0; i < 5; i++) f.counter.webSocketMessage(f.socket(), '100');
  assert.equal(f.total(1), 500);
  assert.equal(f.total(2), 200);
  const fresh = f.socket();
  f.counter.snapshot(fresh);
  assert.equal(fresh.messages.at(-1).diverted, true);
  f.db.close();
});

test('legacy messages, oversized batches and expired sessions cannot increment either total', () => {
  const f = fixture();
  for (const message of ['click', '101', '-1', '1e2', '9007199254740992', new ArrayBuffer(1)]) {
    const peer = f.socket();
    f.counter.webSocketMessage(peer, message);
    assert.equal(peer.closed, 1008);
  }
  const peer = f.socket({ ...f.session(), expires: 0 });
  f.counter.webSocketMessage(peer, '1');
  assert.equal(peer.closed, 1008);
  assert.equal(f.total(1) + f.total(2), 0);
  f.db.close();
});

test('signed sessions survive restart; tampering, wrong IP and unsigned connections fail', async () => {
  const f = fixture();
  const headers = { 'CF-Connecting-IP': '192.0.2.1' };
  const response = await f.counter.fetch(new Request('https://counter.test/api/want/session', { method: 'POST', headers }));
  const { token } = await response.json();
  const [body, signature] = token.split('.');
  assert.equal(signature, await f.counter.sign(body));
  f.restart();
  assert.equal(signature, await f.counter.sign(body));
  for (const [value, ip] of [[token.slice(0, -1) + (token.endsWith('0') ? '1' : '0'), '192.0.2.1'], [token, '192.0.2.2'], ['', '192.0.2.1']]) {
    const request = new Request('https://counter.test/api/want?client=' + crypto.randomUUID() + '&session=' + encodeURIComponent(value), { headers: { 'CF-Connecting-IP': ip } });
    assert.equal((await f.counter.fetch(request)).status, 401);
  }
  f.db.close();
});

test('session endpoint allows the configured site and rejects other origins', async () => {
  const env = { SITE_ORIGIN: 'https://site.test', WANT_COUNTER: { getByName: () => ({ fetch: async () => Response.json({ token: 'example' }) }) } };
  const response = await worker.fetch(new Request('https://counter.test/api/want/session', { method: 'POST', headers: { Origin: env.SITE_ORIGIN } }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), env.SITE_ORIGIN);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await worker.fetch(new Request('https://counter.test/api/want/session', { method: 'POST', headers: { Origin: 'https://other.test' } }), env)).status, 403);
});
