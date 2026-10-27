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

After any PayNow, double-tap the back of your phone, type the amount and what it was for, done. It lands in Slice as POSB Salary, tagged New. The PayNow button in the app's nav bar does the same thing in-app.

## How Slice counts money

- **Everyday** counts toward your $750 allowance, from any account.
- **Planned** is tracked but outside the allowance: parents, school fees, insurance, big one-offs.
- **Transfer** is your own money moving between accounts and isn't counted.
- The $200 to your parents repeats automatically on the 1st as Planned. Manage repeats in Settings.
- The **Month** tab shows what to move to POSB Surplus, and how your card bill splits between salary (everyday) and savings (planned).

## Good to know

- Data lives on your phone. Settings → **Backup** after each statement, and keep the file in iCloud Drive.
- Settings → **Upload SC card statement** checks your logged card spending against the PDF on-device.
- Change a merchant's category once and Slice remembers it.
