<p align="center">
  <img src="assets/readme/flaming-logo.png" alt="Bourbon Hunters flaming logo" width="420">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/type-PWA-c8a25a?style=for-the-badge">
  <img src="https://img.shields.io/badge/backend-Cloudflare%20Worker-f38020?style=for-the-badge&logo=cloudflare&logoColor=white">
  <img src="https://img.shields.io/badge/scanner-visual%20AI-c8a25a?style=for-the-badge">
  <img src="https://img.shields.io/badge/hosting-GitHub%20Pages-181717?style=for-the-badge&logo=github&logoColor=white">
</p>

<h1 align="center">Bourbon Hunters</h1>
<p align="center"><b>DISCOVER - TRACK - HUNT</b></p>
<p align="center">A premium PWA for label-based bottle recognition, whisky discovery, ratings, recommendations and collection tracking.</p>

---

## Quick Links

| View | Link |
|---|---|
| App | [Bourbon Hunters PWA](https://backloghero-lang.github.io/bourbon-hunters/) |
| Test launcher | [test-index.html](https://backloghero-lang.github.io/bourbon-hunters/test-index.html) |
| Project docs | [`pliki-md`](pliki-md) |
| News agent | [`pliki-md/NEWS.md`](pliki-md/NEWS.md) |
| Deployment guide | [`pliki-md/INSTRUKCJA.md`](pliki-md/INSTRUKCJA.md) |
| Worker | [`agent/worker.js`](agent/worker.js) |
| D1 schema | [`agent/d1-schema.sql`](agent/d1-schema.sql) |

## Current Product

| Area | Current behavior |
|---|---|
| Bottle scanner | Visual-only label recognition. OCR is disabled after the rollback described in `pliki-md/DECISIONS.md`. |
| Match confirmation | The user confirms one or two catalog candidates before opening bottle details. |
| Catalog | Canonical products shared by the lightweight app database and the scanner index; vintages, private picks, gift sets and duplicate labels are consolidated or removed. |
| Bottle details | Large, centered bottle presentation plus proof/ABV, suggested price, community rating, personal rating, general information and tasting notes. List thumbnails keep their compact size. |
| Collections | Wishlist, collection, ratings and scan history synchronize through the Worker after sign-in. |
| Community | User recommendations, comments, profile markers and community ratings. |
| Accounts | Email/password, password reset and Google OAuth through Cloudflare Worker + D1. |
| Bottle images | Published catalog assets use R2 and Cloudflare Images. Private local cutouts are normalized to 960x1280 and quality-checked for cropped bottles, hands and damaged segmentation. |
| Whisky news | Public feed on Home and `Profile -> Articles`, seeded with six starter articles and refreshed every Monday and Thursday. Article links open outside the PWA and the app restores its prior view if Android reloads it. |

The scanner must not invent a bottle when the catalog evidence is weak. A recognized candidate is displayed for explicit user confirmation; uncertain scans return a retry state.

## Architecture

```text
GitHub Pages PWA
  |
  +--> Cloudflare Worker
         |
         +--> Gemini visual matching and grounded news discovery
         +--> D1: accounts, sync, ratings, catalog, telemetry, news
         +--> R2: approved shared bottle assets
         +--> Cloudflare Images: cutout and image normalization
```

- Frontend: `index.html`, `manifest.json`, `sw.js`, `spirit-taxonomy.js`.
- Backend: `agent/worker.js`.
- Lightweight UI catalog: `db/bourbons.json`.
- Scanner catalog: `db/catalog/scan-index.json`.
- Static hosting: GitHub Pages.
- Current PWA cache: `bourbon-hunters-v102`.

## Whisky News

The news feature stores only article metadata, short original summaries and external links. It does not copy full article text or source images into Bourbon Hunters storage.

- Public endpoint: `GET /news`.
- Admin refresh: `POST /admin/news/refresh`.
- Allowed publishers: Whisky Advocate, Whisky Magazine, The Whiskey Wash and Distiller.
- Empty feed: one-time seed of six verified starter articles.
- Schedule: one daily Cron Trigger; the Worker fetches up to three new articles on Monday and Thursday.
- Retention: articles are deleted 30 days after `created_at`.
- Deduplication: unique canonical URL plus an execution marker in `news_agent_runs`.
- Full operating guide: [`pliki-md/NEWS.md`](pliki-md/NEWS.md).

## Deployment

For an existing environment, keep this order:

1. Run the missing numbered D1 migrations through `agent/d1-migration-v68-whisky-news.sql`.
2. Confirm Worker bindings: `DB`, `BOTTLE_IMAGES` and `IMAGES`.
3. Configure Worker secrets and variables described in [`pliki-md/INSTRUKCJA.md`](pliki-md/INSTRUKCJA.md).
4. Deploy the current `agent/worker.js`.
5. Keep one daily Cron Trigger, for example `0 3 * * *`.
6. Publish the frontend through GitHub Pages.
7. Open [`/auth/health`](https://bourbon-hunters.darekmaslyk.workers.dev/auth/health) and verify the required schema/readiness flags.

News requires:

```text
news_schema: true
news_agent_ready: true
news_agent_version: whisky-news-google-grounded-v1
news_retention_days: 30
starter_news_count: 6
local_image_pipeline_version: local-bottle-cutout-v2-quality-gated
cutout_quality_ready: true
```

No additional migration is required after v68 to enable the starter feed or 30-day retention.

## Validation

Useful checks:

```powershell
node --check agent/worker.js
node scripts/news-agent-regression.mjs
node scripts/ui-news-scroll-smoke.mjs
node scripts/ui-local-photo-smoke.mjs
node scripts/ui-taxonomy-smoke.mjs
```

The test launcher can clear the installed PWA cache when a phone still displays an older GitHub Pages build.

## Documentation

- [`pliki-md/HANDOFF.md`](pliki-md/HANDOFF.md) - current technical state and recent work.
- [`pliki-md/HANDOFF-BH-1.1.md`](pliki-md/HANDOFF-BH-1.1.md) - compact continuation context.
- [`pliki-md/PROJECT.md`](pliki-md/PROJECT.md) - product direction.
- [`pliki-md/DECISIONS.md`](pliki-md/DECISIONS.md) - durable architecture and product decisions.
- [`pliki-md/ROADMAP.md`](pliki-md/ROADMAP.md) - current and future work.
- [`pliki-md/NEWS.md`](pliki-md/NEWS.md) - news feed, agent, Cron, retention and troubleshooting.
- [`pliki-md/INSTRUKCJA.md`](pliki-md/INSTRUKCJA.md) - Cloudflare and GitHub deployment steps.

## Project Direction

This public repository is a showcase and working prototype. Before introducing production billing, store releases or private business integrations, the commercial version should move to a private production repository with separate environments and secrets.

## Responsible Use

Prices and ratings are approximate. Drink responsibly. 18+ / 21+ where required by law.
