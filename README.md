<p align="center">
  <img src="assets/readme/flaming-logo.png" alt="Bourbon Hunters flaming logo" width="420">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/type-PWA-c8a25a?style=for-the-badge">
  <img src="https://img.shields.io/badge/backend-Cloudflare%20Worker-f38020?style=for-the-badge&logo=cloudflare&logoColor=white">
  <img src="https://img.shields.io/badge/AI-Hunter-c8a25a?style=for-the-badge">
  <img src="https://img.shields.io/badge/hosting-GitHub%20Pages-181717?style=for-the-badge&logo=github&logoColor=white">
</p>

<h1 align="center">Bourbon Hunters</h1>
<p align="center"><b>DISCOVER - TRACK - HUNT</b></p>
<p align="center">Premium PWA prototype for bourbon discovery, bottle scanning, wishlist, collection tracking and account sync.</p>

---

## Quick Links

| View | Link |
|---|---|
| App | [bourbon-hunters](https://backloghero-lang.github.io/bourbon-hunters/) |
| Test launcher | [test-index.html](https://backloghero-lang.github.io/bourbon-hunters/test-index.html) |
| Project docs | [`pliki-md`](pliki-md) |
| Figma importer | [`design/figma-import-plugin`](design/figma-import-plugin) |
| Worker | [`agent/worker.js`](agent/worker.js) |
| D1 schema | [`agent/d1-schema.sql`](agent/d1-schema.sql) |

## What It Does Today

The scanner reads a bottle label photo and asks Hunter to match it against the bourbon database.

Current quality rule:

1. Hunter recognizes the bottle name from the photo.
2. The Worker checks `db/bourbons.json` first.
3. A normal result is shown only when match confidence is at least 80%.
4. Lower-confidence scans do not return a random bottle. They show the planned `Hunter AI Plus` state.

| Feature | Status |
|---|---|
| Fast rating | Database-first result with price/value and tasting profile |
| AI analysis | Deeper description for confident matches |
| Hunter AI Plus | Planned Pro feature for deeper matching, web search, profile creation and saving new finds |
| Accounts | Email/password through Cloudflare Worker + D1 |
| Account sync | Wishlist, collection, user ratings and scan history |
| Age gate | Date of birth required at registration; default 18+, configurable to 21+ for US mode |
| Username validation | Duplicate username detection with generated suggestions |
| Password reset | UI and Worker placeholder ready; transactional email provider still required |
| Google Sign-In | UI placeholder, not connected yet |

## Architecture

```text
Phone / PWA -> Cloudflare Worker -> database match / Hunter AI
index.html     agent/worker.js      D1, KV, bourbon JSON data
```

- Frontend: `index.html`, `manifest.json`, `sw.js`.
- Backend: `agent/worker.js` on Cloudflare Workers.
- User data: Cloudflare D1 for accounts, sessions, wishlist, collection, ratings and scan history.
- D1 migrations: run `agent/d1-schema.sql` for a fresh database and `agent/d1-migration-v57-auth-age.sql` for existing databases that need age-gate columns.
- Static hosting: GitHub Pages.
- Project docs and planning files: `pliki-md/`.
- Figma asset importer code: `design/figma-import-plugin/`.

## Current Backend Notes

- Registration requires email, password, username and date of birth.
- Passwords are stored as PBKDF2 SHA-256 hashes with salt, never as plain text.
- The Worker exposes `/auth/health` for a quick D1/schema check.
- Transactional emails are not active yet. Welcome, password reset and data deletion templates live in `pliki-md/email-templates/`.
- Google Sign-In is intentionally left as a UI placeholder until OAuth is implemented.

## Project Direction

This public repo is a showcase/prototype. The commercial version should move into a private production repo before adding paywall, Google Play release work, advanced AI Plus logic, image storage and business integrations.

## Responsible Use

Prices and ratings are approximate. Drink responsibly. 18+ / 21+ where required by law.
