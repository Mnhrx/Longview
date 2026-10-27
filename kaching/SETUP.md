# Kaching — setup

Three parts. Part 1 alone gives you a working app; parts 2–3 add Apple Pay auto-logging.

## 1. Put the app online (GitHub Pages)

1. Create a new GitHub repo, e.g. `kaching`.
2. Upload `index.html` to it.
3. Repo → **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, folder `/ (root)` → Save.
4. After a minute it's live at `https://<your-username>.github.io/kaching/`.
5. On your iPhone, open that link in **Safari** → Share → **Add to Home Screen**.

Always open Kaching from the home-screen icon. On iPhone the home-screen app keeps its own storage, separate from Safari, so that's where your data lives.

## 2. Create the Apple Pay inbox (Cloudflare Worker)

Same Cloudflare account as Redline.

1. Cloudflare dashboard → **Storage & Databases → KV** → Create namespace, name it `kaching-queue`.
2. **Workers & Pages** → Create → *Hello World* Worker, name it `kaching` → Deploy → **Edit code**.
3. Replace everything with the contents of `worker.js` → Deploy.
4. Worker → **Settings → Bindings** → Add → KV namespace. Variable name: `QUEUE`, namespace: `kaching-queue`.
5. Worker → **Settings → Variables and Secrets** → Add → type *Secret*, name `SECRET`, value: any long random string (save it somewhere, you'll need it twice).
6. Copy the Worker's URL (looks like `https://kaching.<you>.workers.dev`).
7. In the app: ⚙️ Settings → paste the **Worker URL** and **Secret** → *Sync now*. "Already up to date" means it's connected.

## 3. Make Apple Pay send each tap (Shortcuts)

1. Open **Shortcuts** → **Automation** tab → **+** → **Transaction**.
2. Pick the cards you use in Wallet → choose **Run Immediately** → Next → **New Blank Automation**.
3. Add the action **Get Contents of URL**:
   - URL: `https://kaching.<you>.workers.dev/tx`
   - Tap the arrow to expand → **Method: POST**
   - **Headers**: add `Authorization` = `Bearer <your secret>` (the word Bearer, a space, then the secret)
   - **Request Body: JSON**, add four Text fields:
     - `merchant` → tap the field, insert *Shortcut Input*, then tap it and choose **Merchant**
     - `amount` → *Shortcut Input* → **Amount**
     - `card` → *Shortcut Input* → **Card** (or Name — whichever names your card)
     - `date` → the **Current Date** variable
4. Done. Make a small Apple Pay purchase, open Kaching, and it should pop up under ⚡ New.

The exact property names in step 3 can differ slightly between iOS versions; pick the ones that look like the merchant, amount and card.

## How the pieces fit

- **Apple Pay tap** → Shortcut sends merchant + amount to your Worker → waits there.
- **Open Kaching** → it pulls waiting taps, auto-categorises them, tags them ⚡ New, and tells the Worker to delete them.
- **Statement arrives** → ⚙️ → *Upload card statement*. It's read on your phone, matches what's already logged, fixes pre-authorised amounts (petrol pumps), and adds anything you paid without Apple Pay.
- **Cash / PayNow** → tap **+**.

## Good to know

- Your data is stored on your phone only. Use ⚙️ → **Backup** now and then (e.g. after each statement) and keep the file in iCloud Drive.
- Change a transaction's category once and Kaching remembers it for that merchant.
- **One-time** payments stay out of the budget ring so a big bill doesn't wreck your everyday numbers.
- **I paid for others too** counts only your share. It's the hook for phase 2 (groups and splitting).
