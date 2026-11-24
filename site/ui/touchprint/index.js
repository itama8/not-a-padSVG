import { touchprintArtwork } from './artwork.js';

const LEAVE_MS = 300;
const MIN_VISIBLE_MS = 720;

const styles = `
  :host {
    position: fixed; inset: 0; z-index: 2147483647;
    pointer-events: none; font: 0/0 sans-serif;
  }
  .field { position: absolute; inset: 0; overflow: visible; }
  .spot {
    position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible;
    opacity: 1; scale: 1;
    transition: opacity ${LEAVE_MS}ms ease-out var(--tp-out-delay, 0ms),
                scale ${LEAVE_MS}ms ease-out var(--tp-out-delay, 0ms);
    will-change: opacity, scale;
  }
  .spot.out { opacity: 0; scale: 1.07; }
  .tp {
    display: block; width: 100%; height: 100%; overflow: visible;
    color: var(--touchprint-ink, var(--blue, #1978cf));
    transform-origin: 50% 50%;
    animation: tp-land 260ms cubic-bezier(.2, .85, .3, 1.15) both;
  }
  .tp svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .echo, .ridge {
    fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round;
  }
  .echo {
    stroke-width: 1.5; opacity: 0;
    transform-box: fill-box; transform-origin: center;
    animation: tp-echo 720ms cubic-bezier(.16, .8, .3, 1) both;
  }
  .ridge {
    stroke-width: 1.5; stroke-dasharray: 1 2; stroke-dashoffset: 1.02;
    animation: tp-ink var(--dur, 240ms) cubic-bezier(.55, .05, .35, 1) both;
    animation-delay: calc(var(--i) * 22ms);
  }
  .core {
    fill: currentColor;
    transform-box: fill-box; transform-origin: center;
    animation: tp-core 660ms cubic-bezier(.2, .9, .25, 1.3) both;
  }
  .no-echo .echo { display: none; }
  @keyframes tp-land { from { transform: scale(.72); } to { transform: none; } }
  @keyframes tp-core {
    0% { opacity: 0; transform: scale(0); }
    12% { opacity: 1; transform: scale(1); }
    30%, 62% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(.9); }
  }
  @keyframes tp-ink { to { stroke-dashoffset: 0; } }
  @keyframes tp-echo {
    0% { opacity: 0; transform: scale(.5); }
    20% { opacity: .22; }
    100% { opacity: 0; transform: scale(1.45); }
  }
  @media (prefers-color-scheme: dark) {
    .tp { color: var(--touchprint-ink, var(--blue, #5ea9f4)); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tp, .core, .ridge, .echo { animation: none; }
    .ridge { stroke-dashoffset: 0; }
    .echo, .core { display: none; }
    .spot { transition-duration: 180ms; }
  }
  @media (forced-colors: active) {
    .tp { color: CanvasText; }
  }
`;

/**
 * @typedef {Object} TouchprintOptions
 * @property {number} [size=60] Box size in CSS pixels; the print fills about 79% of it.
 * @property {number} [linger=320] Time after release before the print fades.
 * @property {boolean} [mouse=true] Show a print for mouse presses.
 * @property {boolean} [echo=true] Radiate a copy of the print on contact.
 * @property {boolean} [enabled=true] Start with prints on. Use the controller's setEnabled() to change it.
 * @property {string} [ink] Print colour. Also settable with --touchprint-ink.
 */

/** Mount one fixed overlay that marks contact points on `host`.
 * The layer passes pointer events through, so the host's controls still work.
 * @param {Element} [host]
 * @param {TouchprintOptions} [options]
 */
export function mountTouchprints(host = document.body, options = {}) {
  if (!host) throw new Error('mountTouchprints needs a host element.');

  const size = Math.max(24, Number(options.size) || 60);
  const linger = Number.isFinite(Number(options.linger)) ? Math.max(0, Number(options.linger)) : 320;
  const showMouse = options.mouse !== false;
  const echo = options.echo !== false;
  let enabled = options.enabled !== false;

  const layer = document.createElement('div');
  layer.className = 'touchprint-layer';
  layer.setAttribute('aria-hidden', 'true');
  if (options.ink) layer.style.setProperty('--touchprint-ink', options.ink);
  document.body.append(layer);

  const root = layer.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${styles}</style><div class="field"></div>`;
  const field = root.querySelector('.field');

  const active = new Map();
  const records = new Set();
  const timers = new Set();
  let sequence = 0;

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function place(spot, x, y) {
    spot.style.left = `${x - size / 2}px`;
    spot.style.top = `${y - size / 2}px`;
  }

  function spawn(key, x, y) {
    const spot = document.createElement('div');
    spot.className = 'spot';
    spot.style.width = spot.style.height = `${size}px`;
    place(spot, x, y);
    spot.innerHTML = `<div class="tp${echo ? '' : ' no-echo'}"><svg viewBox="0 0 24 24" aria-hidden="true">${touchprintArtwork}</svg></div>`;
    field.append(spot);
    const record = { key, spot, started: performance.now(), released: false, timer: null };
    active.set(key, record);
    records.add(record);
    return record;
  }

  function release(record) {
    if (!record || record.released) return;
    record.released = true;
    active.delete(record.key);
    const wait = Math.max(linger, MIN_VISIBLE_MS - (performance.now() - record.started));
    record.spot.style.setProperty('--tp-out-delay', `${Math.round(wait)}ms`);
    record.spot.classList.add('out');
    record.timer = later(() => {
      record.spot.remove();
      records.delete(record);
    }, wait + LEAVE_MS + 60);
  }

  function clear() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const record of records) {
      record.released = true;
      record.spot.remove();
    }
    records.clear();
    active.clear();
  }

  function onDown(event) {
    if (!enabled) return;
    if (event.pointerType === 'mouse') {
      if (!showMouse || event.button !== 0) return;
    }
    if (active.has(event.pointerId)) return;
    spawn(event.pointerId, event.clientX, event.clientY);
  }

  function onMove(event) {
    const record = active.get(event.pointerId);
    if (!record) return;
    place(record.spot, event.clientX, event.clientY);
  }

  function onUp(event) {
    release(active.get(event.pointerId));
  }

  function releaseAll() {
    for (const record of [...active.values()]) release(record);
  }

  host.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, { capture: true, passive: true });
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onUp, true);
  window.addEventListener('blur', releaseAll);

  /** Show a print at viewport coordinates without a pointer event.
   * Useful for scripted demo tours.
   * @param {number} x
   * @param {number} y
   * @param {{ hold?: number }} [options]
   */
  function touch(x, y, { hold = 260 } = {}) {
    if (!enabled) return null;
    const record = spawn(`touchprint-${++sequence}`, x, y);
    later(() => release(record), Math.max(0, hold));
    return record;
  }

  /** Turn contact prints on or off. Turning them off fades out any print already down.
   * @param {boolean} value
   */
  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) releaseAll();
  }

  function destroy() {
    host.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    window.removeEventListener('blur', releaseAll);
    clear();
    layer.remove();
  }

  return { layer, touch, clear, destroy, setEnabled, get enabled() { return enabled; } };
}
