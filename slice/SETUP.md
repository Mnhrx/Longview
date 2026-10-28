# Slice — setup

Four parts. Part 1 alone gives you a working app. Parts 2–4 add automatic logging.

## 1. Put the app online (GitHub Pages)

1. Create a GitHub repo, e.g. `slice`.
2. Upload `index.html`.
3. Repo → **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, folder `/ (root)` → Save.
4. After a minute it's live at `https://<your-username>.github.io/slice/`.
5. On your iPhone, open the link in **Safari** → Share → **Add to Home Screen**.

Always open Slice from the home-screen icon. On iPhone, the home-screen app keeps its own storage, separate from Safari.

## 2. Create the inbox (Cloudflare Worker)

Same Cloudflare account as Redline.

1. Cloudflare → **Storage & Databases → KV** → Create namespace `slice-queue`.
2. **Workers & Pages** → Create → *Hello World* Worker named `slice` → Deploy → **Edit code**.
3. Replace everything with `worker.js` → Deploy.
4. Worker → **Settings → Bindings** → Add → KV namespace. Variable name `QUEUE`, namespace `slice-queue`.
5. Worker → **Settings → Variables and Secrets** → Add → type *Secret*, name `SECRET`, value: a long random string. Keep it somewhere safe.
6. Copy the Worker URL (`https://slice.<you>.workers.dev`).
7. In Slice: Settings → paste the URL and secret → **Sync now**. "Up to date" means it's connected.

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
- The **Month** tab shows your $750 picture, the Fixed and One-off lists, and your money moves. When a month ends under budget, a **Move to Surplus** button logs the transfer for you.
- The **Accounts** tab shows how money flowed through the month, an estimated balance for each account, the SC card bill and due date, and how much has gone into Surplus.

## Balances

Slice can't see your bank. Each balance starts from the last known figure (a statement, or one you typed in) and adds everything logged since, so it's labelled "est.". To correct one, tap the account on the Accounts tab and type what your bank app shows. Uploading a JumpStart or SC card statement updates that account's balance and the card bill automatically.

## Good to know

- Data lives on your phone. Settings → **Backup** after each statement, and keep the file in iCloud Drive.
- Settings → **Upload statement** reads SC card and JumpStart PDFs on your phone. It confirms what's logged, fixes amounts and adds anything missed. Re-uploading the same statement never creates duplicates.
- The POSB transaction-history PDF from the app is just pictures of the page, so it can't be read. A POSB monthly eStatement PDF (from digibank) or a CSV export should work; send one over to get a POSB reader added.
- **Money in:** tap + then **Received**. Mark it *Payback* when a friend pays you back, and pick the meal it's for. That meal then only counts your share.
