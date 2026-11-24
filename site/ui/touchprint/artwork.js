/*!
 * Fingerprint geometry from andrsrxn/icons (MIT).
 * https://github.com/andrsrxn/icons
 *
 * MIT License
 *
 * Copyright (c) 2026 Andrés Raxón (andrsrxn)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const ridges = [
  { d: 'M3.7 21.11C3 18.02 2.2 11.63 5.35 7.94a8.73 8.73 0 0 1 13.73.74c3.48 5 3.86 9.47 2.29 11.27c-1.23 1.4-4.37 1.73-5.36-1.2s-1.47-7.37-4.85-6.7c-4 .8-1.28 8.55-.29 10.04', i: 0, dur: '--dur:520ms' },
  { d: 'M11.98 15.68c.26 1.47 1.47 5.16 2.56 6.43', i: 1 },
  { d: 'M6.3 14.24c-.15 1.48-.22 4.95.63 7', i: 2 },
  { d: 'M20.18 4.98a8.7 8.7 0 0 0-5.02-2.88', i: 3 },
  { d: 'M11.35 1.66c-3.99 0-7.98 2.85-9.64 5.9', i: 4 },
  { d: 'M19.1 17.85c-.24-1.82-1.17-5.63-3.15-7.73c-2.47-2.63-6.68-2.3-8.84.9', i: 5 },
];

/** Fingerprint on a 24x24 grid, centred on the contact point at (12, 12).
 * The echo repeats the whole print, so the press radiates a fingerprint shape.
 * The dot is the contact point: it pops first and fades as the ink settles. */
export const touchprintArtwork = `
  <g class="echo" aria-hidden="true">
    ${ridges.map(({ d }) => `<path d="${d}" />`).join('\n    ')}
  </g>
  ${ridges.map(({ d, i, dur }) => `<path class="ridge" pathLength="1" style="--i:${i}${dur ? `;${dur}` : ''}" d="${d}" />`).join('\n  ')}
  <circle class="core" cx="12" cy="12" r="1.3" />
`;

/** The same print without the contact animation, for a static control. */
export const touchprintGlyph = ridges.map(({ d }) => `<path d="${d}" />`).join('');
