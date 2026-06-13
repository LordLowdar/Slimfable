# Wiring the gallery to Instagram

The gallery on the site pulls Slim's latest Instagram posts using the **official
Instagram Graph API**. A build script downloads the post images into
`assets/ig/` and writes `assets/instagram.json`; the page reads that file at load.
If the file is missing or fails to load, the hand-picked local images stay in place.

Nothing secret ever ships to the browser — the access token lives only in `.env`
on the machine that runs the build.

---

## One-time setup

1. **Make the account a Professional account.**
   In the Instagram app: Settings → *Account type and tools* → switch to
   **Business** or **Creator**. (Personal accounts can't use the API.)

2. **Create a Meta app.**
   Go to <https://developers.facebook.com/apps> → *Create App* → choose the
   **Business** type. Inside the app, add the product
   **“Instagram” → “Instagram API with Instagram Login.”**

3. **Get a long-lived access token.**
   In the Instagram API setup, generate a user token for the account and grant the
   `instagram_business_basic` permission. Use the token tool to exchange the
   short-lived token for a **long-lived** one (valid ~60 days). Copy that token.

4. **Add the token locally.**
   ```
   copy .env.example .env
   ```
   Open `.env` and paste the token after `IG_ACCESS_TOKEN=`.
   Optionally set `IG_LIMIT` (how many recent posts to show, default 12).

---

## Refreshing the gallery

Whenever Slim posts and you want the site updated:

```
npm run fetch:ig
```

This downloads the newest images, rewrites `assets/instagram.json`, and
**auto-refreshes the token** so the ~60-day clock keeps resetting as long as you
run it at least every couple of months. If Instagram issues a brand-new token
string, the script prints it — paste that into `.env`.

> The script is dependency-free (uses Node's built-in `https`), so `npm install`
> isn't required. Node 14+ works.

---

## How it fits together

| File | Role |
|------|------|
| `scripts/fetch-instagram.mjs` | Fetches posts, downloads images, writes JSON, refreshes token |
| `.env` | Your secret token (gitignored — never commit) |
| `assets/ig/*.jpg` | Downloaded post images (gitignored, regenerated) |
| `assets/instagram.json` | Manifest the gallery reads (gitignored, regenerated) |
| `js/main.js` → `loadInstagram()` | Renders the grid, falls back to local images |

## Automating it (optional)

To keep the feed fresh without running it by hand, put `npm run fetch:ig` on a
schedule — e.g. a GitHub Action on a cron, or a Task Scheduler job — then redeploy
the static files. Because images are downloaded at build time, the published site
has no live dependency on Instagram and nothing breaks if their CDN URLs rotate.
