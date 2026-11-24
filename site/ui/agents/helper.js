/** @type {import('../preview-tile.js').PreviewTileDefinition} */
export const agents = {
  id: 'agents',
  label: 'AI agents: a helper reads your note and does it',
  status: 'concept',
};

export const helperArtwork = `
  <path class="g pen" d="M 24 10 V 5.5" />
  <circle class="g pen helper-antenna" cx="24" cy="3.6" r="1.9" />
  <rect class="g pen" x="11" y="10" width="26" height="21" rx="6" />
  <g class="pop"><g class="helper-eyes"><circle class="gf" cx="19" cy="19" r="2.1" /><circle class="gf" cx="29" cy="19" r="2.1" /></g></g>
  <path class="g pen helper-smile" d="M 20.5 25 Q 24 27.5 27.5 25" />
  <path class="b pen" d="M 7 40 c 3 -2 5 2 8 0 s 5 -2 8 0 s 4 -1.6 7 0" />
  <path class="g fx tick" pathLength="1" style="--ad:1.05s" d="M 34 40 l 1.8 1.9 l 4 -4.6" />`;
