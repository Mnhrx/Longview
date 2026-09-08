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

**Dashboard tab** — average earnings by hour of day, by day of week (once a
few different days are logged), best-paying pickup areas, a platform
comparison (once more than one platform has data), and boosted-vs-regular
fare comparison.

**Data tab** — the full saved table, CSV export/import, and a way to wipe
everything and start over.

There's also a **Load sample data** button on the Upload tab that seeds 16
real orders (already extracted and checked) so the Dashboard has something
to show immediately.

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

## Known limitations (v1)

- **Extraction is best-effort, not exact.** Tesseract.js reads clean, high-contrast
  app text reasonably well, but the Review step exists because it *will*
  occasionally misread a digit or split an address oddly. Worth double-checking
  for the first couple of weeks especially.
- **Pickup-area grouping is approximate.** It buckets by Singapore's published
  28 postal districts (from the first two digits of the postal code) — a good
  enough proxy for "which part of the island," not real geocoding. Swapping in
  a proper geocoder (e.g. OneMap's free API) would give exact locations and
  even a real map view — a natural v2.
- **Trip distance/duration isn't captured** — the route-details screen doesn't
  show it. If that becomes important, it's derivable from geocoded
  pickup/drop-off coordinates once v2 adds real geocoding.
- **Boost/surge is manual.** The green priority badge is a graphic, not text,
  so it can't be auto-detected reliably — it's a checkbox in Review instead.
- Needs an internet connection to load the Tesseract.js and Chart.js
  libraries from their CDNs on first use (they're cached by the service
  worker after that, but a fully offline first install isn't possible with
  this setup).
