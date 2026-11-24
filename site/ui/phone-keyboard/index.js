import { createPhoneKeyboardTyping } from './typing.js?v=1.4.1';

// The export script embeds the same SVG for hosts that load from a local file.
const embeddedArtwork = null;
/*!
 * Send artwork from Omakase v2's invocation-send (Heroicons 2.2.0 paper-airplane).
 * MIT License. Copyright (c) Tailwind Labs, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const sendArtwork = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
  fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>
</svg>`;
const svgNamespace = 'http://www.w3.org/2000/svg';
const cropTop = 44;
const duration = 220;
const easing = 'cubic-bezier(.2,.7,.2,1)';
const pressDuration = 55;
const releaseDuration = 240;
const pressTravel = 2;
const touchSlop = 8;
const holdDelay = 450;
const backspaceInterval = 70;
const releaseDisplacements = Array.from({ length: 17 }, (_, index) => {
  if (index === 16) return 0;
  const t = releaseDuration / 1000 * index / 16;
  // Displacement of an underdamped spring released from rest.
  return Math.exp(-17 * t) * (Math.cos(30 * t) + 17 / 30 * Math.sin(30 * t));
});
const capFrame = displacement => ({
  transform: `translateY(${pressTravel * displacement}px) scale(${1 - .12 * displacement})`,
});
let artworkRequest;

const styles = `
  :host { display: block; container-type: size; pointer-events: none;
    color: var(--keyboard-ink, CanvasText); font-family: system-ui, sans-serif; }
  button, textarea { font: inherit; color: inherit; box-sizing: border-box; }
  button { -webkit-tap-highlight-color: transparent; }
  .launcher { position: absolute; inset-block-start: 0; inset-inline-end: 0; pointer-events: auto;
    display: grid; place-items: center; width: 44px; height: 44px; padding: 6px;
    border: 0; border-radius: 8px; background: transparent; cursor: pointer; }
  .launcher svg { display: block; width: 100%; }
  .launcher:hover, .launcher[aria-expanded="true"] { background: color-mix(in srgb, currentColor 7%, transparent); }
  .launcher:focus-visible, .composer button:focus-visible, .hit:focus-visible {
    outline: 1px dashed currentColor; outline-offset: 1px;
  }
  .panel { position: absolute; inset-block-end: 0; inset-inline: 0; margin-inline: auto;
    width: min(100%, 29rem, max(9rem, calc((100cqh - 86px) * 1.12))); }
  .surface { opacity: 0; visibility: hidden; transform: translateY(8px);
    transition: opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}, visibility 0ms ${duration}ms;
    background: var(--keyboard-paper, Canvas); border-radius: 12px 12px 0 0; }
  .panel[data-open] .surface { opacity: 1; visibility: visible; transform: none; pointer-events: auto;
    transition: opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}; }
  .composer { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start;
    gap: 4px; padding-inline: 4px; }
  textarea { width: 100%; min-width: 0; display: block; padding: 8px 12px; height: clamp(44px, 11cqh, 96px);
    background: transparent; border: 0; resize: none; outline: none; font-size: 16px;
    line-height: 1.4; touch-action: pan-y; user-select: text; }
  .composer button { min-width: 44px; min-height: 44px; padding: 0 8px; border: 0;
    border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; touch-action: manipulation; }
  .composer .send { display: grid; place-items: center;
    color: var(--keyboard-paper, Canvas); background: var(--keyboard-accent, CanvasText); }
  .composer .send svg { display: block; width: 20px; height: 20px; }
  .composer .close { background: transparent; font-size: 24px; font-weight: 400; line-height: 1; }
  .board { position: relative; }
  .board svg { display: block; width: 100%; height: auto; pointer-events: none; }
  .hit { position: absolute; background: transparent; color: inherit; border: 0; padding: 0;
    border-radius: 5px; cursor: pointer; touch-action: none; }
  .hit[aria-pressed="true"] { background: color-mix(in srgb, currentColor 7%, transparent); }
  @media (hover: hover) and (pointer: fine) {
    .hit:hover { background: color-mix(in srgb, currentColor 5%, transparent); }
  }
  .board svg [data-key] { transform-box: fill-box; transform-origin: center; }
  .board svg [data-key][data-down] .key-outline {
    fill: var(--keyboard-accent, currentColor); fill-opacity: .23;
    stroke: var(--keyboard-accent, currentColor); stroke-opacity: .9;
  }
  .board svg [data-shift="once"] .key-outline,
  .board svg [data-shift="locked"] .key-outline {
    fill: var(--keyboard-accent, currentColor); fill-opacity: .16;
    stroke: var(--keyboard-accent, currentColor); stroke-opacity: .9;
  }
  .board[data-symbols] svg :is([data-key="Comma"], [data-key="Period"]) .key-legend { font-size: 21px; }
  .key-preview {
    position: absolute; z-index: 1; transform: translate(-50%, calc(-100% - 5px));
    display: grid; place-items: center; min-width: 36px; height: 36px; padding: 0 6px;
    box-sizing: border-box; pointer-events: none; border-radius: 9px;
    color: var(--keyboard-paper, Canvas); background: var(--keyboard-accent, CanvasText);
    font-size: 24px; line-height: 1; box-shadow: 0 3px 9px #0003;
  }
  .key-preview::after {
    content: ''; position: absolute; inset-block-end: -4px; width: 9px; height: 9px;
    border-radius: 1px; background: inherit; transform: rotate(45deg);
  }
  .error { margin: 0; padding: 3px 12px; font-size: 12px; }
  [hidden] { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .surface, .panel[data-open] .surface { transition: none; }
  }
`;

export const phoneKeyboardMotion = { duration, easing };
export const phoneKeyboardVersion = '1.4.1';

function makeLauncher(artwork) {
  const svg = artwork.cloneNode(false);
  svg.removeAttribute('role');
  svg.removeAttribute('aria-labelledby');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 44 400 238');
  const outline = artwork.querySelector('.board-outline').cloneNode();
  outline.setAttribute('y', '46');
  outline.setAttribute('height', '234');
  outline.setAttribute('rx', '28');
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', 'currentColor');
  outline.setAttribute('stroke-width', '1.15');
  outline.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(outline);
  for (const cap of artwork.querySelectorAll('.key-outline')) {
    if (cap.closest('[data-symbol-only]')) continue;
    const mark = document.createElementNS(svgNamespace, 'rect');
    const [x, y, width, height] = ['x', 'y', 'width', 'height'].map(name => Number(cap.getAttribute(name)));
    mark.setAttribute('x', x + 3);
    mark.setAttribute('y', y + 9);
    mark.setAttribute('width', width - 6);
    mark.setAttribute('height', height - 18);
    mark.setAttribute('rx', '7');
    mark.setAttribute('fill', 'currentColor');
    mark.setAttribute('opacity', cap.closest('.return') ? '1' : '.58');
    svg.append(mark);
  }
  svg.classList.add('keyboard-launcher-art');
  return svg;
}

export async function mountPhoneKeyboard(host, {
  copyText = text => navigator.clipboard.writeText(text),
  onReserve = () => {},
  launcher: externalLauncher,
  restoreFocus,
} = {}) {
  const source = embeddedArtwork ?? await (artworkRequest ??= fetch(new URL(
    `../../reference/phone-keyboard.svg?v=${phoneKeyboardVersion}`, import.meta.url,
  ))
    .then(response => {
      if (!response.ok) throw new Error(`Could not load phone keyboard artwork (${response.status}).`);
      return response.text();
    }));
  const artwork = document.importNode(new DOMParser().parseFromString(source, 'image/svg+xml').documentElement, true);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${styles}</style>
    ${externalLauncher ? '' : '<button class="launcher" type="button" aria-label="Open keyboard" aria-controls="panel"></button>'}
    <section class="panel" id="panel" aria-label="Keyboard" inert>
      <div class="surface">
        <div class="composer">
          <button class="close" type="button" aria-label="Close keyboard">×</button>
          <textarea aria-label="Text to copy" inputmode="none"></textarea>
          <button class="send" type="button" aria-label="Send" title="Send">${sendArtwork}</button>
        </div>
        <p class="error" role="status" hidden></p>
        <div class="board"><div class="key-preview" aria-hidden="true" hidden></div></div>
      </div>
    </section>`;
  const launcher = externalLauncher ?? root.querySelector('.launcher');
  const panel = root.querySelector('.panel');
  const input = root.querySelector('textarea');
  const send = root.querySelector('.send');
  const close = root.querySelector('.close');
  const error = root.querySelector('.error');
  const board = root.querySelector('.board');
  const preview = root.querySelector('.key-preview');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const launcherArt = makeLauncher(artwork);
  launcher.append(launcherArt);
  launcher.setAttribute('aria-expanded', 'false');

  artwork.querySelector('.suggestions').remove();
  artwork.querySelector('.board-outline').setAttribute('y', cropTop + 1);
  artwork.querySelector('.board-outline').setAttribute('height', 280 - cropTop);
  artwork.setAttribute('viewBox', `0 ${cropTop} 400 ${282 - cropTop}`);
  artwork.setAttribute('aria-hidden', 'true');
  board.append(artwork);

  const symbolRows = artwork.querySelectorAll('[data-symbol-offset]');
  const keys = new Map();
  for (const cap of artwork.querySelectorAll('[data-key]')) {
    const { key } = cap.dataset;
    const symbolOffset = Number(cap.closest('[data-symbol-offset]')?.dataset.symbolOffset ?? 0);
    const outline = cap.querySelector('rect');
    const [x, y, width, height] = ['x', 'y', 'width', 'height'].map(name => Number(outline.getAttribute(name)));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hit';
    button.dataset.key = key;
    Object.assign(button.style, {
      left: `${(x - 2) / 4}%`, width: `${(width + 4) / 4}%`,
      top: `${(y - cropTop - 2) / (282 - cropTop) * 100}%`,
      height: `${(height + 4) / (282 - cropTop) * 100}%`,
    });
    const legend = cap.querySelector('.key-legend');
    const altLegend = cap.querySelector('.alternate');
    keys.set(key, { button, cap, legend, altLegend, alt: altLegend?.textContent, x, width,
      symbolOffset, symbolOnly: cap.hasAttribute('data-symbol-only'),
      previewY: `${(y - cropTop) / (282 - cropTop) * 100}%` });
    board.append(button);
  }

  let open = false, saving = false;
  // A contact started on an old layer must never type the key now underneath it.
  let layerRevision = 0;
  let previewContact, previewTimer;
  const typing = createPhoneKeyboardTyping();

  function updateKeys() {
    const { mode, shift, isSymbols } = typing;
    board.toggleAttribute('data-symbols', isSymbols);
    for (const row of symbolRows) {
      if (isSymbols) row.setAttribute('transform', `translate(${row.dataset.symbolOffset} 0)`);
      else row.removeAttribute('transform');
    }
    for (const [id, key] of keys) {
      if (key.symbolOnly) {
        key.button.hidden = !isSymbols;
        key.cap.style.display = isSymbols ? '' : 'none';
      }
      if (key.symbolOffset) {
        const offset = isSymbols ? key.symbolOffset : 0;
        key.button.style.left = `${(key.x + offset - 2) / 4}%`;
      }
      const value = typing.keyValue(id);
      if (value === undefined) continue;
      key.legend.textContent = value;
      if (key.altLegend) key.altLegend.style.display = mode === 'letters' ? '' : 'none';
      key.button.setAttribute('aria-label', mode === 'letters' && key.alt ? `${value}, hold for ${key.alt}` : value);
    }
    const symbolsKey = keys.get('Symbols');
    symbolsKey.legend.textContent = isSymbols ? 'ABC' : '?123';
    symbolsKey.button.setAttribute('aria-label', isSymbols ? 'Letters' : 'Symbols');
    for (const [id, label] of Object.entries({
      Backspace: 'Backspace, hold to delete repeatedly', Emoji: 'Emoji', Space: 'Space', Enter: 'Enter, new line',
    })) keys.get(id).button.setAttribute('aria-label', label);
    keys.get('Comma').button.setAttribute('aria-label', mode === 'moreSymbols' ? 'Less than' : 'Comma');
    keys.get('Period').button.setAttribute('aria-label', mode === 'moreSymbols' ? 'Greater than' : 'Period');
    keys.get('SymbolExtra')?.button.setAttribute('aria-label', mode === 'moreSymbols' ? 'Backslash' : 'Slash');
    const shiftKey = keys.get('Shift');
    shiftKey.cap.dataset.shift = mode === 'letters' ? shift : 'off';
    shiftKey.legend.style.display = isSymbols ? '' : 'none';
    shiftKey.legend.textContent = mode === 'moreSymbols' ? '?123' : 'More';
    shiftKey.cap.querySelector('use').style.display = isSymbols ? 'none' : '';
    shiftKey.cap.querySelector('.caps-mark').style.display = mode === 'letters' && shift === 'locked' ? '' : 'none';
    if (isSymbols) {
      shiftKey.button.removeAttribute('aria-pressed');
      shiftKey.button.setAttribute('aria-label', mode === 'symbols' ? 'More symbols' : 'Numbers and symbols');
    } else {
      shiftKey.button.setAttribute('aria-pressed', String(mode === 'letters' && shift !== 'off'));
      shiftKey.button.setAttribute('aria-label', mode === 'letters' && shift === 'locked' ? 'Shift, Caps Lock on' : 'Shift');
    }
    keys.get('Emoji').button.setAttribute('aria-pressed', String(mode === 'emoji'));
  }

  function setOpen(next) {
    if (open === next || (saving && !next)) return;
    open = next;
    if (!open) {
      typing.resetShiftTap();
      for (const key of keys.values()) key.clearPress();
      hidePreview();
    }
    panel.toggleAttribute('data-open', open);
    panel.inert = !open;
    launcher.setAttribute('aria-expanded', String(open));
    onReserve(open ? panel.getBoundingClientRect() : null);
    if (open) input.focus({ preventScroll: true });
    else if (restoreFocus) restoreFocus();
    else launcher.focus({ preventScroll: true });
  }

  async function finish() {
    if (saving) return;
    if (!input.value) { setOpen(false); return; }
    saving = true;
    input.readOnly = true;
    try {
      await copyText(input.value);
    } catch {
      error.textContent = 'Couldn’t copy. Try again.';
      error.hidden = false;
      input.focus({ preventScroll: true });
      return;
    } finally {
      saving = false;
      input.readOnly = false;
    }
    input.value = '';
    error.hidden = true;
    setOpen(false);
  }

  function activate(id, held = false) {
    if (saving) return;
    const { mode, shift } = typing;
    const action = typing.activate(id, {
      value: input.value, start: input.selectionStart, end: input.selectionEnd,
    }, { held, alternate: keys.get(id).alt });
    if (action?.type === 'replace') {
      input.setRangeText(action.text, action.start, action.end, 'end');
    }
    if (mode !== typing.mode) layerRevision++;
    if (mode !== typing.mode || shift !== typing.shift) updateKeys();
    if (root.activeElement !== input) input.focus({ preventScroll: true });
  }

  function hidePreview() {
    clearTimeout(previewTimer);
    previewContact = null;
    preview.hidden = true;
  }

  function showPreview(key, glyph, contact) {
    hidePreview();
    if (!glyph) return;
    previewContact = contact;
    preview.textContent = glyph;
    const offset = typing.isSymbols ? key.symbolOffset : 0;
    preview.style.left = `${(key.x + offset + key.width / 2) / 4}%`;
    preview.style.top = key.previewY;
    preview.hidden = false;
  }

  function releasePreview(contact, cancelled = false) {
    if (previewContact !== contact) return;
    if (cancelled) hidePreview();
    else previewTimer = setTimeout(hidePreview, 135);
  }

  for (const [id, key] of keys) {
    const { button, cap, alt } = key;
    const contacts = new Map();
    let motion, pointerClick;
    const glyph = () => typing.keyValue(id);

    function currentDisplacement() {
      if (!motion) return 0;
      const transform = getComputedStyle(cap).transform;
      // Translation and scale follow the same displacement, including spring overshoot.
      return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).f / pressTravel;
    }
    key.stopMotion = () => {
      motion?.cancel();
      motion = null;
    };
    function reboundKey() {
      const displacement = currentDisplacement();
      key.stopMotion();
      if (reducedMotion.matches || !displacement) return;
      const frames = releaseDisplacements.map(value => capFrame(value * displacement));
      const rebound = cap.animate(frames, { duration: releaseDuration });
      motion = rebound;
      rebound.onfinish = () => { if (motion === rebound) motion = null; };
    }
    function pressKey() {
      const displacement = currentDisplacement();
      key.stopMotion();
      cap.setAttribute('data-down', '');
      if (!reducedMotion.matches) {
        motion = cap.animate([capFrame(displacement), capFrame(1)], {
          duration: pressDuration, easing: 'ease-out', fill: 'forwards',
        });
      }
    }
    function releaseKey({ cancelled = false, finishPress = false } = {}) {
      cap.removeAttribute('data-down');
      if (cancelled) key.stopMotion();
      else if (finishPress && motion) {
        const press = motion;
        press.onfinish = () => { if (motion === press) reboundKey(); };
      } else reboundKey();
    }
    key.clearPress = () => {
      for (const contact of contacts.values()) clearTimeout(contact.timer);
      contacts.clear();
      pointerClick = undefined;
      key.stopMotion();
      cap.removeAttribute('data-down');
    };

    function outsideKey({ clientX, clientY }) {
      const { left, right, top, bottom } = button.getBoundingClientRect();
      return clientX < left - touchSlop || clientX > right + touchSlop ||
        clientY < top - touchSlop || clientY > bottom + touchSlop;
    }
    function endContact(event, cancelled) {
      const contact = contacts.get(event.pointerId);
      if (!contact) return;
      contacts.delete(event.pointerId);
      clearTimeout(contact.timer);
      if (!contacts.size) releaseKey({ cancelled });
      const stale = contact.layer !== layerRevision;
      releasePreview(contact, cancelled || stale);
      if (cancelled || contact.held || stale) return;
      if (contact.touch) activate(id);
      else pointerClick = contact.layer;
    }

    // Suppress legacy touch-generated mouse events, including clicks without touch metadata.
    button.addEventListener('touchstart', event => event.preventDefault(), { passive: false });
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !open || saving || contacts.has(event.pointerId)) return;
      event.preventDefault(); // Keep the text selection while using a drawn key.
      pointerClick = undefined;
      const contact = { layer: layerRevision, touch: event.pointerType === 'touch', held: false, timer: undefined };
      if (!contacts.size) pressKey();
      contacts.set(event.pointerId, contact);
      showPreview(key, glyph(), contact);
      if (typing.supportsHold(id, alt)) {
        function hold() {
          if (saving || contact.layer !== layerRevision) return;
          contact.held = true;
          if (alt && previewContact === contact) showPreview(key, alt, contact);
          activate(id, true);
          if (id === 'Backspace') contact.timer = setTimeout(hold, backspaceInterval);
        }
        contact.timer = setTimeout(hold, holdDelay);
      }
    });
    // Touch capture keeps events on the starting button even when a finger drifts.
    button.addEventListener('pointermove', event => {
      if (contacts.get(event.pointerId)?.touch && outsideKey(event)) endContact(event, true);
    });
    button.addEventListener('pointerup', event => {
      endContact(event, event.pointerType === 'touch' && outsideKey(event));
    });
    for (const name of ['pointerleave', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(name, event => endContact(event, true));
    }
    button.addEventListener('click', event => {
      if (!open || saving || event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents) return;
      if (event.detail === 0) {
        // Keyboard and assistive clicks have no pointerdown to start the press.
        if (!contacts.size) {
          const contact = {};
          pressKey();
          showPreview(key, glyph(), contact);
          releaseKey({ finishPress: true });
          releasePreview(contact);
        }
      } else {
        // A pointer click needs a completed mouse or pen press on this key.
        if (pointerClick !== layerRevision) return;
        pointerClick = undefined;
      }
      activate(id);
    });
  }
  const listeners = new AbortController();
  reducedMotion.addEventListener('change', event => {
    if (event.matches) for (const key of keys.values()) key.stopMotion();
  }, { signal: listeners.signal });
  launcher.addEventListener('click', () => setOpen(true), { signal: listeners.signal });
  close.addEventListener('click', () => setOpen(false), { signal: listeners.signal });
  send.addEventListener('click', () => void finish(), { signal: listeners.signal });
  launcher.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) setOpen(false);
  }, { signal: listeners.signal });
  panel.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  });
  updateKeys();
  const observer = new ResizeObserver(() => {
    if (open) onReserve(panel.getBoundingClientRect());
  });
  observer.observe(host);
  observer.observe(panel);
  return {
    close: () => setOpen(false),
    launcherRect: () => launcher.getBoundingClientRect(),
    destroy() {
      listeners.abort();
      observer.disconnect();
      for (const key of keys.values()) key.clearPress();
      hidePreview();
      if (open) onReserve(null);
      launcherArt.remove();
      launcher.removeAttribute('aria-expanded');
      root.replaceChildren();
    },
  };
}
