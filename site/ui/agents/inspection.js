import { roundedRectPath, playTilePreview } from '../preview-tile.js';

const svgNS = 'http://www.w3.org/2000/svg';
const trackStart = 10, trackLength = 84, trackEnd = trackStart + trackLength;
const trackY = 22, sliderWidth = 104;
const snapDistance = 5, releaseDistance = 10;
const rippleDuration = 640;

function trackPosition({ min, max }, value) {
  return trackStart + trackLength * ((value - min) / (max - min));
}

function trackPath(end, wave) {
  if (!wave) return `M ${trackStart} ${trackY} H ${end}`;
  const yAt = x => (trackY + wave(x)).toFixed(2);
  let path = `M ${trackStart} ${yAt(trackStart)}`;
  for (let x = trackStart + 2; x < end; x += 2) path += ` L ${x} ${yAt(x)}`;
  return `${path} L ${end} ${yAt(end)}`;
}

// The draft-selection pluck from Omakase v2's invocation-card-review timeline.
function draftRipple(origin, t) {
  const strength = Math.min(1, t / .1) * Math.exp(-3.4 * t) * (1 - t);
  const spread = 16 + 46 * t;
  return {
    strength,
    wave(x) {
      const distance = Math.abs(x - origin);
      return 5 * strength * Math.exp(-((distance / spread) ** 2))
        * Math.cos(2 * Math.PI * (distance / 44 - 2.1 * t));
    },
  };
}

export function mountHelperInspection(panel, tile) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
    field.thumb.setAttribute('cx', trackPosition(field, value));
    field.paintTrack();
  }

  function reset() {
    for (const field of fields) render(field, field.initial);
    fields[0].apply(fields[0].initial);
    fields[1].apply(fields[1].initial);
    tile.style.removeProperty('--helper-duration');
    tile.classList.remove('play');
  }

  const source = panel.querySelector('.inspection-source');
  for (const [index, field] of fields.entries()) {
    const row = document.createElement('div');
    row.className = 'inspection-row';
    const glowId = `helper-slider-glow-${index}`;
    row.innerHTML = `<code><span></span></code>
      <span class="inspection-slider">
        <svg viewBox="0 0 104 44" aria-hidden="true">
          <linearGradient id="${glowId}" gradientUnits="userSpaceOnUse" y1="0" y2="0">
            <stop offset="0" stop-opacity="0"/>
            <stop offset=".5"/>
            <stop offset="1" stop-opacity="0"/>
          </linearGradient>
          <path class="inspection-rail"/>
          <path class="inspection-progress"/>
          <path class="inspection-rail-glow" stroke="url(#${glowId})"/>
          <g class="inspection-nodes"></g>
          <line class="inspection-tether" y1="22" y2="22"/>
          <circle class="inspection-thumb" cy="22" r="5"/>
        </svg>
        <input type="range" aria-label="${field.label}" min="${field.min}" max="${field.max}" step="${field.step}">
      </span>`;
    field.output = row.querySelector('code span');
    field.input = row.querySelector('input');
    field.thumb = row.querySelector('.inspection-thumb');
    const slider = row.querySelector('.inspection-slider');
    const rail = slider.querySelector('.inspection-rail');
    const progress = slider.querySelector('.inspection-progress');
    const glow = slider.querySelector('.inspection-rail-glow');
    const gradient = slider.querySelector('linearGradient');
    const tether = slider.querySelector('.inspection-tether');
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
    let spring, ripple, rippleFrame;
    field.paintTrack = (now = performance.now()) => {
      let strength = 0, wave;
      if (ripple) {
        const elapsed = Math.max(0, now - ripple.started) / rippleDuration;
        if (elapsed < 1 && !reduceMotion.matches) {
          ({ strength, wave } = draftRipple(ripple.origin, elapsed));
        } else {
          ripple = null;
        }
      }
      const path = trackPath(trackEnd, wave);
      rail.setAttribute('d', path);
      glow.setAttribute('d', path);
      glow.style.opacity = strength;
      progress.setAttribute('d', trackPath(trackPosition(field, field.value), wave));
    };
    function animateTrack(now) {
      field.paintTrack(now);
      if (ripple) rippleFrame = requestAnimationFrame(animateTrack);
    }
    function respondToNode(node, from, snapped, pointerType) {
      if (pointerType !== 'mouse') navigator.vibrate?.(snapped ? 16 : 9);
      if (reduceMotion.matches) return;

      spring?.cancel();
      cancelAnimationFrame(rippleFrame);
      const to = trackPosition(field, field.value);
      spring = field.thumb.animate([
        { transform: `translateX(${from - to}px)` },
        { transform: `translateX(${(to - from) * .17}px)`, offset: .55 },
        { transform: 'none' },
      ], { duration: 180, easing: 'ease-out' });
      const started = performance.now();
      const origin = trackPosition(field, node);
      gradient.setAttribute('x1', origin - 80);
      gradient.setAttribute('x2', origin + 80);
      ripple = { origin, started };
      animateTrack(started);
    }
    const dragTo = event => {
      if (drag?.id !== event.pointerId) return;
      const { left, width } = field.input.getBoundingClientRect();
      const pointer = Math.max(trackStart, Math.min(trackEnd, (event.clientX - left) * sliderWidth / width));
      const raw = field.min + (pointer - trackStart) / trackLength * (field.max - field.min);
      const previousNode = drag.node;
      if (previousNode === undefined) {
        drag.node = field.nodes.find(value => Math.abs(pointer - trackPosition(field, value)) <= snapDistance);
      } else if (Math.abs(pointer - trackPosition(field, previousNode)) >= releaseDistance) {
        drag.node = undefined;
      }

      const attached = drag.node !== undefined;
      slider.toggleAttribute('data-snapped', attached);
      if (attached) {
        tether.setAttribute('x1', trackPosition(field, drag.node));
        tether.setAttribute('x2', pointer);
      }
      const previousValue = field.value;
      const changed = update(drag.node ?? raw);
      drag.changed ||= changed;
      if (previousNode !== drag.node && (changed || previousNode !== undefined)) {
        respondToNode(drag.node ?? previousNode, trackPosition(field, previousValue), attached, event.pointerType);
      } else if (changed) {
        spring?.cancel();
      }
    };
    slider.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      event.preventDefault();
      field.input.focus({ preventScroll: true });
      slider.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, changed: false };
      dragTo(event);
    });
    slider.addEventListener('pointermove', dragTo);
    const stopDrag = event => {
      if (drag?.id !== event.pointerId) return;
      if (event.type === 'pointerup') dragTo(event);
      const { changed } = drag;
      drag = null;
      slider.removeAttribute('data-snapped');
      if (changed) field.commit?.();
    };
    slider.addEventListener('pointerup', stopDrag);
    slider.addEventListener('lostpointercapture', stopDrag);
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
