# Deploying BillPilot to Vercel 🚀

BillPilot is a pure static site (HTML + CSS + JS, no build step), so deploying takes about two minutes. There are two ways — pick one.

---

## Option A — Deploy from GitHub (recommended)

This gives you automatic deployments: every `git push` updates the live site.

1. **Push the repo to GitHub** (already done if you're reading this on GitHub).

2. **Sign in to Vercel** at [vercel.com](https://vercel.com) — choose **Continue with GitHub** so it can see your repositories.

3. Click **Add New… → Project**.

4. **Import** the `billpilot` repository from the list. If it isn't listed, click *Adjust GitHub App Permissions* and grant Vercel access to the repo.

5. On the **Configure Project** screen, use these settings:

   | Setting | Value |
   |---|---|
   | Framework Preset | **Other** |
   | Root Directory | `./` (leave as is) |
   | Build Command | *(leave empty)* |
   | Output Directory | *(leave empty)* |
   | Install Command | *(leave empty)* |

   > Vercel usually detects all of this automatically for a static site — if the fields already say "None required", just continue.

6. Click **Deploy**. In ~10 seconds you'll get a live URL like:

   ```
   https://billpilot.vercel.app
   ```

7. Done. From now on, every push to `main` redeploys automatically. Pull requests get their own preview URLs.

### Custom domain (optional)

Project → **Settings → Domains** → add your domain (e.g. `billpilot.yourname.com`) and follow the DNS instructions Vercel shows (usually one CNAME record).

---

## Option B — Deploy from your computer (Vercel CLI)

No GitHub connection needed; deploys whatever is in the folder.

```powershell
# 1. Install the Vercel CLI (needs Node.js)
npm install -g vercel

# 2. From the project folder, deploy
cd path\to\billpilot
vercel          # first run: log in, accept the defaults it detects

# 3. Ship to production
vercel --prod
```

When the CLI asks questions, the defaults are all correct for a static site (no build command, no output directory).

---

## Notes

- **No environment variables, no server, no database** — there is nothing else to configure. All invoice data lives in each visitor's own browser (`localStorage`).
- **Privacy**: because storage is per-browser, invoices created on the live site stay on that visitor's device. Clearing browser data deletes them — remind users to download PDFs of anything important.
- Any static host works the same way (GitHub Pages, Netlify, Cloudflare Pages) — Vercel is just the fastest to set up.
