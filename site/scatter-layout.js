const ScatterLayout = (() => {
  'use strict';

  const MOODS = {
    loose: { steps: 2, density: 25, balance: 9 },
    swarm: { steps: 1, density: 90, balance: 10 },
    drift: { steps: 1, density: 85, balance: 9 },
    ring: { steps: 0, density: 0, balance: 9 }
  };

  function randomFromSeed(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let bits = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      bits ^= bits + Math.imul(bits ^ (bits >>> 7), 61 | bits);
      return ((bits ^ (bits >>> 14)) >>> 0) / 2 ** 32;
    };
  }

  function shuffle(items, random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const intersects = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const bounds = (point, half) => ({ l: point.x - half, r: point.x + half, t: point.y - half, b: point.y + half });

  function lowestScore(items, score) {
    let best, bestScore = Infinity;
    for (const item of items) {
      const value = score(item);
      if (value < bestScore) {
        best = item;
        bestScore = value;
      }
    }
    return best;
  }

  function densityField(mood, strength, random, width, height) {
    const direction = random() < 0.5 ? -1 : 1;
    const attractor = { x: width * (0.5 + direction * 0.25), y: height * (0.22 + random() * 0.50) };
    const tilt = random() < 0.5 ? -1 : 1;
    return (point) => {
      const x = (point.x - width / 2) / width;
      const y = (point.y - height / 2) / height;
      if (mood === 'drift') {
        const diagonal = y - tilt * 0.85 * x - (attractor.y / height - 0.5) * 0.45;
        return 1 + strength * (4 * Math.exp(-(diagonal ** 2) / 0.018) + direction * x);
      }
      const radius = mood === 'swarm' ? 170 : 255;
      const hill = Math.exp(-distanceSquared(point, attractor) / radius ** 2);
      return 1 + strength * (mood === 'swarm' ? 10 : 3) * hill;
    };
  }

  // Reassign free samples to their nearest tile, then move partway to each
  // weighted Voronoi centroid. Snap each move back to a legal paper position.
  function relax(points, samples, candidates, isClear, steps) {
    for (let step = 0; step < steps; step++) {
      const cells = points.map(() => ({ x: 0, y: 0, mass: 0 }));
      for (const sample of samples) {
        const nearest = lowestScore(points, (point) => distanceSquared(point, sample));
        const cell = cells[points.indexOf(nearest)];
        cell.x += sample.x * sample.weight;
        cell.y += sample.y * sample.weight;
        cell.mass += sample.weight;
      }
      for (const [i, cell] of cells.entries()) {
        if (!cell.mass) continue;
        const current = points[i];
        const target = { x: current.x * 0.55 + 0.45 * cell.x / cell.mass, y: current.y * 0.55 + 0.45 * cell.y / cell.mass };
        points[i] = lowestScore(candidates, (point) => (
          points.every((other, j) => j === i || isClear(point, other)) ? distanceSquared(point, target) : Infinity
        )) ?? current;
      }
    }
  }

  function generate(geometry, settings, seed) {
    const { tiles, badges, size, badgeSize, cell, center, tileCount, badgeCount, width, height } = geometry;
    const { mood, density, steps, balance } = settings;
    const random = randomFromSeed(seed);
    const weight = densityField(mood, density / 100, random, width, height);
    const badgeWeight = 0.55 * (badgeSize / size) ** 2;

    // Angled tile corners fit inside a square padded by the maximum 4.5° tilt.
    const tileHalf = size * 0.54;
    const badgeHalf = badgeSize / 2;
    const gap = cell * 0.45;
    const tileSpacing = tileHalf * 2 + gap;
    const spacingScale = Math.min(1.55, width / 520, height / 440);
    const minimumDistanceSquared = (size * spacingScale) ** 2;
    const isClear = (a, b) => (Math.abs(a.x - b.x) >= tileSpacing || Math.abs(a.y - b.y) >= tileSpacing)
      && distanceSquared(a, b) >= minimumDistanceSquared;

    if (!tiles.length || !badges.length) return;

    let best;
    for (let attempt = 0; attempt < 40; attempt++) {
      // Reserve room for the badges first so the apparent weight of the entire
      // cluster is included in the balance calculation.
      const hub = tiles[Math.floor(random() * tiles.length)];
      const phase = random() * 2 * Math.PI;
      const orbit = size * 1.55;
      const nearby = badges.filter((point) => distanceSquared(point, hub) <= (size * 2.45) ** 2
        && !intersects(bounds(point, badgeHalf + gap), bounds(hub, tileHalf)));
      const hubBadges = [];
      for (let i = 0; i < badgeCount; i++) {
        const angle = phase + (i + (random() - 0.5) * 0.55) * 2 * Math.PI / badgeCount;
        const target = { x: hub.x + orbit * Math.cos(angle), y: hub.y + orbit * Math.sin(angle) };
        const point = lowestScore(nearby, (candidate) => {
          const rect = bounds(candidate, badgeHalf + gap);
          if (hubBadges.some((other) => intersects(rect, bounds(other, badgeHalf)))) return Infinity;
          return distanceSquared(candidate, target);
        });
        if (!point) break;
        hubBadges.push(point);
      }
      if (hubBadges.length !== badgeCount) continue;

      const free = tiles.filter((point) => isClear(point, hub) && hubBadges.every((badge) => (
        !intersects(bounds(point, tileHalf + gap), bounds(badge, badgeHalf))
      )));
      const points = [];
      if (mood === 'ring') {
        for (let i = 0; i < tileCount - 1; i++) {
          const angle = phase + (i + (random() - 0.5) * 0.7) * 2 * Math.PI / (tileCount - 1);
          const target = { x: center.x + width * 0.33 * Math.cos(angle), y: center.y + height * 0.34 * Math.sin(angle) };
          const point = lowestScore(free, (candidate) => (
            points.every((other) => isClear(candidate, other)) ? distanceSquared(candidate, target) : Infinity
          ));
          if (point) points.push(point);
        }
      } else {
        // Weighted random ordering followed by minimum-distance rejection.
        const ranked = free.map((point) => ({ point, rank: -Math.log(1 - random()) / weight(point) }));
        ranked.sort((a, b) => a.rank - b.rank);
        for (const { point } of ranked) {
          if (points.every((other) => isClear(point, other))) points.push(point);
          if (points.length === tileCount - 1) break;
        }
        if (steps) {
          const samples = free.filter((point) => point.sample)
            .map((point) => ({ ...point, weight: weight(point) }));
          relax(points, samples, free, isClear, steps);
        }
      }
      if (points.length !== tileCount - 1) continue;

      const left = [hub, ...points].filter((point) => point.x < center.x).length
        + badgeWeight * hubBadges.filter((point) => point.x < center.x).length;
      const mass = tileCount + badgeWeight * badgeCount;
      const total = (axis) => points.reduce((sum, point) => sum + point[axis], hub[axis])
        + badgeWeight * hubBadges.reduce((sum, badge) => sum + badge[axis], 0);
      const offset = 100 * Math.hypot((total('x') / mass - center.x) / width, (total('y') / mass - center.y) / height);
      // A compact cluster centred on the split can pass the centroid test.
      // Require some weight in both outer thirds, without prescribing a mirror.
      const outer = (side) => [hub, ...points].some((point) => side * (point.x - width / 2) > width / 6);
      const coverage = Math.min(left, mass - left) >= mass * 0.26 && outer(-1) && outer(1);
      const score = offset + (coverage ? 0 : 100);
      const result = { points: [hub, ...points], badges: hubBadges, offset, score, balanced: coverage && offset <= balance };
      if (result.balanced) return result;
      if (!best || score < best.score) best = result;
    }
    return best;
  }

  // The top-left corner snaps to the paper ruling. Include the padding used
  // by the visual bounds when checking the page edges and the reserved ink.
  function candidates(size, half, cell, origin, area, blockers, stride = 1) {
    const points = [];
    const firstCol = Math.ceil((area.l + half - size / 2 - origin.x) / (cell * stride)) * stride;
    const firstRow = Math.ceil((area.t + half - size / 2 - origin.y) / (cell * stride)) * stride;
    for (let col = firstCol; ; col += stride) {
      const x = origin.x + col * cell + size / 2;
      if (x + half > area.r) break;
      const columnBlockers = blockers.filter((rect) => x - half < rect.r && x + half > rect.l);
      for (let row = firstRow; ; row += stride) {
        const y = origin.y + row * cell + size / 2;
        if (y + half > area.b) break;
        if (!columnBlockers.some((rect) => y - half < rect.b && y + half > rect.t)) {
          points.push({ x, y, sample: col % (2 * stride) === 0 && row % (2 * stride) === 0 });
        }
      }
    }
    return points;
  }

  return { MOODS, randomFromSeed, shuffle, bounds, candidates, generate };
})();
