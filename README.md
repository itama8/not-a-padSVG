# not-padgtp

A supercharged notepad: plain text, a tiny UI, and an x-ray you hold to see.

The website lives in [`site/`](site/). It is plain HTML with no build step yet.

## Phone keyboard artwork

Use the [keyboard lab](site/lab/keyboard.html) to try the home-screen keyboard
at desktop and phone sizes and check the clipboard.

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

## Branches

| Branch | What it is | Where it's live |
| --- | --- | --- |
| `dev` | Where new ideas get built | https://itama8.github.io/not-padgtp/dev/ |
| `main` | What the public sees | https://itama8.github.io/not-padgtp/ |

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
