import { roundedRectPath, playTilePreview } from '../preview-tile.js';

const svgNS = 'http://www.w3.org/2000/svg';

function trackPosition({ min, max }, value) {
  return 10 + 84 * ((value - min) / (max - min));
}

function snapValue(field, value) {
  // Catch for about two pixels, then ease back to the pointer within six pixels.
  const span = field.max - field.min;
  const hold = span * .025, reach = span * .075;
  const node = field.nodes.find(stop => Math.abs(value - stop) < reach);
  if (node === undefined) return value;
  const delta = value - node;
  const travel = Math.max(0, Math.abs(delta) - hold);
  return node + Math.sign(delta) * travel * reach / (reach - hold);
}

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

  const fields = [
    { label: 'Corner radius', initial: initialRadius, min: 0, max: 10, step: .1, keyboardStep: .5, nodes: [2, initialRadius],
      source: value => `rx="${value}"`,
      apply: value => scale.querySelector('[data-helper-head]').setAttribute('d', roundedRectPath(...dimensions, value)) },
    { label: 'Scale', initial: 1, min: .5, max: 1.5, step: .01, keyboardStep: .05, nodes: [.75, 1, 1.25],
      source: value => `scale(${value})`,
      apply: value => scale.setAttribute('transform', `scale(${value})`) },
    { label: 'Animation duration', initial: 2000, min: 500, max: 3500, step: 10, keyboardStep: 100,
      nodes: [1000, 2000, 3000], unit: 'milliseconds', commit: play,
      source: value => `animation-duration: ${value}ms`,
      apply: value => {
        tile.style.setProperty('--helper-duration', `${value}ms`);
        if (!tile.classList.contains('play')) play();
      } },
  ];

  function play() {
    playTilePreview(tile, fields[2].value * 1.15);
  }

  function render(field, value) {
    field.value = value;
    field.input.value = value;
    field.input.setAttribute('aria-valuetext', field.unit ? `${value} ${field.unit}` : String(value));
    field.output.textContent = field.source(value);
    const x = trackPosition(field, value);
    field.progress.setAttribute('x2', x);
    field.thumb.setAttribute('cx', x);
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
    const row = document.createElement('div');
    row.className = 'inspection-row';
    row.innerHTML = `<code><span></span></code>
      <span class="inspection-slider">
        <svg viewBox="0 0 104 44" aria-hidden="true">
          <line x1="10" x2="94" y1="22" y2="22"/>
          <line class="inspection-progress" x1="10" y1="22" y2="22"/>
          <g class="inspection-nodes"></g>
          <circle class="inspection-thumb" cy="22" r="5"/>
        </svg>
        <input type="range" aria-label="${field.label}" min="${field.min}" max="${field.max}" step="${field.step}">
      </span>`;
    field.output = row.querySelector('code span');
    field.input = row.querySelector('input');
    field.progress = row.querySelector('.inspection-progress');
    field.thumb = row.querySelector('.inspection-thumb');
    const nodes = row.querySelector('.inspection-nodes');
    for (const value of field.nodes) {
      const node = document.createElementNS(svgNS, 'circle');
      node.setAttribute('cx', trackPosition(field, value));
      node.setAttribute('cy', '22');
      node.setAttribute('r', '2');
      nodes.append(node);
    }
    const update = raw => {
      const clamped = Math.max(field.min, Math.min(field.max, raw));
      const value = Number((Math.round(clamped / field.step) * field.step).toFixed(2));
      if (value === field.value) return false;
      render(field, value);
      field.apply(value);
      return true;
    };
    let drag;
    const dragTo = event => {
      if (drag?.id !== event.pointerId) return;
      const { left, width } = field.input.getBoundingClientRect();
      const fraction = ((event.clientX - left) * 104 / width - 10) / 84;
      const value = field.min + fraction * (field.max - field.min);
      if (update(snapValue(field, value))) drag.changed = true;
    };
    field.input.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      event.preventDefault();
      field.input.focus({ preventScroll: true });
      field.input.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, changed: false };
      dragTo(event);
    });
    field.input.addEventListener('pointermove', dragTo);
    const stopDrag = event => {
      if (drag?.id !== event.pointerId) return;
      if (event.type === 'pointerup') dragTo(event);
      const { changed } = drag;
      drag = null;
      if (changed) field.commit?.();
    };
    field.input.addEventListener('pointerup', stopDrag);
    field.input.addEventListener('lostpointercapture', stopDrag);
    field.input.addEventListener('input', () => update(field.input.valueAsNumber));
    field.input.addEventListener('change', () => field.commit?.());
    field.input.addEventListener('keydown', event => {
      const delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      if (update(field.value + delta * field.keyboardStep)) field.commit?.();
    });
    source.append(row);
    render(field, field.initial);
  }

  panel.querySelector('.inspection-reset').addEventListener('click', reset);
  return { play };
}
