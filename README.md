# not-a-padSVG

not-a-padSVG is my personal site and a workshop for building a composable SVG
UI library. It's a home for my writing, short updates, videos, tools, and
experiments.

The workshop is inspired by Pasquale Vitiello’s
[Plotter project](https://plotter.pasqualevitiello.com)
([source repository](https://github.com/pasqualevitiello/plotter)). Small,
self-contained experiments develop one interaction at a time. The notepad
and its X-Ray layer showcase that work. As experiments mature, their SVG
artwork, rendering, behavior, and component declarations become pieces we
can reuse across the site and in other apps.

Open the [development showcase](https://itama8.github.io/not-a-padSVG/dev/) and
press Alt on desktop or tap anywhere on touch screen device for X-Ray.
The [labs](https://itama8.github.io/not-a-padSVG/dev/lab/) compare tile artwork
and motion at two sizes, explore the scatter layout, and exercise typing,
motion, and clipboard interaction. The [touchprint lab](site/lab/touchprint.html)
tests a fingerprint mark for demo recordings. Each lab states what it tests,
what to try, and what good looks like; see [`site/lab/README.md`](site/lab/README.md)
for the shared shell and conventions.

The website lives in [`site/`](site/) and uses HTML, CSS, and JavaScript with no
build step. Serve it over HTTP to load its modules. From the repository root,
run `python3 -m http.server --bind 127.0.0.1 --directory site 8000` and open
`http://127.0.0.1:8000/`.

## How experiments become reusable

Budgeting is the first example of the current organization. Its
[declaration](site/ui/budgeting/definition.js) names the experiment, its
status, and its artwork variants. The [SVG artwork](site/ui/budgeting/artwork.js)
and [motion styles](site/ui/budgeting/motion.css) supply the visuals.
The [preview tile](site/ui/preview-tile.js) renders the artwork into a native
button and provides the shared replay behavior. The showcase uses Payday split.
The lab uses the same renderer and behavior for Payday split and Ring and coins
at 54 and 108 pixels. The pages still own layout, autoplay, and hover policy.
The [Pets walks preview](site/ui/pets/walks.js) uses the same renderer.
Its SVG and paw-step motion are shared by X-Ray and both lab sizes.
The [Inventory scan preview](site/ui/inventory/scan.js) shares its artwork
and scanner motion the same way. The lab keeps the other Inventory treatments
available for comparison.
The [AI Agents Helper](site/ui/agents/helper.js) uses this pattern too. X-Ray
owns the links to AI badges. Both pages import the same
[base tile styles](site/ui/preview-tile.css) for ink, frames, and replay effects.
The [Touchprint overlay](site/ui/touchprint/index.js) works differently: it mounts
its own fixed, pointer-transparent layer and stamps a fingerprint at each contact.
Its artwork comes from [andrsrxn/icons](https://github.com/andrsrxn/icons) (MIT).
The [touchprint lab](site/lab/touchprint.html) compares size, linger, mouse input,
and the fingerprint echo.

The folder layout, declarations, and schemas are experiments too. Contributors
and agents can propose edits and optimizations as real use cases expose gaps.
See [contributor and agent guidance](AGENTS.md) for what to capture in a proposal.

The declaration and renderer split draws on
[Vercel Labs’ json-render catalog and registry](https://github.com/vercel-labs/json-render/blob/9d3dfc8917c1c6aa5568acbe0969523f3307376c/README.md#quick-start).
Keeping metadata next to a named source item draws on
[shadcn/ui’s registry](https://ui.shadcn.com/docs/registry/registry-item-json).
Keeping activation on a focusable native control while swapping SVG artwork
draws on [Radix’s composition guidance](https://www.radix-ui.com/primitives/docs/guides/composition)
and [React Aria’s button interaction model](https://react-aria.adobe.com/Button).

## Phone keyboard

Try the [direct keyboard lab](site/lab/keyboard-motion.html) to run the component
in a small host. The [integration lab](site/lab/keyboard.html) runs it inside
X-Ray at desktop and phone sizes. Both use the same mount function.

The [typing module](site/ui/phone-keyboard/typing.js) owns Shift, Symbols, Emoji,
and text edits. The [mount module](site/ui/phone-keyboard/index.js) applies those
edits to the textarea and manages SVG rendering, motion, focus, and clipboard
handoff. The SVG supplies the key geometry and alternate legends.

The [phone keyboard SVG](site/reference/phone-keyboard.svg) stores each key as
a named group. Export any key as a standalone SVG from the repository root
with Python 3.9 or later.

```sh
python3 scripts/export-phone-key.py --list
python3 scripts/export-phone-key.py KeyQ > q-key.svg
python3 scripts/export-phone-key.py Enter > enter-key.svg
```

Export the interactive keyboard, including the launcher, SVG, typing rules,
and motion, as a single ES module.

```sh
python3 scripts/export-phone-keyboard.py > phone-keyboard.mjs
```

Import `mountPhoneKeyboard(host, { copyText, onReserve, launcher, restoreFocus })`
from that module. Place the host in the area where the keyboard should appear.
Pass an existing button as `launcher` to draw the keyboard icon in it, and
optionally supply `restoreFocus` to choose where focus goes on close.
The component mounts its own DOM and stylesheet. It calls `onReserve(rect)`
on open and resize, and `onReserve(null)` on close. The host owns surrounding
layout and can supply an async `copyText` handler. The default uses the browser
clipboard. Set `--keyboard-ink`, `--keyboard-paper`, and `--keyboard-accent`
on the host to match its theme. The exported module embeds the SVG, so a
renderer bundler such as Omakase's can import it without copying extra assets.

On the home screen, working experiments use X-Ray tiles with a
`data-experiment` ID and `data-status` of `concept`, `planned`, `cooking`,
`iterating`, or `added-to-library`. Include the status in the tile's accessible
name. Each status has a distinct corner mark.

## Checks

Run `node --test tests/*.test.mjs` from the repository root with Node 22.18 or
later and Python 3.9 or later. The checks cover tile autoplay, keyboard typing,
and the standalone keyboard export.

## Branches

| Branch | What it is | Where it's live |
| --- | --- | --- |
| `dev` | Where new ideas get built | https://itama8.github.io/not-a-padSVG/dev/ |
| `main` | What the public sees | https://itama8.github.io/not-a-padSVG/ |

A push to either branch rebuilds and deploys both. Promote reviewed public site
changes to `main`. The tile and scatter labs live under `/dev/`.

`version.txt` on the live site shows which commit of each branch is deployed.

## Live click counter

Run the site and the counter together from the repository root:

```sh
npx --yes wrangler@4.166.0 dev
```

Open the local URL Wrangler prints in two tabs. Reveal X-Ray with the wordmark,
then press **I WANT THIS** repeatedly. The tapping tab counts each tap
immediately and sends them in 250 ms batches. Both tabs converge on the same
total over WebSocket. A reconnect in the same tab retries any unacknowledged
taps. The tab flushes queued taps when it goes into the background if the
connection is ready. Wrangler keeps the shared total in `.wrangler/`.

For public testing, deploy the Worker from an authenticated Cloudflare account
with `npx --yes wrangler@4.166.0 deploy`. Set the GitHub repository Actions
variable `WANT_COUNTER_SOCKET` to the deployed Worker's WebSocket URL, including
`/api/want`, and run **Build and deploy site**. Deploy Worker changes first when
publishing a site that uses batching. The updated Worker also serves earlier
site builds. GitHub Pages injects that URL
into any build that includes the counter. Both Pages builds share one total
when they use the same endpoint.
