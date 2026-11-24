# Lab conventions

The case: the old labs were four one-off pages. `tiles.html` was a 60KB file
with every SVG pasted twice (108px + 54px) and 300 lines of showcase CSS
copied into it, so adding a tile meant four coordinated edits. The keyboard
labs had 34px controls and no statement of what was under test. The scatter
lab's sliders had no explanation of what good looks like. Nothing linked the
labs together.

## The shape

- `lab.css` — one shell: breadcrumbs, header (`lab-head`, `lab-lede`),
  controls (`lab-controls` with 44px targets), status (`lab-status`), stage
  (`lab-stage`), cards (`lab-grid`, `lab-card`), index list (`lab-index`).
  Page-specific motion and artwork stay out of it.
- `lab.js` — shared helpers, no build step: `bindSchemeToggle`,
  `loopTiles`, `announce`, `loadPref`/`savePref`. Labs differ only in the
  controls their experiment needs.
- `index.html` — the lab directory. Every lab states what it tests, what to
  try, and what good looks like, in the page as well as in the index.
- `tiles.html` — data-driven: one `SECTIONS` array (title, blurb, one SVG
  string per card). The shell renders both sizes, the frame, replay-on-tap,
  and the loop. Budgeting, Pets Walks, Inventory, and AI Agents use declarations,
  artwork, and motion from `site/ui/`. The lab and showcase also share the base
  tile stylesheet. One-off concepts keep their SVG in the page until they earn
  a home in `site/ui/`.

## Rules for a new lab

1. Link `lab.css`; copy the crumb/head/lede/controls skeleton from the
   smallest matching lab.
2. Put controls for the experiment in `lab-controls` (global) or beside the
   section they affect (e.g. the currency picker lives in Budgeting).
   Every control keeps a real `<label>`, 44px minimum, and a hint line that
   says what good looks like.
3. Keep artwork swappable and activation on semantic buttons (per `AGENTS.md`).
   The page owns layout and orchestration; reusable pieces move to `site/ui/`.
4. Add the lab to `index.html` with the same three lines: tests / try / good.
5. Reusable behavior goes in `lab.js`; page-only motion stays in the page.

## Callers and assets affected

- `tiles.html` (rewritten, ~49KB → data + renderer; same artwork and motion),
  `scatter.html`, `keyboard.html`, `keyboard-motion.html` (shell + lede +
  44px controls; behavior unchanged).
- New: `lab.css`, `lab.js`, `index.html` (this README's proposal).
- Untouched: `scatter.js` (same control IDs), `site/ui/*`, `site/index.html`.
