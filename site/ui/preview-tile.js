const NS = 'http://www.w3.org/2000/svg';
const previewTimers = new WeakMap();

/**
 * @typedef {Object} PreviewTileDefinition
 * @property {string} id
 * @property {string} label
 * @property {'concept' | 'planned' | 'cooking' | 'iterating' | 'added-to-library'} status
 */

/** Attach trusted SVG artwork and its declaration to a native button.
 * @param {HTMLButtonElement} button
 * @param {PreviewTileDefinition} definition
 * @param {string} svg
 * @param {string} [artworkLabel]
 */
export function drawPreviewTile(button, { id, label, status }, svg, artworkLabel) {
  button.dataset.task = id;
  button.dataset.status = status;
  const name = artworkLabel ? `${label}, ${artworkLabel}` : label;
  button.setAttribute('aria-label', `${name}. ${status.replaceAll('-', ' ')}. Play a preview.`);
  button.innerHTML = `<svg class="ic" viewBox="-7 -7 62 62" aria-hidden="true">
    <g class="pop"><rect class="frame" x="-6" y="-6" width="60" height="60" rx="5" /></g>
    ${svg}
  </svg>`;
}

export function playTilePreview(button) {
  clearTimeout(previewTimers.get(button));
  button.classList.remove('play');
  void button.getBoundingClientRect();
  button.classList.add('play');
  previewTimers.set(button, setTimeout(() => {
    button.classList.remove('play');
    previewTimers.delete(button);
  }, 2300));
}

// Normalize pen strokes so pathLength applies consistently.
function toPath(el) {
  const n = (a) => parseFloat(el.getAttribute(a) || '0');
  let d;
  if (el.tagName === 'circle') {
    const cx = n('cx'), cy = n('cy'), r = n('r');
    d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`;
  } else {
    const x = n('x'), y = n('y'), w = n('width'), h = n('height'), r = Math.min(n('rx'), w / 2, h / 2);
    d = `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  }
  const p = document.createElementNS(NS, 'path');
  for (const a of el.attributes) if (!['cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx'].includes(a.name)) p.setAttribute(a.name, a.value);
  p.setAttribute('d', d);
  el.replaceWith(p);
}

export function preparePenStrokes(root) {
  root.querySelectorAll('circle.pen, rect.pen').forEach(toPath);
  root.querySelectorAll('.pen').forEach((p) => p.setAttribute('pathLength', '1'));
}
