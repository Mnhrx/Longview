# Farelog

A private-hire order pattern tracker. Add screenshots of route-detail screens
(Grab, TADA, etc.), check the auto-extracted details, and see timing/location/
fare patterns build up over time.

Everything runs in the browser — no backend, no account, no server. Data is
stored in `localStorage` on whichever device/browser is used, so it stays
wherever it's added (see "Where data lives" below).

## Deploy it (GitHub Pages)

Same pattern as your other GitHub Pages apps — add this as a subfolder of an
existing Pages repo, e.g. `mnhrx/Longview/farelog/`:

1. Copy this whole `farelog/` folder into the repo.
2. Commit and push.
3. It'll be live at `https://<username>.github.io/<repo>/farelog/`.

No build step — it's plain HTML/CSS/JS, so pushing the folder as-is is enough.

To try it locally first: `python3 -m http.server` from inside this folder,
then open `http://localhost:8000`.

## Using it

**Upload tab** — pick screenshots straight from the phone's own gallery /
Screenshots folder, not ones forwarded through WhatsApp or another chat app
first. The date and time for each order come from the file itself (Android
stamps this at the moment the screenshot is taken), so a forwarded copy loses
that and falls back to whenever it was forwarded instead.

Tap **Read screenshots** to run text extraction on everything queued. This
happens entirely on-device (via Tesseract.js) — no images are uploaded
anywhere.

**Review tab** — every screenshot lands here after extraction with its fields
pre-filled and editable: date/time, platform, what he earned, what the
passenger paid, pickup/drop-off address + postal code, service type, stop
count, and a boost/priority toggle (that one has to be checked by hand — it's
a colour badge on screen, not text, so extraction can't read it). Fix
anything that's off, then **Save**, or **Discard** if a screenshot isn't a
route-details screen at all. Nothing is saved until you tap Save.

**Dashboard tab** — a platform filter (All / Grab / TADA / …) at the top that
narrows *everything* below it to one platform, once more than one has data
(the one exception is the platform comparison chart, which always compares
all of them and hides itself once you've already filtered to one). On a
phone the dashboard is split into four tabs so it doesn't turn into an
endless scroll; on a wider screen (tablet/laptop/desktop — roughly 900px and
up) all four show at once as a grid, since there's room:

- **Overview** — a "right now" card (is this day/time slot historically
  strong, average, or quiet), total trips/earnings/average tiles, and a
  personal-records card: best single trip, best day, best-paying time slot,
  and busiest day (the last three only show once there's enough history,
  and — on a phone — only "best trip" is shown up front to keep it short;
  the full set of four shows on wider screens).
- **Timing** — the day × time-of-day heatmap (six 4-hour blocks per day,
  toggle between average earnings and boost rate per slot) instead of
  separate hour/day charts, since it can show combinations like "Friday
  evenings" that separate charts can't. A weekly earnings trend once at
  least two different weeks are logged, with a this-week-vs-last-week
  delta. On wider screens, also a daily-earnings calendar (last 12 weeks) —
  a quick "which days tend to be good" glance.
- **Locations** — best-paying pickup areas, which pickup areas tend to lead
  to which drop-off areas ("where trips from here tend to end up"), and —
  once postal codes can be geocoded (needs internet; see below) — distance
  and S$-per-km stats.
- **Platforms** — the platform comparison chart, average platform cut over
  time, breakdowns by stop count and service tier, and boosted-vs-regular
  fare comparison.

**Data tab** — the full saved table (now including estimated trip distance),
CSV export/import, and a way to wipe everything and start over.

There's also a **Load sample data** button on the Upload tab that seeds 16
real orders (already extracted and checked) so the Dashboard has something
to show immediately.

### Distance and S$/km

Once a pickup and drop-off postal code are both on a record, the app looks
up their coordinates via [OneMap Singapore](https://www.onemap.gov.sg/)'s
free public search API (no key needed, and nothing but the 6-digit postal
code is sent) and works out the straight-line distance between them. That's
an estimate, not the actual road distance a trip took — treat S$/km as a
rough efficiency signal, not an exact figure. Coordinates are cached in the
browser once looked up, so this only needs the network the first time a
given postal code shows up. If there's no internet connection when it
tries, the rest of the dashboard still works — you just won't see distance
figures until it can retry with a connection.

### What's new / help

The **?** button in the header opens a help panel with a short "how to use
this" per tab, plus a **What's new** link showing the full version history.
After an update, a short summary of what changed pops up automatically the
next time the app is opened — once, then it won't nag about the same
version again.

### Phone vs. PC

Everything works on both, but the layout adapts: on a phone, the Dashboard
is tabbed one section at a time and navigation sits in a bottom bar within
thumb's reach. On a wider screen, navigation moves to a top bar, all four
Dashboard sections show together, the Review queue lays out two columns per
screenshot instead of one, and a couple of things (the full personal-records
row, the daily-earnings calendar) only appear on the wider layout since
they need more room to be readable. Nothing about the *data* differs
between the two — it's the same `localStorage` on whichever device/browser
you're using it from (see "Where data lives" below), just presented
differently.

## Where data lives

Records are stored in the browser's `localStorage`, scoped to this exact
page's URL. That means:

- It's private to whichever phone/browser adds it — nothing is sent
  anywhere.
- It persists across visits on that device, but clearing browser data/site
  storage wipes it.
- It does **not** sync between devices on its own. If both you and your dad
  will be adding/viewing data, use **Export CSV** on one device and
  **Import CSV** on the other to move records across, or agree on a single
  device as the source of truth.

## Known limitations (v3)

- **Extraction is best-effort, not exact.** Tesseract.js reads clean, high-contrast
  app text reasonably well, but the Review step exists because it *will*
  occasionally misread a digit or split an address oddly. Worth double-checking
  for the first couple of weeks especially.
- **Pickup-area grouping is approximate.** It buckets by Singapore's published
  28 postal districts (from the first two digits of the postal code) — a good
  enough proxy for "which part of the island," not precise geocoding. The
  distance/S$-per-km figures (see above) use real geocoded coordinates via
  OneMap, but the area *names* shown throughout the dashboard still come from
  the postal-district bucket, not a geocoded address — a natural next step if
  exact locations or a real map view become worth building.
- **Trip distance is a straight-line estimate, not the road route.** OneMap's
  free search API gives coordinates; the app then does straight-line
  (haversine) distance between pickup and drop-off, which will always be
  somewhat shorter than the actual road distance driven. Good for relative
  comparisons (which trips were more efficient), not for exact figures.
  This also means it needs an internet connection to resolve new postal
  codes — resolved ones are cached in the browser so it's a one-time cost per
  postal code, and the rest of the dashboard works fine without it.
- **Boost/surge is manual.** The green priority badge is a graphic, not text,
  so it can't be auto-detected reliably — it's a checkbox in Review instead.
- **The heatmap, "right now" readout, and personal records need some history
  to be worth trusting.** A dashed-outline heatmap cell means only 1 trip
  landed in that day/time-of-day slot — read it as an early hint, not a
  settled pattern. Same logic applies to the "right now" card and the
  pickup-area/flow rankings: check the trip count before treating a ranking
  as reliable.
- **Online/idle time between trips isn't tracked.** The app only knows about
  logged trips, not how long the driver was online waiting for one — so
  figures like "average per trip" don't reflect actual hourly earnings while
  working. Deliberately left out of this version pending a decision on
  whether it's worth the extra manual step (or whether inferring it from
  gaps between trips is accurate enough) — a candidate for a future version.
- Needs an internet connection to load the Tesseract.js and Chart.js
  libraries from their CDNs on first use (they're cached by the service
  worker after that, but a fully offline first install isn't possible with
  this setup).
