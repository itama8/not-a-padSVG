# not-padgtp

A supercharged notepad: plain text, a tiny UI, and an x-ray you hold to see.

The website lives in [`site/`](site/). It is plain HTML with no build step yet.

## Branches

| Branch | What it is | Where it's live |
| --- | --- | --- |
| `dev` | Where new ideas get built | https://itama8.github.io/not-padgtp/dev/ |
| `prod` | What the public sees | https://itama8.github.io/not-padgtp/ |

A push to either branch rebuilds and deploys both. To ship, merge `dev` into `prod`:

```sh
git switch prod && git merge --ff-only dev && git push && git switch dev
```

`version.txt` on the live site shows which commit of each branch is deployed.
