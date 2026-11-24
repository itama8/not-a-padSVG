/* Shared lab helpers. No build step: import from any lab page.
 *
 *   import { bindSchemeToggle, loopTiles, announce } from './lab.js';
 *
 * Helpers are deliberately boring: every lab gets the same dark/light
 * toggle, the same replay loop for tiles, and the same status announcer,
 * so labs differ only in the controls their experiment needs.
 */

/** Dark/light toggle. Button label follows the current scheme. */
export function bindSchemeToggle(button) {
  const root = document.documentElement;
  const dark = () =>
    root.dataset.scheme ? root.dataset.scheme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const label = () => { button.textContent = dark() ? 'Light' : 'Dark'; };
  button.addEventListener('click', () => {
    root.dataset.scheme = dark() ? 'light' : 'dark';
    label();
  });
  label();
}

/** Replay every tile on a loop. Returns a stop function. */
export function loopTiles(tiles, play, { firstDelay = 900, interval = 2900 } = {}) {
  const startTimer = setTimeout(() => tiles.forEach(play), firstDelay);
  const repeatTimer = setInterval(() => tiles.forEach(play), interval);
  return () => {
    clearTimeout(startTimer);
    clearInterval(repeatTimer);
  };
}

/** Write a status line (and keep it announced to screen readers). */
export function announce(el, text) {
  if (el) el.textContent = text;
}

/** Persist a small lab preference (currency, mood, seed) without throwing. */
export function loadPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function savePref(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
