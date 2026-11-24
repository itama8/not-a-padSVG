import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createPhoneKeyboardTyping } from '../site/ui/phone-keyboard/typing.js';

const selection = { value: 'abc', start: 1, end: 2 };

test('keyboard modes and Shift determine the next key value', () => {
  const typing = createPhoneKeyboardTyping();
  typing.activate('Shift', selection);
  assert.equal(typing.letterValue('KeyQ'), 'Q');
  assert.deepEqual(typing.activate('KeyQ', selection), {
    type: 'replace', text: 'Q', start: 1, end: 2,
  });
  assert.equal(typing.letterValue('KeyQ'), 'q');
  assert.equal(typing.supportsHold('KeyQ', '1'), true);
  assert.equal(typing.activate('KeyQ', selection, { held: true, alternate: '1' }).text, '1');

  typing.activate('Symbols', selection);
  assert.equal(typing.letterValue('KeyQ'), '1');
  assert.equal(typing.supportsHold('KeyQ', '1'), false);
  typing.activate('Emoji', selection);
  assert.equal(typing.letterValue('KeyQ'), '😀');
  assert.equal(createPhoneKeyboardTyping().mode, 'letters');
});

test('Backspace deletes a selection or a whole grapheme, and Enter adds a line', () => {
  const typing = createPhoneKeyboardTyping();
  assert.deepEqual(typing.activate('Backspace', selection), {
    type: 'replace', text: '', start: 1, end: 2,
  });
  const value = 'x👨‍👩‍👧‍👦';
  assert.deepEqual(typing.activate('Backspace', { value, start: value.length, end: value.length }), {
    type: 'replace', text: '', start: 1, end: value.length,
  });
  assert.equal(typing.supportsHold('Backspace'), true);
  assert.equal(typing.supportsHold('Enter'), false);
  assert.deepEqual(typing.activate('Enter', selection), {
    type: 'replace', text: '\n', start: 1, end: 2,
  });
});

test('the exported keyboard is a self-contained module with the public entry points', async () => {
  const script = fileURLToPath(new URL('../scripts/export-phone-keyboard.py', import.meta.url));
  const source = execFileSync('python3', [script]);
  assert.match(source.toString(), /const embeddedArtwork = "[^"]*<svg/);
  const keyboard = await import(`data:text/javascript;base64,${source.toString('base64')}`);
  assert.deepEqual(Object.keys(keyboard).sort(), [
    'mountPhoneKeyboard', 'phoneKeyboardMotion', 'phoneKeyboardVersion',
  ]);
  assert.equal(typeof keyboard.mountPhoneKeyboard, 'function');
});
