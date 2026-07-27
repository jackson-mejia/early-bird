# Early Bird

A single-file habit tracker for waking up earlier and studying. Logs a wake time and study
minutes per day, scores them, tracks a streak, and shows progress toward reward milestones.

Live at **https://jackson-mejia.github.io/early-bird/**

Everything is in `index.html`. No build step, no framework, no dependencies beyond two Google
Fonts links. All state lives in `localStorage` in the visitor's own browser — nothing is sent
anywhere and nothing is stored server-side.

## Deploying

Push to `main` and GitHub Pages redeploys automatically. Data survives redeploys because
`localStorage` is keyed to the origin, and the origin never changes.

## Rules for changing this

- **Do not change `DATA_KEY`** (`'early-bird-data'`). Changing it orphans existing data.
- **Do not change the storage mechanism** without a migration path. It is plain `localStorage`.
- **Do not change the shape of `state.entries` except by adding optional fields.** Each entry is
  `{ wake: "HH:MM", studyMin: number, questions: number }` keyed by `"YYYY-MM-DD"`. `questions`
  was added after the fact and is read as 0 when absent, which is what keeps pre-questions backups
  restorable. Any future field has to earn its keep the same way — never rename or remove one.
- **Keep it one file.** Splitting into modules means a build step.
- **Do not add a custom domain.** A new origin means a new `localStorage` namespace, and the
  logged history goes with it.

## Scoring

**Wake points.** Baseline 9:00, which earns a point on its own. Every 30 minutes earlier adds
another, capped at 6. Past 9:00 earns nothing.

| Wake time | Points |
|---|---|
| Before 6:30 | 6 |
| 6:30–7:00 | 5 |
| 7:00–7:30 | 4 |
| 7:30–8:00 | 3 |
| 8:00–8:30 | 2 |
| 8:30–9:00 | 1 |
| After 9:00 | 0 |

**Study bonus.** Flat +3 at 30 or more minutes, independent of wake time and streak.

**Questions.** Half a point per ten questions completed, capped at 3 — so 10 is 0.5, 25 is 1, and
60 or more is 3. Like the study bonus, it does not scale with the streak.

**Half points.** Scores land on the nearest half rather than the nearest whole number, so a
multiplier that produces a fraction keeps it. `fmtPts` renders a whole number without a trailing
`.0`. Every value stays a multiple of 0.5, which is exact in binary, so totals do not drift.

**Streak multiplier.** Applies to wake points only, never the study bonus or the questions:
days 1–2 are 1.0x, days 3–6 are 1.25x, day 7 onward is 1.5x.

**Streak rules.** A logged day increments the streak. A missed weekday drops it back one tier
(7+ becomes 4, 3–6 becomes 1, otherwise 0) rather than resetting to zero. Logging a weekend day
extends the streak; skipping one costs nothing.

**Rewards.** Most are point thresholds, editable in the app, and unlock permanently once the
running total passes them. One is different: a reward carrying `type: 'event'` is not tied to
points at all. That is the dinner, and it turns on the GRE score entered into it — 160 or better
earns a Michelin recommended restaurant, 165 or better a one-star, and anything under 160 stays
locked while still showing the score. Scores are validated to the 130–170 section range; the
highest matching tier in `GRE_TIERS` wins, so adding a third tier means adding one entry.

Rewards saved before the dinner existed get it appended on load rather than needing a reset, and a
reward with no `type` is treated as a threshold, so old backups restore unchanged.

**Logging.** All three fields — wake time, study minutes, questions — have to be filled in before
a day saves, in the entry form and when editing an existing day. Zero is valid for both counts: a
day with no studying is logged as 0, not left blank, so that a half-filled form never turns into a
scored entry by accident.

**Recomputation.** Points are never stored, only raw inputs. `recompute()` walks every day from
the first entry to today and derives all points and the streak fresh on each render, which is what
makes editing an old entry correctly update everything after it. Do not cache scored values
without handling invalidation.

## Sync

Optional and off until someone turns it on. "Turn on sync" creates a remote copy and hands back a
sync code; opening the same page on another device with that code (or with the copied
`#sync=<code>` link) joins it to the same history.

`localStorage` remains the source of truth. The remote copy is a mirror that is pulled on load and
pushed after each save, so a dead network or a dead service costs the syncing and never the data.
Sync bookkeeping lives under its own `early-bird-sync` key, which leaves `DATA_KEY` and the backup
file exactly the shape they have always had.

Merging takes the union of both sides, so a day logged on either device survives, and a same-day
conflict goes to whichever side wrote last. Deletions are recorded as tombstones and travel with
the payload, otherwise a deleted day would reappear on the next pull. A tombstone loses to the
newer side still having that day logged, which is what re-logging a deleted day looks like.

Anyone holding the code can read and change the log. That is the accepted trade for having no
accounts and no passwords.

### Backend

`worker/` holds a Cloudflare Worker over a KV namespace — see `worker/README.md` for deploying it
and for what it does and does not protect. Set `SYNC_BASE` in `index.html` to the deployed URL.
Until it is set, the sync card says sync is not configured rather than half-working.

This replaced a public JSON bin that expired a copy 24 hours after its last write. Measured rather
than documented: a blob written at 21:32 reported `x-jsonblob-expires-at` of 21:32 the next day
with `precision: exact`, and reading it did not extend the window. That is the wrong shape for
this app, where missed days are normal and weekends are explicitly free — a quiet weekend would
have killed the shared copy. KV entries are written with no expiry.

## Gotchas

- `localStorage` throws in Safari Private Browsing. `save()` catches it and alerts. Keep that handler.
- Dates are local-time strings (`YYYY-MM-DD` parsed with a `T00:00:00` suffix) to avoid UTC
  off-by-one errors.
- The dial's arc path length is hardcoded to 377. Recompute it if the arc geometry changes.
