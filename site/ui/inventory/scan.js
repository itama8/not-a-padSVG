/** @type {import('../preview-tile.js').PreviewTileDefinition} */
export const inventory = {
  id: 'inventory',
  label: 'Inventory: scan things in and they are counted',
  status: 'concept',
};

export const scanArtwork = `
  <rect class="g pen" x="5" y="12" width="26" height="28" rx="1.5" />
  <path class="g pen" d="M 5 18 H 31 M 18 12 V 18" />
  <g class="pop"><path class="gf" d="M 10 24 h 1.4 v 10 h -1.4 Z M 12.6 24 h .8 v 10 h -.8 Z M 14.6 24 h 2 v 10 h -2 Z M 17.8 24 h .8 v 10 h -.8 Z M 19.8 24 h 1.4 v 10 h -1.4 Z M 22.4 24 h .8 v 10 h -.8 Z M 24.4 24 h 1.6 v 10 h -1.6 Z" /></g>
  <g class="inventory-beam"><path class="b" style="stroke-width:1.4" d="M 7 23 H 29" /></g>
  <path class="b pen" d="M 37 14 V 21 M 40 14 V 21 M 43 14 V 21" />
  <path class="b fx tick" pathLength="1" style="--ad:1s" d="M 37 27 V 34" />`;
