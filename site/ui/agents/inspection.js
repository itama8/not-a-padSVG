import { roundedRectPath, playTilePreview } from '../preview-tile.js';

const svgNS = 'http://www.w3.org/2000/svg';

export function createHelperInspection(tile) {
  const artwork = tile.querySelector('svg');
  const head = artwork.querySelector('[data-helper-head]');
  const dimensions = ['x', 'y', 'width', 'height'].map(name => Number(head.getAttribute(name)));
  const initialRadius = Number(head.getAttribute('rx'));

  const scale = document.createElementNS(svgNS, 'g');
  scale.classList.add('helper-scale');
  scale.append(...[...artwork.children].slice(1)); // The frame stays the same size as the artwork scales.
  scale.setAttribute('transform', 'scale(1)');
  artwork.append(scale);
  const fields = [
    { label: 'Corner radius', initial: initialRadius, min: 0, max: 10, step: .1, keyboardStep: .5, nodes: [2, initialRadius],
      source: value => `rx="${value}"`,
      apply: value => scale.querySelector('[data-helper-head]').setAttribute('d', roundedRectPath(...dimensions, value)) },
    { label: 'Scale', initial: 1, min: .5, max: 1.5, step: .01, keyboardStep: .05, nodes: [.75, 1, 1.25],
      source: value => `scale(${value})`,
      apply: value => scale.setAttribute('transform', `scale(${value})`) },
    { label: 'Animation duration', initial: 2000, min: 500, max: 3500, step: 10, keyboardStep: 100,
      nodes: [1000, 2000, 3000], unit: 'milliseconds', commit: play,
      reset() {
        tile.style.removeProperty('--helper-duration');
        tile.classList.remove('play');
      },
      source: value => `animation-duration: ${value}ms`,
      apply: value => {
        tile.style.setProperty('--helper-duration', `${value}ms`);
        if (!tile.classList.contains('play')) play();
      } },
  ];

  function play() {
    const duration = fields[2];
    playTilePreview(tile, (duration.value ?? duration.initial) * 1.15);
  }

  return { fields, play };
}
