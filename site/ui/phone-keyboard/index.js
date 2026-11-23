// The export script embeds the same SVG for hosts that load from a local file.
const embeddedArtwork = null;
const svgNamespace = 'http://www.w3.org/2000/svg';
const cropTop = 44;
const duration = 220;
const easing = 'cubic-bezier(.2,.7,.2,1)';
const letters = 'qwertyuiopasdfghjklzxcvbnm';
const symbols = Array.from('1234567890@#$%&-+()!?/:;₹=');
const emoji = Array.from('😀😃😄😁😅😂🙂🙃😉😊😍😎🤔😮😢😴😬😐🙄😇👍👎👏🙌🎉🔥');
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
  .launcher:focus-visible, .hit:focus-visible { outline: 1px dashed currentColor; outline-offset: 1px; }
  .panel { position: absolute; inset-block-end: 0; inset-inline: 0; margin-inline: auto;
    width: min(100%, 29rem, max(9rem, calc((100cqh - 86px) * 1.12))); }
  .surface { opacity: 0; visibility: hidden; transform: translateY(8px);
    transition: opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}, visibility 0ms ${duration}ms;
    background: var(--keyboard-paper, Canvas); border-radius: 12px 12px 0 0; }
  .panel[data-open] .surface { opacity: 1; visibility: visible; transform: none; pointer-events: auto;
    transition: opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}; }
  textarea { width: 100%; display: block; padding: 8px 12px; height: clamp(38px, 11cqh, 96px);
    background: transparent; border: 0; resize: none; outline: none; font-size: 16px;
    line-height: 1.4; touch-action: pan-y; user-select: text; }
  .board { position: relative; }
  .board svg { display: block; width: 100%; height: auto; pointer-events: none; }
  .hit { position: absolute; background: transparent; color: inherit; border: 0; padding: 0;
    border-radius: 5px; cursor: pointer; touch-action: manipulation; }
  .hit:hover, .hit[aria-pressed="true"] { background: color-mix(in srgb, currentColor 7%, transparent); }
  .hit:active { background: color-mix(in srgb, currentColor 16%, transparent); }
  .error { margin: 0; padding: 3px 12px; font-size: 12px; }
  [hidden] { display: none; }
  @media (prefers-reduced-motion: reduce) { .surface, .panel[data-open] .surface { transition: none; } }
`;

export const phoneKeyboardMotion = { duration, easing };
export const phoneKeyboardVersion = '1.0.0';

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
  return svg;
}

export async function mountPhoneKeyboard(host, {
  copyText = text => navigator.clipboard.writeText(text),
  onReserve = () => {},
} = {}) {
  const source = embeddedArtwork ?? await (artworkRequest ??= fetch(new URL('../../reference/phone-keyboard.svg', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error(`Could not load phone keyboard artwork (${response.status}).`);
      return response.text();
    }));
  const artwork = document.importNode(new DOMParser().parseFromString(source, 'image/svg+xml').documentElement, true);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${styles}</style>
    <button class="launcher" type="button" aria-label="Open keyboard" aria-expanded="false" aria-controls="panel"></button>
    <section class="panel" id="panel" aria-label="Keyboard" inert>
      <div class="surface">
        <textarea aria-label="Text to copy" inputmode="none"></textarea>
        <p class="error" role="status" hidden></p>
        <div class="board"></div>
      </div>
    </section>`;
  const launcher = root.querySelector('.launcher');
  const panel = root.querySelector('.panel');
  const input = root.querySelector('textarea');
  const error = root.querySelector('.error');
  const board = root.querySelector('.board');
  launcher.append(makeLauncher(artwork));

  artwork.querySelector('.suggestions').remove();
  artwork.querySelector('.board-outline').setAttribute('y', cropTop + 1);
  artwork.querySelector('.board-outline').setAttribute('height', 280 - cropTop);
  artwork.setAttribute('viewBox', `0 ${cropTop} 400 ${282 - cropTop}`);
  artwork.setAttribute('aria-hidden', 'true');
  board.append(artwork);

  const keys = new Map();
  for (const cap of artwork.querySelectorAll('[data-key]')) {
    const { key } = cap.dataset;
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
    keys.set(key, { button, legend, altLegend, alt: altLegend?.textContent });
    board.append(button);
  }

  let open = false, saving = false, shift = false, mode = 'letters';
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  function updateKeys() {
    for (const [i, letter] of Array.from(letters).entries()) {
      const key = keys.get(`Key${letter.toUpperCase()}`);
      key.value = mode === 'emoji' ? emoji[i] : mode === 'symbols' ? symbols[i] : shift ? letter.toUpperCase() : letter;
      key.legend.textContent = key.value;
      key.altLegend.style.display = mode === 'letters' ? '' : 'none';
      key.button.setAttribute('aria-label', mode === 'letters' ? `${key.value}, hold for ${key.alt}` : key.value);
    }
    const symbolsKey = keys.get('Symbols');
    symbolsKey.legend.textContent = mode === 'symbols' ? 'ABC' : '?123';
    symbolsKey.button.setAttribute('aria-label', mode === 'symbols' ? 'Letters' : 'Symbols');
    for (const [id, label] of Object.entries({
      Shift: 'Shift', Backspace: 'Backspace', Comma: 'Comma', Emoji: 'Emoji', Space: 'Space', Period: 'Period',
      Enter: 'Done and copy text, hold for a new line',
    })) keys.get(id).button.setAttribute('aria-label', label);
    keys.get('Shift').button.setAttribute('aria-pressed', String(shift));
    keys.get('Emoji').button.setAttribute('aria-pressed', String(mode === 'emoji'));
  }

  function setOpen(next) {
    if (open === next || (saving && !next)) return;
    open = next;
    panel.toggleAttribute('data-open', open);
    panel.inert = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Close keyboard' : 'Open keyboard');
    onReserve(open ? panel.getBoundingClientRect() : null);
    if (open) input.focus({ preventScroll: true });
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
    const key = keys.get(id);
    const { selectionStart: start, selectionEnd: end } = input;
    if (id === 'Enter' && !held) { void finish(); return; }
    if (id === 'Shift') shift = mode === 'letters' && !shift;
    else if (id === 'Symbols' || id === 'Emoji') {
      const target = id.toLowerCase();
      mode = mode === target ? 'letters' : target;
      shift = false;
    } else if (id === 'Backspace') {
      const previous = start > 0 ? segmenter.segment(input.value).containing(start - 1).index : 0;
      input.setRangeText('', start === end ? previous : start, end, 'end');
    } else {
      const fixed = { Enter: '\n', Space: ' ', Period: '.', Comma: ',' };
      input.setRangeText(fixed[id] ?? (held ? key.alt : key.value), start, end, 'end');
      if (shift && key.value) shift = false;
    }
    updateKeys();
    input.focus({ preventScroll: true });
  }

  for (const [id, { button, alt }] of keys) {
    let timer, held = false;
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); // Keep the text selection while using a drawn key.
      held = false;
      if (id === 'Enter' || (alt && mode === 'letters')) {
        timer = setTimeout(() => { held = true; activate(id, true); }, 450);
      }
    });
    for (const name of ['pointerup', 'pointerleave', 'pointercancel']) {
      button.addEventListener(name, () => clearTimeout(timer));
    }
    button.addEventListener('click', event => {
      if (!held || event.detail === 0) activate(id);
      held = false;
    });
  }
  launcher.addEventListener('click', () => setOpen(!open));
  launcher.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) setOpen(false);
  });
  panel.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.target === input && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void finish();
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
      observer.disconnect();
      if (open) onReserve(null);
      root.replaceChildren();
    },
  };
}
