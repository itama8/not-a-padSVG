const letters = 'qwertyuiopasdfghjklzxcvbnm';
const symbolPages = {
  symbols: Array.from('1234567890' + '@#₹_&-+()' + "*\"':;!?"),
  moreSymbols: Array.from('~`|•√π÷×§Δ' + '€¥$¢^°={}' + '%©®™✓[]'),
};
const emoji = Array.from('😀😃😄😁😅😂🙂🙃😉😊😍😎🤔😮😢😴😬😐🙄😇👍👎👏🙌🎉🔥');
const letterKeys = new Map(Array.from(letters, (letter, index) => {
  const upper = letter.toUpperCase();
  return [`Key${upper}`, { letter, upper, index }];
}));
const fixedKeys = new Map([['Enter', '\n'], ['Space', ' ']]);
const shiftDoubleTapMs = 300;

export function createPhoneKeyboardTyping() {
  let mode = 'letters';
  let shift = 'off';
  let lastShiftTap = -Infinity;
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  function keyValue(id) {
    if (id === 'Comma') return mode === 'moreSymbols' ? '<' : ',';
    if (id === 'Period') return mode === 'moreSymbols' ? '>' : '.';
    if (id === 'SymbolExtra') {
      if (mode === 'symbols') return '/';
      if (mode === 'moreSymbols') return '\\';
    }
    const key = letterKeys.get(id);
    if (!key) return undefined;
    if (symbolPages[mode]) return symbolPages[mode][key.index];
    if (mode === 'emoji') return emoji[key.index];
    return shift === 'off' ? key.letter : key.upper;
  }

  function resetShiftTap() {
    lastShiftTap = -Infinity;
  }

  function activate(id, { value, start, end }, { held = false, alternate, now = performance.now() } = {}) {
    if (id === 'Shift') {
      if (symbolPages[mode]) {
        mode = mode === 'symbols' ? 'moreSymbols' : 'symbols';
      } else if (mode === 'letters') {
        if (shift === 'off') {
          shift = 'once';
          lastShiftTap = now;
        } else {
          shift = shift === 'once' && now - lastShiftTap <= shiftDoubleTapMs ? 'locked' : 'off';
          resetShiftTap();
        }
      }
      return;
    }
    resetShiftTap();
    if (id === 'Symbols' || id === 'Emoji') {
      if (id === 'Symbols') mode = symbolPages[mode] ? 'letters' : 'symbols';
      else mode = mode === 'emoji' ? 'letters' : 'emoji';
      if (shift === 'once') shift = 'off';
      return;
    }
    if (id === 'Backspace') {
      const previous = start > 0 ? segmenter.segment(value).containing(start - 1).index : 0;
      return { type: 'replace', text: '', start: start === end ? previous : start, end };
    }

    const glyph = keyValue(id);
    const text = fixedKeys.get(id) ?? (held ? alternate : glyph);
    if (text === undefined) return;
    if (symbolPages[mode] && glyph !== undefined && !/^[0-9]$/.test(glyph)) mode = 'letters';
    if (shift === 'once' && letterKeys.has(id)) shift = 'off';
    return { type: 'replace', text, start, end };
  }

  return {
    get mode() { return mode; },
    get shift() { return shift; },
    get isSymbols() { return Boolean(symbolPages[mode]); },
    keyValue,
    resetShiftTap,
    supportsHold: (id, alternate) => id === 'Backspace' || (mode === 'letters' && Boolean(alternate)),
    activate,
  };
}
