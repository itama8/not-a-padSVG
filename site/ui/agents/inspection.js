import { roundedRectPath, playTilePreview } from '../preview-tile.js';

const svgNS = 'http://www.w3.org/2000/svg';

const glyphs = {
  radius: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M4 12V8a4 4 0 0 1 4-4h4"/>',
  scale: '<rect x="8" y="8" width="8" height="8" rx="1"/><path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  motion: '<path d="M2 13h4l3-7 5 13 3-6h5"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M6 12h12m-6-6v12"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  reset: '<path d="M4 11a8 8 0 1 1 2 6m-2-6V5m0 6h6"/>',
};
const glyph = name => `<svg class="ic inspection-glyph" viewBox="0 0 24 24" aria-hidden="true">${glyphs[name]}</svg>`;

export function mountHelperInspection(panel, tile) {
  const artwork = tile.querySelector('svg');
  const head = artwork.querySelector('[data-helper-head]');
  const dimensions = ['x', 'y', 'width', 'height'].map(name => Number(head.getAttribute(name)));
  const initialRadius = Number(head.getAttribute('rx'));

  const scale = document.createElementNS(svgNS, 'g');
  scale.classList.add('helper-scale');
  scale.append(...[...artwork.children].slice(1)); // The frame stays the same size as the artwork scales.
  scale.setAttribute('transform', 'scale(1)');
  artwork.append(scale);
  const sourceMark = document.createElementNS(svgNS, 'path');
  sourceMark.setAttribute('class', 'inspection-source-mark b');
  sourceMark.setAttribute('d', 'M37 6l-2 2 2 2m7-4 2 2-2 2m-3-5-2 6');
  artwork.append(sourceMark);

  function button(icon, label, action) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'pbtn';
    control.setAttribute('aria-label', label);
    control.title = label;
    control.innerHTML = glyph(icon);
    control.addEventListener('click', () => {
      if (control.getAttribute('aria-disabled') !== 'true') action();
    });
    return control;
  }

  const fields = [
    { icon: 'radius', label: 'Corner radius', initial: initialRadius, min: 0, max: 10, step: 2,
      source: value => `rx="${value}"`,
      apply: value => scale.querySelector('[data-helper-head]').setAttribute('d', roundedRectPath(...dimensions, value)) },
    { icon: 'scale', label: 'Scale', initial: 1, min: .5, max: 1.5, step: .25,
      source: value => `transform="scale(${value})"`,
      apply: value => scale.setAttribute('transform', `scale(${value})`) },
    { icon: 'motion', label: 'Animation duration', initial: 2000, min: 500, max: 3500, step: 500,
      source: value => `animation-duration: ${value}ms`,
      apply: value => { tile.style.setProperty('--helper-duration', `${value}ms`); play(); } },
  ];

  function play() {
    playTilePreview(tile, fields[2].value * 1.15);
  }

  function render(field, value) {
    field.value = value;
    field.output.textContent = field.source(value);
    field.minus.setAttribute('aria-disabled', String(value <= field.min));
    field.plus.setAttribute('aria-disabled', String(value >= field.max));
  }

  function reset() {
    for (const field of fields) render(field, field.initial);
    fields[0].apply(fields[0].initial);
    fields[1].apply(fields[1].initial);
    tile.style.removeProperty('--helper-duration');
    tile.classList.remove('play');
  }

  const source = panel.querySelector('.inspection-source');
  for (const field of fields) {
    const change = steps => {
      const value = field.value + steps * field.step;
      render(field, value);
      field.apply(value);
    };
    const row = document.createElement('div');
    row.className = 'inspection-row';
    row.innerHTML = `${glyph(field.icon)}<code><output aria-label="${field.label}"></output></code>`;
    field.output = row.querySelector('output');
    field.minus = button('minus', `Decrease ${field.label.toLowerCase()}`, () => change(-1));
    field.plus = button('plus', `Increase ${field.label.toLowerCase()}`, () => change(1));
    row.append(field.minus, field.plus);
    source.append(row);
    render(field, field.initial);
  }

  const replay = button('play', 'Replay Helper', play);
  panel.querySelector('.inspection-actions').prepend(replay, button('reset', 'Reset SVG values', reset));
  return { play };
}
