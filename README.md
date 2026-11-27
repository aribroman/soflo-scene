# SoFlo Scene

Free and paid things to do across South Florida — Miami-Dade, Broward, and Palm Beach — with dates, prices, map directions, and add-to-calendar support.

**Live site:** https://aribroman.github.io/soflo-scene/

## How it works

- **`site/`** — Zero-dependency static web app (`index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `data/events.js`). Works offline via service worker and loads straight from GitHub Pages.
- **`pipeline/`** — Python event scraper (`run.py`, `common.py`, `sources/*.py`) that pulls live feeds from Eventbrite, Hard Rock Live, Kaseya Center, Kravis Center, South Florida venues, Tribe calendars, and public iCal feeds, merges hand-curated picks (`pipeline/picks.json`), deduplicates, drops past events, and writes `site/data/events.js` + `site/data/updated.json`.
- **`build/`** — Node.js library events snapshot builder (`pull.mjs`, `sources.mjs`) invoked automatically by `pipeline/run.py` to refresh Miami-Dade, Broward, and Palm Beach library events.

## Automatic twice-daily updates ($0/month)

GitHub Actions (`.github/workflows/update-and-deploy.yml`) runs automatically on GitHub's free tier:

- **Schedule:** Twice daily at **5:00 AM EST (`10:00 UTC`)** and **5:00 PM EST (`22:00 UTC`)** (`cron: '0 10,22 * * *'`).
- **What it does:** Installs `curl_cffi` and `requests`, runs `python3 pipeline/run.py`, commits refreshed `site/data/` and `pipeline/out/` state back to `main`, and deploys `site/` to GitHub Pages.

## Trigger a manual refresh

1. Open the **Actions** tab in this repository on GitHub.
2. Select **Update Events & Deploy SoFlo Scene** in the left sidebar.
3. Click **Run workflow** -> **Run workflow**.
4. Wait ~2 minutes for the scrape and Pages deploy to finish.

## Run locally

```bash
pip install -r requirements.txt
python3 pipeline/run.py
# Preview locally:
python3 -m http.server 8080 --directory site
```

## Attach a custom domain later

1. Buy/pick a domain (e.g., `sofloscene.com`) at Cloudflare, Namecheap, or Porkbun.
2. In this repo, go to **Settings -> Pages -> Custom domain**, enter your domain, and click **Save**.
3. At your DNS registrar, point your domain to GitHub Pages:
   - For an apex domain (`sofloscene.com`): add `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - For a subdomain (`www.sofloscene.com`): add a `CNAME` record pointing to `aribroman.github.io`.
4. Once DNS propagates, check **Enforce HTTPS** in **Settings -> Pages** and update the canonical/Open Graph URLs in `site/index.html`.
