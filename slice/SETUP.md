# Slice — setup

Four parts. Part 1 alone gives you a working app. Parts 2–4 add automatic logging.

## 1. Put the app online (GitHub Pages)

1. Create a GitHub repo, e.g. `slice`.
2. Upload `index.html`.
3. Repo → **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, folder `/ (root)` → Save.
4. After a minute it's live at `https://<your-username>.github.io/slice/`.
5. On your iPhone, open the link in **Safari** → Share → **Add to Home Screen**.

Always open Slice from the home-screen icon. On iPhone, the home-screen app keeps its own storage, separate from Safari.

## 2. Create the Worker (inbox and sync)

Same Cloudflare account as Redline.

1. Cloudflare → **Storage & Databases → KV** → Create namespace `slice-queue`.
2. **Workers & Pages** → Create → *Hello World* Worker named `slice` → Deploy → **Edit code**.
3. Replace everything with `worker.js` → Deploy.
4. Worker → **Settings → Bindings** → Add → KV namespace. Variable name `QUEUE`, namespace `slice-queue`.
5. Worker → **Settings → Variables and Secrets** → Add → type *Secret*, name `SECRET`, value: a long random string. Keep it somewhere safe.
6. Copy the Worker URL (`https://slice.<you>.workers.dev`).
7. In Slice: Settings → paste the URL and secret → **Sync now**. "Up to date" means it's connected.

**Already set up the Worker before?** Paste the new `worker.js` over the old code and Deploy. It adds the sync between your devices. Nothing else changes.

## Sync your phone and computer

Do this on your **phone first**, because it has your real data.

1. Phone: Settings → enter the Worker URL and secret → **Sync now**. Your phone's data becomes the synced copy.
2. Computer: open your Slice link in a browser → Settings → same URL and secret → **Sync now**.
3. The computer asks which copy to use. Pick **Use the synced data**.

After that it's automatic. Every change is sent within a couple of seconds, and each device pulls the latest when you open it, switch back to it, or every 45 seconds while it's open. If you edit the same transaction on both, the newer edit wins. Deletes carry across too. The Worker also keeps a daily copy for two weeks as a safety net.

## On a computer

Open the same link in any browser wider than about 900px and Slice switches layout:

- Nav down the left, shards in the middle, and a side panel on the right. Clicking a shard shows its details in the panel instead of a pop-up. Close it (or press Esc) to go back to the screen's summary.
- Hover a shard to see its exact amount, even small ones without a label.
- Activity shows the whole month as the strip.
- Month has a **Review** button: the month's transactions as a table. Change category or "Counts as" from the dropdowns. With "Apply changes to the same merchant" on, it also fixes that merchant's other payments and remembers it.
- Drag a statement PDF anywhere onto the window to import it.
- Keys: **N** logs a payment (type the amount, Enter), **1–4** switch screens, **← →** change month (or day on Activity), **Esc** closes or zooms out.

## 3. Apple Pay taps (Shortcuts automation)

1. **Shortcuts** → **Automation** → **+** → **Transaction**.
2. Pick your Wallet cards → **Run Immediately** → Next → **New Blank Automation**.
3. Add **Get Contents of URL**:
   - URL: `https://slice.<you>.workers.dev/tx`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer <your secret>`
   - Request Body: **JSON** with four Text fields:
     - `merchant` → *Shortcut Input* → **Merchant**
     - `amount` → *Shortcut Input* → **Amount**
     - `card` → *Shortcut Input* → **Card** (or Name)
     - `date` → **Current Date**

The card name decides the account: anything with POSB or DBS goes to Salary, JumpStart goes to Savings, everything else to SC Card. If you add a POSB debit card to Wallet, tick it in step 2 too.

## 4. PayNow in two taps (Back Tap)

1. **Shortcuts** → **Shortcuts** tab → **+** → name it `Log PayNow`.
2. Add **Ask for Input** → type **Number**, prompt `Amount`.
3. Add **Ask for Input** → type **Text**, prompt `What for`.
4. Add **Get Contents of URL** set up like part 3, but the JSON fields are:
   - `merchant` → the *What for* answer
   - `amount` → the *Amount* answer
   - `card` → type the text `PayNow`
   - `date` → **Current Date**
5. iPhone **Settings → Accessibility → Touch → Back Tap → Double Tap** → choose `Log PayNow`.

After any PayNow, double-tap the back of your phone, type the amount and what it was for, done. It lands in Slice as POSB Salary, tagged New. In the app, tap + and pick **Salary** under "Paid from".

## How Slice counts money

Every spend lands in one of four buckets:

- **Day-to-day** counts toward your $750, from any account: food, groceries, petrol, transport, shopping, fun, PayNow to friends, cash withdrawals.
- **Fixed** is outside the $750: bills and subscriptions, vehicle costs (road tax, servicing, bike insurance), insurance, instalments, parents, school.
- **One-off** is outside the $750: clinic and optical, trips, big purchases.
- **Transfer** is your own money moving between accounts and isn't counted at all.

**Teaching it.** Open any transaction and change its category or bucket. An "Always do this for ..." switch appears. Leave it on and every past and future transaction from that merchant follows, including Apple Pay taps, PayNows and statement imports. Settings → **Rules** lists everything it has learned; delete a rule there to stop it.

- The $200 to your parents repeats automatically on the 28th, after payday, as Fixed. Manage repeats in Settings.

## Balances

Slice can't see your bank. Each balance starts from the last known figure (a statement, or one you typed in) and adds everything logged since, so it's labelled "est.". To correct one, tap the account on the Accounts tab and type what your bank app shows. Uploading a JumpStart or SC card statement updates that account's balance and the card bill automatically.

## Good to know

- Data lives on your phone. Settings → **Backup** after each statement, and keep the file in iCloud Drive.
- Settings → **Upload statement** (or drag the PDF onto Slice on a computer) reads SC card, JumpStart and POSB statements on your device. It confirms what's logged, fixes amounts and adds anything missed. Re-uploading the same statement never creates duplicates.
- **POSB:** use the transaction history PDF from the digibank app. Its pages are pictures, so Slice reads them with OCR (text recognition). It takes about 30 seconds on a computer and longer on a phone. The first time, it asks whether the account is POSB Salary or POSB Surplus, then remembers. It also sets that account's balance from the PDF.
  - New payments come in as **New to check**. A smudged decimal point gets fixed automatically and marked "Check amount".
  - Slice learns your names for payees from transactions it already has, so the canteen's PayNow name becomes "Work canteen" by itself.
- **Money in:** tap + then **Received**. Mark it *Payback* when a friend pays you back, and pick the meal it's for. That meal then only counts your share.

## The screens

Every screen is made of shards. A shard's size is its share of the money. Tap a shard to zoom in, and tap the pill at the top left to zoom back out.

- **Home**: this month's day-to-day spending by category, plus what's left of your $750. Both bars hide after a few seconds. Tap the handle at the bottom, or swipe in from an edge, to bring them back. When you're over budget, the edges and the cracks between shards pulse red.
- On **Activity, Month and Accounts** only the bottom nav hides, so the numbers at the top stay on screen. The + floats in the corner while the nav is hidden.
- **Activity**: one day at a time. Each day of the week is a slanted strip, and the colours show what you spent. Tap a strip, or swipe across the shards, to change day. Swipe the strip to jump a week. Repeat payments at one place group into one shard (for example "Work canteen ×3"); tap it to see each payment. The magnifier opens search.
- **Month**: the month split into Day-to-day, Fixed and One-off, then into categories. The arrows compare each group with last month. Swipe sideways to change month. The pill on the right shows your day-to-day total against $750. When a month ends under budget, a **Move to Surplus** pill logs the transfer.
- **Accounts**: each account sized by its balance. The card is the red striped shard (what you owe). Tap an account to see where its money went this month:
  - POSB Salary: transfers to JumpStart, then day-to-day, fixed and one-off.
  - JumpStart: how much is free and how much is held for the card bill.
  - SC card: the card spending by bucket, plus **Mark paid**.
  - POSB Surplus: the last six months of moves.
  - Cash: withdrawn compared with logged.
- **+**: type the amount, then pick where you spent it. Your most frequent places are the biggest shards; pick **Elsewhere** to choose a category instead. The pills at the top switch Today or Yesterday and the account. **More** opens the full form for splits, notes and repeats. To undo a payment you just logged, tap the confirmation message.

## Updates

The home-screen app checks GitHub for a newer version each time you open it or switch back to it. If there is one, it reloads once and shows "Slice updated". Your data isn't touched. This works by comparing the `slice-build` number near the top of `index.html`, so every new version I send you has a new number. If you edit the file yourself, change that number too.
