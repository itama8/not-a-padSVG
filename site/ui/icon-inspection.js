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

// Keep the control, frame, and icon artwork independent of its SVG edits.
export function createIconFields(control) {
  const keyboard = control.dataset.experiment === 'phone-keyboard';
  const artwork = control.querySelector('svg');
  const decoration = '.frame, .ring, .tile-hatch, .tile-glow, defs, title, desc';
  const content = [...artwork.children].filter(node =>
    !node.matches(decoration) && !(node.childElementCount === 1 && node.firstElementChild.matches('.frame')));
  let group = artwork;
  if (!keyboard && content.length) {
    group = document.createElementNS(svgNS, 'g');
    group.classList.add('inspection-artwork');
    content[0].before(group);
    group.append(...content);
  }

  let size = 1, tilt = 0, stretch = 1;
  const render = () => {
    const transform = `scale(${size}) rotate(${tilt}deg) scaleX(${stretch})`;
    if (keyboard) control.style.setProperty('--inspection-transform', transform);
    else group.style.transform = transform;
  };
  return [
    { label: 'Scale', initial: 1, min: .5, max: 1.5, step: .01, keyboardStep: .05, nodes: [.75, 1, 1.25],
      source: value => `scale(${value})`, apply: value => { size = value; render(); } },
    { label: 'Tilt', initial: 0, min: -40, max: 40, step: 1, keyboardStep: 5, nodes: [-25, 0, 25],
      source: value => `rotate(${value}deg)`, apply: value => { tilt = value; render(); } },
    { label: 'Stretch', initial: 1, min: .6, max: 1.4, step: .01, keyboardStep: .05, nodes: [.75, 1, 1.25],
      source: value => `scaleX(${value})`, apply: value => { stretch = value; render(); } },
  ];
}

export function mountIconInspection(panel) {
  const source = panel.querySelector('.inspection-source');
  const views = new WeakMap();
  let active;
  panel.querySelector('.inspection-reset').addEventListener('click', () => active?.reset());

  return {
    show(fields) {
      let view = views.get(fields);
      if (!view) {
        const rows = document.createElement('div');
        view = { rows, ...mountSliders(rows, fields) };
        views.set(fields, view);
      }
      if (active !== view) {
        active?.suspend();
        source.replaceChildren(view.rows);
      }
      active = view;
    },
    close() {
      active?.suspend();
      source.replaceChildren();
      active = null;
    },
  };
}

let nextGlowId = 0;
function mountSliders(source, fields) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function render(field, value) {
    field.value = value;
    field.input.value = value;
    field.input.setAttribute('aria-valuetext', field.unit ? `${value} ${field.unit}` : String(value));
    field.output.textContent = field.source(value);
    field.thumb.setAttribute('cx', trackPosition(field, value));
    field.paintTrack();
  }

  for (const field of fields) {
    const row = document.createElement('div');
    row.className = 'inspection-row';
    const glowId = `inspection-slider-glow-${nextGlowId++}`;
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
    field.suspend = () => {
      spring?.cancel();
      cancelAnimationFrame(rippleFrame);
      ripple = null;
      const pointerId = drag?.id;
      drag = null;
      slider.removeAttribute('data-snapped');
      if (pointerId !== undefined && slider.hasPointerCapture(pointerId)) slider.releasePointerCapture(pointerId);
      field.paintTrack();
    };
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

  return {
    reset() {
      for (const field of fields) {
        field.suspend();
        render(field, field.initial);
        if (field.reset) field.reset();
        else field.apply(field.initial);
      }
    },
    suspend() {
      for (const field of fields) field.suspend();
    },
  };
}
