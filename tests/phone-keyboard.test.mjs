import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createPhoneKeyboardTyping } from '../site/ui/phone-keyboard/typing.js';

const selection = { value: 'abc', start: 1, end: 2 };

test('keyboard modes and Shift determine the next key value', () => {
  const typing = createPhoneKeyboardTyping();
  typing.activate('Shift', selection);
  assert.equal(typing.keyValue('KeyQ'), 'Q');
  assert.deepEqual(typing.activate('KeyQ', selection), {
    type: 'replace', text: 'Q', start: 1, end: 2,
  });
  assert.equal(typing.keyValue('KeyQ'), 'q');
  assert.equal(typing.supportsHold('KeyQ', '1'), true);
  assert.equal(typing.activate('KeyQ', selection, { held: true, alternate: '1' }).text, '1');

  typing.activate('Symbols', selection);
  assert.equal(typing.keyValue('KeyQ'), '1');
  assert.equal(typing.supportsHold('KeyQ', '1'), false);
  typing.activate('Emoji', selection);
  assert.equal(typing.keyValue('KeyQ'), '😀');
  assert.equal(createPhoneKeyboardTyping().mode, 'letters');
});

test('rapid Shift taps lock capitals until Shift is tapped again', () => {
  const typing = createPhoneKeyboardTyping();
  const shift = now => typing.activate('Shift', selection, { now });
  shift(0);
  shift(301);
  assert.equal(typing.shift, 'off');

  shift(500);
  shift(650);
  assert.equal(typing.shift, 'locked');
  assert.equal(typing.activate('KeyA', selection).text, 'A');
  assert.equal(typing.activate('KeyB', selection).text, 'B');
  typing.activate('Symbols', selection);
  assert.equal(typing.activate('KeyA', selection).text, '@');
  assert.equal(typing.activate('KeyC', selection).text, 'C');
  shift(900);
  assert.equal(typing.activate('KeyD', selection).text, 'd');
});

test('both symbol pages have the reference key order and return to letters on insertion', () => {
  const typing = createPhoneKeyboardTyping();
  const activate = id => typing.activate(id, selection);
  const row = ids => Array.from(ids, letter => typing.keyValue('Key' + letter)).join('');
  activate('Symbols');
  assert.equal(row('QWERTYUIOP'), '1234567890');
  assert.equal(row('ASDFGHJKL') + typing.keyValue('SymbolExtra'), '@#₹_&-+()/');
  assert.equal(row('ZXCVBNM'), '*"\x27:;!?');
  assert.equal(activate('Space').text, ' ');
  assert.equal(activate('Enter').text, '\n');
  activate('Backspace');
  assert.equal(typing.mode, 'symbols');

  activate('Shift');
  assert.equal(row('QWERTYUIOP'), '~`|•√π÷×§Δ');
  assert.equal(row('ASDFGHJKL') + typing.keyValue('SymbolExtra'), '€¥$¢^°={}\\');
  assert.equal(row('ZXCVBNM'), '%©®™✓[]');
  assert.equal(typing.keyValue('Period'), '>');
  assert.deepEqual(activate('Comma'), { type: 'replace', text: '<', start: 1, end: 2 });
  assert.equal(typing.mode, 'letters');

  activate('Symbols');
  activate('Shift');
  activate('Shift');
  assert.equal(activate('SymbolExtra').text, '/');
  assert.equal(typing.mode, 'letters');
  assert.equal(typing.keyValue('SymbolExtra'), undefined);
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
