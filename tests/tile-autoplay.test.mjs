import assert from 'node:assert/strict';
import test from 'node:test';
import { loopTiles } from '../site/lab/lab.js';

test('stopping autoplay before its first replay cancels both timers', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const play = t.mock.fn();
  const stop = loopTiles(['pets'], play, { firstDelay: 10, interval: 30 });

  stop();
  t.mock.timers.tick(60);

  assert.equal(play.mock.callCount(), 0);
});

test('restarting autoplay leaves only the new replay schedule active', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const played = [];
  const play = tile => played.push(tile);
  const stopOld = loopTiles(['old'], play, { firstDelay: 10, interval: 30 });
  t.mock.timers.tick(5);
  stopOld();

  const stopNew = loopTiles(['new'], play, { firstDelay: 10, interval: 30 });
  t.mock.timers.tick(5);
  assert.deepEqual(played, []);
  t.mock.timers.tick(5);
  assert.deepEqual(played, ['new']);
  t.mock.timers.tick(20);
  assert.deepEqual(played, ['new', 'new']);
  stopNew();
  t.mock.timers.tick(30);
  assert.deepEqual(played, ['new', 'new']);
});
