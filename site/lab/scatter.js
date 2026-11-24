'use strict';

const WIDTH = 1280;
const HEIGHT = 800;
const { MOODS, randomFromSeed, shuffle, bounds, candidates, generate } = ScatterLayout;

function readGeometry(doc, noteVisible) {
  const art = doc.querySelector('.art').getBoundingClientRect();
  const scale = Math.min(art.width / 560, art.height / 440);
  const x = art.left + (art.width - 560 * scale) / 2;
  const y = art.top + (art.height - 440 * scale) / 2;
  const map = (px, py) => ({ x: x + px * scale, y: y + py * scale });
  const cell = 16.25 * scale;
  const origin = map(447, 132);
  const center = map(300, 259);
  const size = Math.max(4, Math.round(64 / cell)) * cell;
  const badgeSize = Math.max(2, Math.round(42 / cell)) * cell;
  const stripY = HEIGHT - 46;
  const blockers = [[143, 101, 306, 137], [278, 163, 438, 212], [404, 166, 453, 418]].map(
    ([x0, y0, x1, y1]) => ({ l: x + x0 * scale - 12, r: x + x1 * scale + 12,
      t: y + y0 * scale - 12, b: y + y1 * scale + 12 })
  );
  blockers.push(bounds(map(300, 150), 26));

  const note = doc.getElementById('soon');
  note.classList.toggle('stowed', !noteVisible);
  note.style.transform = `translate(22px, ${stripY - 14 - note.offsetHeight}px)`;
  for (const el of doc.querySelectorAll('#papers:not(.stowed), #links:not(.stowed), #want:not(.stowed), #soon:not(.stowed)')) {
    const r = el.getBoundingClientRect();
    blockers.push({ l: r.left - 10, r: r.right + 10, t: r.top - 10, b: r.bottom + 10 });
  }

  for (const line of doc.querySelectorAll('#station-paths path:not([hidden])')) {
    const length = line.getTotalLength();
    for (let distance = 0; distance < length; distance += 10) blockers.push(bounds(line.getPointAtLength(distance), 6));
  }
  const area = { l: 16, t: 10, r: WIDTH - 16, b: stripY - 10 };
  return { tiles: candidates(size, size * 0.54, cell, origin, area, blockers),
    badges: candidates(badgeSize, badgeSize / 2, cell, origin, area, blockers),
    size, badgeSize, cell, center, width: WIDTH, height: HEIGHT, tileCount: 14, badgeCount: 8 };
}

const $ = (id) => document.getElementById(id);
const mood = $('mood');
const sliders = ['steps', 'density', 'balance'];
const stage = $('stage');
const frame = $('preview');
const status = $('status');
const params = new URLSearchParams(location.search);
let seed = /^\d+$/.test(params.get('seed') ?? '') ? Number(params.get('seed')) >>> 0 : 311682107;
let doc;
let queued = 0;

function updateStageSize() {
  const zoom = stage.clientWidth / WIDTH;
  frame.style.transform = `scale(${zoom})`;
}
new ResizeObserver(updateStageSize).observe(stage);

function placeElement(el, point, size, tilt = 0) {
  el.style.width = el.style.height = `${size}px`;
  el.style.transform = `translate(${point.x - size / 2}px, ${point.y - size / 2}px) rotate(${tilt}deg)`;
  el.classList.remove('stowed');
}

function draw() {
  const settings = { mood: mood.value };
  for (const key of sliders) {
    settings[key] = $(key).valueAsNumber;
    const suffix = key === 'steps' ? '' : '%';
    $(`${key}-value`).value = `${settings[key]}${suffix}`;
    $(key).disabled = mood.value === 'ring' && key !== 'balance';
  }
  if (!doc) return;

  const allTiles = [...doc.querySelectorAll('.tile')];
  const allBadges = [...doc.querySelectorAll('.ai')];
  const hub = doc.querySelector('.tile[data-task="agents"]');
  const artworkRandom = randomFromSeed(seed ^ 0xa3719a5d);
  const tiles = [hub, ...shuffle(allTiles.filter((tile) => tile !== hub), artworkRandom).slice(0, 13)];
  const badges = shuffle(allBadges, artworkRandom).slice(0, 8);
  const geometry = readGeometry(doc, badges.some((badge) => badge.classList.contains('soon')));
  const result = generate(geometry, settings, seed);

  const wires = doc.getElementById('ai-links');
  wires.replaceChildren();
  for (const el of [...allTiles, ...allBadges]) el.classList.add('stowed');
  if (!result) {
    status.textContent = `Seed ${seed} · unable to fit the layout`;
    return;
  }

  for (const [i, tile] of tiles.entries()) {
    placeElement(tile, result.points[i], geometry.size, (artworkRandom() - 0.5) * 9);
  }
  for (const [i, badge] of badges.entries()) {
    const point = result.badges[i];
    placeElement(badge, point, geometry.badgeSize);
    const wire = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    wire.setAttribute('class', 'plug');
    wire.setAttribute('d', `M ${result.points[0].x} ${result.points[0].y} L ${point.x} ${point.y}`);
    wires.append(wire);
  }
  status.textContent = `Seed ${seed} · ${WIDTH} × ${HEIGHT} · visual center offset ${result.offset.toFixed(1)}%`
    + (result.balanced ? '' : ' · closest layout within 40 attempts');
}

function scheduleDraw() {
  cancelAnimationFrame(queued);
  queued = requestAnimationFrame(draw);
}

function setMood(value) {
  mood.value = Object.hasOwn(MOODS, value) ? value : 'loose';
  for (const key of sliders) $(key).value = MOODS[mood.value][key];
  scheduleDraw();
}

mood.addEventListener('change', () => setMood(mood.value));
for (const key of sliders) $(key).addEventListener('input', scheduleDraw);
$('new-seed').addEventListener('click', () => {
  seed = crypto.getRandomValues(new Uint32Array(1))[0];
  scheduleDraw();
});
document.querySelector('form').addEventListener('submit', (event) => event.preventDefault());
setMood(params.get('mood'));

function preparePreview() {
  try {
    const preview = frame.contentDocument;
    if (!preview) throw new Error('The preview requires a same-origin page.');
    if (preview === doc) return;
    const app = preview.getElementById('app');
    if (!app) throw new Error('The home page preview did not load.');
    const style = preview.createElement('style');
    style.textContent = '#app, #app * { transition: none !important; animation: none !important; }';
    preview.head.append(style);
    // Enter the site's real peek state without updating its hint preference or starting its demo.
    frame.contentWindow.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { key: 'Alt' }));
    if (!app.classList.contains('is-on') || !preview.querySelector('.ai')) throw new Error('The x-ray did not initialize.');
    doc = preview;
    scheduleDraw();
  } catch (error) {
    status.textContent = location.protocol === 'file:'
      ? 'Open the lab through the site’s HTTP server to load the x-ray preview.'
      : error.message;
  }
}

frame.addEventListener('load', preparePreview);
if (frame.contentDocument?.getElementById('app') && frame.contentDocument.readyState === 'complete') preparePreview();
