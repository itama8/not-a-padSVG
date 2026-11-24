import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

// Run with node --test tests/phone-keyboard-touch.test.mjs and Chromium on PATH.
const chromium = process.env.CHROMIUM || 'chromium';
const chromiumAvailable = spawnSync(chromium, ['--version']).status === 0;
const site = new URL('../site/', import.meta.url);
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.css': 'text/css' };

async function until(probe) {
  for (let tries = 0; tries < 100; tries++) {
    const value = await probe();
    if (value) return value;
    await delay(25);
  }
  assert.fail('Chromium or the keyboard lab did not become ready');
}

test('phone keyboard commits each valid Chromium touch release once', {
  skip: !chromiumAvailable && 'Chromium is unavailable',
}, async () => {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const type = contentTypes[extname(path)];
    try {
      if (type) {
        const file = await readFile(new URL('.' + path, site));
        response.writeHead(200, { 'Content-Type': type }).end(file);
        return;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    response.writeHead(404).end();
  });
  const profile = await mkdtemp(join(tmpdir(), 'not-padgtp-touch-'));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  // The legacy CDP touch path supports lifting a single contact by ID.
  const browser = spawn(chromium, [
    '--headless', '--no-first-run', '--disable-background-networking',
    '--disable-features=SyntheticPointerActions', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore' });
  let browserError;
  browser.on('error', error => { browserError = error; });
  let socket;
  try {
    const port = await until(async () => {
      if (browserError) throw browserError;
      assert.equal(browser.exitCode, null, 'Chromium exited before opening DevTools');
      return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n')[0];
    });
    const tabs = await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json());
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });

    const pending = new Map();
    let nextId = 0;
    socket.onmessage = ({ data }) => {
      const { id, result, error } = JSON.parse(data);
      if (!pending.has(id)) return;
      const { resolve, reject } = pending.get(id);
      pending.delete(id);
      if (error) reject(new Error(error.message));
      else resolve(result);
    };
    socket.onclose = () => {
      for (const { reject } of pending.values()) reject(new Error('Chromium DevTools disconnected'));
      pending.clear();
    };
    const send = (method, params) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const { result, exceptionDetails } = await send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
      });
      assert.equal(exceptionDetails, undefined, result.description);
      return result.value;
    };
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await send('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/lab/keyboard-motion.html' });
    await until(() => evaluate("document.querySelector('#launcher')?.disabled === false"));
    await evaluate([
      "document.querySelector('#launcher').click()",
      "window.keyboard = document.querySelector('#phone-keyboard').shadowRoot",
      "window.key = id => keyboard.querySelector('button[data-key=\"' + id + '\"]')",
      "window.field = keyboard.querySelector('textarea')",
      "window.releases = []",
      "keyboard.addEventListener('pointerup', event => releases.push([event.isTrusted, event.pointerType]))",
    ].join('\n'));

    const point = async (key, id) => {
      const { x, y, width, height } = await evaluate("window.key('" + key + "').getBoundingClientRect().toJSON()");
      return { x: x + width / 2, y: y + height / 2, id };
    };
    const touch = (type, ...touchPoints) => send('Input.dispatchTouchEvent', { type, touchPoints });
    const down = p => touch('touchStart', p);
    const up = p => touch('touchEnd', p);
    const move = p => touch('touchMove', p);
    const tap = async p => { await down(p); await up(p); };
    const value = () => evaluate('field.value');
    const clear = () => evaluate("field.value = ''");
    const pressed = () => evaluate("[...keyboard.querySelectorAll('[data-down]')].map(cap => cap.dataset.key)");
    const a = await point('KeyA', 1);
    const s = await point('KeyS', 2);

    for (let i = 0; i < 6; i++) {
      await tap(a);
      await tap(s);
    }
    assert.equal(await value(), 'as'.repeat(6));

    for (const [first, second, expected] of [[a, s, 'as'], [s, a, 'sa']]) {
      await clear();
      await evaluate('releases.length = 0');
      for (let i = 0; i < 6; i++) {
        await down(a);
        await delay(25);
        await down(s);
        assert.deepEqual(await pressed(), ['KeyA', 'KeyS']);
        assert.equal(await evaluate("keyboard.querySelector('.key-preview').textContent"), 's');
        await up(first);
        assert.equal(await value(), expected.repeat(i) + expected[0]);
        await up(second);
        assert.deepEqual(await pressed(), []);
      }
      assert.equal(await value(), expected.repeat(6));
      assert.deepEqual(await evaluate('releases'), Array.from({ length: 12 }, () => [true, 'touch']));
    }

    await clear();
    const otherA = { ...a, x: a.x + 4, id: 2 };
    await down(a);
    await down(otherA);
    await up(a);
    assert.deepEqual(await pressed(), ['KeyA']);
    await up(otherA);
    assert.equal(await value(), 'aa');

    await clear();
    await down(a);
    await touch('touchCancel');
    assert.deepEqual(await pressed(), []);
    await down(a);
    await down(s);
    await move({ ...a, y: a.y - 55 });
    await move(a);
    await up(a);
    await up(s);
    assert.equal(await value(), 's');

    const edge = await evaluate("key('KeyA').getBoundingClientRect().right + 4");
    await down(a);
    await move({ ...a, x: edge });
    await up({ ...a, x: edge });
    assert.equal(await value(), 'sa');
    await evaluate([
      "key('KeyA').dispatchEvent(new PointerEvent('click', { pointerType: 'touch', detail: 1 }))",
      "key('KeyA').dispatchEvent(new MouseEvent('click', { detail: 1 }))",
    ].join('\n'));
    assert.equal(await value(), 'sa');

    await evaluate("field.setSelectionRange(0, 1)");
    await tap(a);
    assert.equal(await value(), 'aa');
    assert.deepEqual(await evaluate('[field.selectionStart, field.selectionEnd]'), [1, 1]);
    await evaluate("key('KeyS').focus()");
    const space = { key: ' ', code: 'Space', windowsVirtualKeyCode: 32 };
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...space });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...space });
    assert.equal(await value(), 'asa');
    await evaluate("key('KeyS').click()");
    assert.equal(await value(), 'assa');

    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    const mouse = { x: a.x, y: a.y, button: 'left', clickCount: 1 };
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mouse });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mouse });
    assert.equal(await value(), 'assaa');

    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const e = await point('KeyE', 1);
    await down(e);
    await until(async () => (await value()) === 'assa3a');
    await move({ ...e, y: e.y - 55 });
    await up(e);
    assert.equal(await value(), 'assa3a');

    const backspace = await point('Backspace', 1);
    const draft = 'abcdefghijklmnop';
    await evaluate("field.value = '" + draft + "'");
    await tap(backspace);
    assert.equal(await value(), draft.slice(0, -1));

    await down(backspace);
    await until(async () => (await value()).length <= 12);
    await up(backspace);
    const released = await value();
    await delay(160);
    assert.equal(await value(), released);

    await down(backspace);
    await until(async () => (await value()).length < released.length);
    await touch('touchCancel');
    const cancelled = await value();
    await delay(160);
    assert.equal(await value(), cancelled);

    await evaluate("field.value = 'first'");
    await tap(await point('Enter', 1));
    await tap(a);
    assert.equal(await value(), 'first\na');
    const origin = 'http://127.0.0.1:' + server.address().port;
    const actionPoint = async selector => {
      const { x, y, width, height } = await evaluate(
        "keyboard.querySelector('" + selector + "').getBoundingClientRect().toJSON()");
      return { x: x + width / 2, y: y + height / 2, id: 1 };
    };
    const open = () => evaluate("keyboard.querySelector('.panel').hasAttribute('data-open')");
    const launch = () => evaluate("document.querySelector('#launcher').click()");
    await launch();
    assert.equal(await open(), true);
    await tap(await actionPoint('.close'));
    assert.equal(await open(), false);
    assert.equal(await value(), 'first\na');
    assert.equal(await evaluate("document.activeElement.id"), 'launcher');
    await launch();
    await tap(await actionPoint('.send'));
    await until(async () => !await open());
    assert.equal(await value(), '');
    await send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
    assert.equal(await evaluate('navigator.clipboard.readText()'), 'first\na');
  } finally {
    socket?.close();
    if (browser.pid && browser.exitCode === null && browser.signalCode === null) {
      const exited = once(browser, 'exit');
      browser.kill();
      await exited;
    }
    server.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});
