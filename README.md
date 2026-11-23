# not-padgtp

A supercharged notepad: plain text, a tiny UI, and an x-ray you hold to see.

The website lives in [`site/`](site/). It is plain HTML with no build step yet.

## Branches

| Branch | What it is | Where it's live |
| --- | --- | --- |
| `dev` | Where new ideas get built | https://itama8.github.io/not-padgtp/dev/ |
| `prod` | What the public sees | https://itama8.github.io/not-padgtp/ |

A push to either branch rebuilds and deploys both. Promote reviewed public site
changes to `prod`. The tile and scatter labs live under `/dev/`.

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
