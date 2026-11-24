const letters = 'qwertyuiopasdfghjklzxcvbnm';
const symbols = Array.from('1234567890@#$%&-+()!?/:;₹=');
const emoji = Array.from('😀😃😄😁😅😂🙂🙃😉😊😍😎🤔😮😢😴😬😐🙄😇👍👎👏🙌🎉🔥');
const letterKeys = new Map(Array.from(letters, (letter, index) => {
  const upper = letter.toUpperCase();
  return [`Key${upper}`, { letter, upper, symbol: symbols[index], emoji: emoji[index] }];
}));
const fixedKeys = new Map([['Enter', '\n'], ['Space', ' '], ['Period', '.'], ['Comma', ',']]);

export function createPhoneKeyboardTyping() {
  let mode = 'letters';
  let shift = false;
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  function letterValue(id) {
    const key = letterKeys.get(id);
    if (!key) return undefined;
    if (mode === 'symbols') return key.symbol;
    if (mode === 'emoji') return key.emoji;
    return shift ? key.upper : key.letter;
  }

  function activate(id, { value, start, end }, { held = false, alternate } = {}) {
    if (id === 'Shift') {
      shift = mode === 'letters' && !shift;
      return;
    }
    if (id === 'Symbols' || id === 'Emoji') {
      const target = id.toLowerCase();
      mode = mode === target ? 'letters' : target;
      shift = false;
      return;
    }
    if (id === 'Backspace') {
      const previous = start > 0 ? segmenter.segment(value).containing(start - 1).index : 0;
      return { type: 'replace', text: '', start: start === end ? previous : start, end };
    }

    const letter = letterValue(id);
    const text = fixedKeys.get(id) ?? (held ? alternate : letter);
    if (text === undefined) return;
    if (letter !== undefined) shift = false;
    return { type: 'replace', text, start, end };
  }

  return {
    get mode() { return mode; },
    get shift() { return shift; },
    letterValue,
    supportsHold: (id, alternate) => id === 'Backspace' || (mode === 'letters' && Boolean(alternate)),
    activate,
  };
}
