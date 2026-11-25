# Enthusiasm counter

The normal total remains in SQLite `counter` row 1. Suspected automated clicks
increment row 2 instead. The batch that exceeds a budget and all subsequent
clicks while flagged go to row 2; earlier normal clicks stay in row 1. Both totals
persist across deployments. Do not reset the Durable Object storage.

Visitors get an anonymous HMAC-signed session from `POST /api/want/session`.
There are no accounts or logins. Sessions last seven days and are bound to a
keyed hash of Cloudflare's connecting IP; raw IP addresses are not stored. The
signing key is generated once and stored in the Durable Object. The browser
reuses its session across tabs via local storage where available.

`policy.mjs` defines token-bucket click budgets:

| Scope | Initial burst | Refill |
| --- | --- | --- |
| Session (all tabs/connections) | 120 clicks | 12 clicks/second |
| IP (all sessions) | 600 clicks | 60 clicks/second |

Exceeding either budget flags that scope for 24 hours. Reconnects, fresh tab IDs,
and new sessions do not reset the IP budget. Detection is heuristic: sustained
fast humans or buffered offline taps can trigger it, while slower scripts and
distributed clients can evade it. These are starting thresholds to tune.

Every WebSocket requires a signed session and a per-page client UUID. Cumulative
sequence receipts acknowledge clicks in either total, so retrying a batch never
adds it twice. The old unsigned `click` protocol is rejected. Existing totals
and receipt tables are preserved.

Each snapshot includes the appropriate `total`, cumulative `accepted` receipt,
and `diverted` flag. Only flagged visitors see the red total and the message
`nice try, thanks a lot :)`; other visitors keep seeing the normal total.
The shared visual treatment lives in `site/ui/want-counter/treatment.js`, used by
the home showcase and `site/lab/counter-routing.html`. The lab uses the real client and backend; its scripted-burst control exercises detection and persistence.

Run `node --test tests/*.test.mjs` (requires `node:sqlite`; verified on Node 26).
For local workerd testing, run `npx wrangler dev --local` with a separate
`--persist-to` directory to isolate test clicks from other local state.
Deploy the Worker and site changes together: older clients cannot connect to
the new authenticated protocol until they reload the updated site.
