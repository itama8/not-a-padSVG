# not-padgtp

not-padgtp is a workshop for building a composable SVG UI library. We use
small, self-contained experiments to develop one interaction at a time. The
notepad and its X-Ray layer give those experiments a stripped-down showcase.
As ideas mature, their SVG artwork, rendering, behavior, and component
declarations become pieces we can reuse in other experiments and apps.

## Try the experiments

Open the [development showcase](https://itama8.github.io/not-padgtp/dev/) and
press Alt on desktop or tap the wordmark on a touch screen for X-Ray.

- The [tile lab](https://itama8.github.io/not-padgtp/dev/lab/tiles.html) compares
  SVG artwork and motion at two sizes.
- The [scatter lab](https://itama8.github.io/not-padgtp/dev/lab/scatter.html)
  explores how X-Ray arranges tiles.
- The [keyboard lab](https://itama8.github.io/not-padgtp/dev/lab/keyboard.html)
  exercises typing, motion, and clipboard interaction.

## How the library grows

Experiments give us a place to develop SVG artwork, interaction behavior,
rendering, and metadata in small steps. When a piece proves useful across
experiments, we extract it so improvements can carry forward.

The folder layout, component declarations, and schemas are experiments too.
Contributors and agents can propose edits and optimizations by describing the
case that motivates the change and showing how it works in a lab or showcase.

The website lives in [`site/`](site/) and uses HTML, CSS, and JavaScript with no
build step. The [development branch](https://github.com/itama8/not-padgtp/tree/dev)
contains the current experiments and their source.

## Branches

| Branch | What it is | Where it's live |
| --- | --- | --- |
| `dev` | Where new ideas get built | https://itama8.github.io/not-padgtp/dev/ |
| `main` | What the public sees | https://itama8.github.io/not-padgtp/ |

Site changes on either branch rebuild and deploy both versions. The labs live
under `/dev/`.

[Deployment versions](https://itama8.github.io/not-padgtp/version.txt) lists the
site commit deployed for each branch.

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
