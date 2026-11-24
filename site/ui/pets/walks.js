/** @type {import('../preview-tile.js').PreviewTileDefinition} */
export const pets = {
  id: 'pets',
  label: 'Keeping track of your pets: their walks',
  status: 'concept',
};

export const walksArtwork = `
  <path class="b pen" d="M 6 41 C 14 34 8 26 18 23 S 32 20 36 8" />
  <circle class="b pen" cx="36" cy="8" r="2.6" />
  <g class="pop">
    <g class="paw-step" style="--ad:.1s" transform="translate(10.5 36.5) rotate(40)"><ellipse class="gf" cx="0" cy="1" rx="2.1" ry="1.7" /><circle class="gf" cx="-1.6" cy="-1.8" r=".9" /><circle class="gf" cx="0" cy="-2.5" r=".9" /><circle class="gf" cx="1.6" cy="-1.8" r=".9" /></g>
    <g class="paw-step" style="--ad:.4s" transform="translate(16 28) rotate(10)"><ellipse class="gf" cx="0" cy="1" rx="2.1" ry="1.7" /><circle class="gf" cx="-1.6" cy="-1.8" r=".9" /><circle class="gf" cx="0" cy="-2.5" r=".9" /><circle class="gf" cx="1.6" cy="-1.8" r=".9" /></g>
    <g class="paw-step" style="--ad:.7s" transform="translate(25 17.5) rotate(60)"><ellipse class="gf" cx="0" cy="1" rx="2.1" ry="1.7" /><circle class="gf" cx="-1.6" cy="-1.8" r=".9" /><circle class="gf" cx="0" cy="-2.5" r=".9" /><circle class="gf" cx="1.6" cy="-1.8" r=".9" /></g>
    <g class="paw-step" style="--ad:1s" transform="translate(35 17) rotate(25)"><ellipse class="gf" cx="0" cy="1" rx="2.1" ry="1.7" /><circle class="gf" cx="-1.6" cy="-1.8" r=".9" /><circle class="gf" cx="0" cy="-2.5" r=".9" /><circle class="gf" cx="1.6" cy="-1.8" r=".9" /></g>
  </g>
  <path class="g fx tick" pathLength="1" style="--ad:1.3s" d="M 40 4 l 1.6 1.7 l 3.4 -4" />`;
