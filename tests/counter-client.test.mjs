import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const treatment = (await readFile(new URL('../site/ui/want-counter/treatment.js', import.meta.url), 'utf8')).replace('export function', 'function');
const client = (await readFile(new URL('../site/want.js', import.meta.url), 'utf8')).replace(/^import .*;\n/, '');

class Element {
  constructor(text = '') { this.textContent = text; this.style = {}; this.dataset = {}; this.attrs = {}; this.children = []; this.events = {}; }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  append(child) { this.children.push(child); }
  addEventListener(name, fn) { this.events[name] = fn; }
  getComputedTextLength() { return this.textContent.length * 40; }
}

async function fixture() {
  const nodes = Object.fromEntries(['want', 'want-label', 'want-underline', 'want-count', 'want-total', 'want-status'].map(id => [id, new Element()]));
  nodes['want-count'].textContent = '—';
  const svg = new Element();
  nodes.want.querySelector = selector => selector === 'svg' ? svg : selector === '[data-counter-message]' ? svg.children[0] : nodes[selector.slice(1)];
  let socket;
  class Socket {
    static OPEN = 1;
    constructor() { this.events = {}; this.readyState = 1; this.sent = []; socket = this; }
    addEventListener(name, fn) { this.events[name] = fn; }
    send(value) { this.sent.push(value); }
    snapshot(value) { this.events.message({ data: JSON.stringify(value) }); }
  }
  const context = vm.createContext({
    document: { querySelector: selector => nodes[selector.slice(1)], createElementNS: () => new Element(), addEventListener() {} },
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    location: { hostname: 'localhost', host: 'localhost' }, window: {}, Intl, URL,
    crypto, localStorage: { getItem() { return null; }, setItem() {} },
    fetch: async () => ({ ok: true, json: async () => ({ token: 'signed-session', expires: Date.now() + 86400_000 }) }),
    WebSocket: Socket, setTimeout: () => 1, clearTimeout() {}, addEventListener() {},
    getComputedStyle: () => ({ fontSize: '78' }),
  });
  vm.runInContext(treatment + '\n' + client, context);
  await new Promise(resolve => setImmediate(resolve));
  return { nodes, svg, socket };
}

test('optimistic enthusiasm switches to a smaller red total, with correct receipts and accessible text', async () => {
  const { nodes, svg, socket } = await fixture();
  socket.snapshot({ total: 1000, accepted: 0, diverted: false });
  for (let i = 0; i < 10; i++) nodes.want.events.click();
  assert.equal(nodes['want-count'].textContent, '1,010');
  socket.snapshot({ total: 3, accepted: 10, diverted: true });
  assert.equal(nodes['want-count'].textContent, '3');
  assert.equal(nodes['want-count'].style.fill, '#c52d35');
  assert.equal(nodes.want.attrs['aria-label'], 'nice try, thanks a lot :)');
  assert.equal(nodes['want-total'].textContent, '3 diverted clicks');
  assert.deepEqual(svg.children[0].children.map(child => child.textContent), ['nice try,', 'thanks a lot :)']);
  nodes.want.events.click();
  assert.equal(nodes['want-count'].textContent, '4');
  socket.snapshot({ total: 4, accepted: 11, diverted: true });
  assert.equal(nodes['want-count'].textContent, '4');
  // Flag expiry returns the visitor to the regular counter without losing receipt progress.
  socket.snapshot({ total: 1000, accepted: 11, diverted: false });
  assert.equal(nodes['want-count'].textContent, '1,000');
  assert.equal(nodes['want-count'].style.fill, '');
  assert.equal(nodes.want.attrs['aria-label'], 'I WANT THIS');
});

test('a delayed batch can be larger than the diverted total; pending clicks remain visible', async () => {
  const { nodes, socket } = await fixture();
  socket.snapshot({ total: 800, accepted: 0, diverted: false });
  for (let i = 0; i < 120; i++) nodes.want.events.click();
  socket.snapshot({ total: 100, accepted: 100, diverted: true });
  assert.equal(nodes['want-count'].textContent, '120');
  socket.snapshot({ total: 120, accepted: 120, diverted: true });
  assert.equal(nodes['want-count'].textContent, '120');
});
