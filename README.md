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
- **Do not change the shape of `state.entries`.** Each entry is `{ wake: "HH:MM", studyMin: number }`
  keyed by `"YYYY-MM-DD"`. Export/restore reads and writes this shape, and old backup files must
  stay restorable.
- **Keep it one file.** Splitting into modules means a build step.
- **Do not add a custom domain.** A new origin means a new `localStorage` namespace, and the
  logged history goes with it.

## Scoring

**Wake points.** Baseline 9:00, stepping down one point per 30 minutes earlier, capped at 5.

| Wake time | Points |
|---|---|
| Before 6:30 | 5 |
| 6:30–7:00 | 4 |
| 7:00–7:30 | 3 |
| 7:30–8:00 | 2 |
| 8:00–8:30 | 1 |
| 8:30 onward | 0 |

**Study bonus.** Flat +3 at 30 or more minutes, independent of wake time and streak.

**Streak multiplier.** Applies to wake points only, never the study bonus: days 1–2 are 1.0x,
days 3–6 are 1.25x, day 7 onward is 1.5x.

**Streak rules.** A logged day increments the streak. A missed weekday drops it back one tier
(7+ becomes 4, 3–6 becomes 1, otherwise 0) rather than resetting to zero. Logging a weekend day
extends the streak; skipping one costs nothing.

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

The storage provider is two lines — `SYNC_BASE` and the three `fetch` calls that use it. Swapping
providers means changing that constant and, if the new one does not hand back an id in a
`Location` header, the one line in `syncCreate()` that reads it.

## Gotchas

- `localStorage` throws in Safari Private Browsing. `save()` catches it and alerts. Keep that handler.
- Dates are local-time strings (`YYYY-MM-DD` parsed with a `T00:00:00` suffix) to avoid UTC
  off-by-one errors.
- The dial's arc path length is hardcoded to 377. Recompute it if the arc geometry changes.
