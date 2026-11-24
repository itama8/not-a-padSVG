/** @type {import('../preview-tile.js').PreviewTileDefinition & {
 *   defaultArtwork: string,
 *   artworkLabels: Record<string, string>,
 * }} */
export const budgeting = {
  id: 'budget',
  label: 'Budgeting',
  status: 'concept',
  defaultArtwork: 'payday-split',
  artworkLabels: {
    'payday-split': 'Payday split',
    'ring-and-coins': 'Ring and coins',
  },
};
