# Changelog

## Phase 0: Scaffold

- Scaffolded the frontend with `npm create vite@latest` (React, JavaScript template).
- Installed axios, react-router-dom, html-to-image, jspdf, and Vitest with jsdom and Testing Library for the dev dependencies.
- Set up the project folder structure (`src/components`, `src/hooks`, `src/lib`, `src/pages`, `src/services`, `src/styles`, `api/`, `docs/`).
- Added routing shell (`App.jsx`) with placeholder pages for home, editor, print and 404, wired up with `BrowserRouter`.
- Added `src/styles/app.css` as the single stylesheet, with the Trebuchet MS / Courier New font stack, the eight-colour task palette as CSS variables, a visible focus style and `prefers-reduced-motion` support.
- Added the root `.htaccess` SPA fallback rule.
- Added `.config.example.json` / `.config.json` (frontend) and `api/.config.example.json` / `api/.config.json` (backend), plus a config-reading service (`src/services/config.js`) and a pre-configured axios instance (`src/services/api.js`).
- Added `api/cors.php` (shared CORS handling, reflecting localhost origins and anything in `allowedOrigins`) and `api/storage.php` (config loading, project paths, atomic read/write, token verification, id generation, shape validation). Verified the OPTIONS pre-flight returns 200 with the right headers.
- Added `api/.htaccess` (deny dotfiles) and `api/data/.htaccess` (deny all direct access, block PHP execution).
- Installed and ran `react-doctor` (findings to be reviewed in the polish phase).
- Initialised the git repository.

## Phase 1: Pure libraries

- Added `src/lib/dates.js`: ISO date parsing/formatting, all arithmetic via `Date.UTC` so dates never shift by a day because of the browser's time zone, plus UK-style `dd/mm/yyyy` formatting.
- Added `src/lib/calendar.js`: working day checks, snapping a date forward to the next working day, moving a date by a number of working days (forward or backward), counting working days between two dates, and a hard-coded table of England bank holidays for 2026 and 2027.
- Added `src/lib/scheduler.js`: `computeEnd`, `applyDependencies` (forward-only push scheduling for FS/SS/FF/SF with lag, including negative lag), `detectCycle`, `removeDependenciesForTask`, `rollUpGroups` (handles a group containing a group), and a `criticalPath` forward/backward pass.
- Added `docs/gantt.schema.json`, the JSON Schema for a project document.
- Added `src/lib/validate.js`: schema validation (via `ajv`) plus semantic checks (dangling dependency references, dependency cycles, missing parents) with plain English messages, and `sanitizeForImport` to strip `editTokenHash` and unknown keys from an uploaded file.
- Added `src/lib/migrate.js`: a schema version gate ready for future migrations.
- Added a Vitest suite (67 tests) covering the edge cases from the brief: zero-day milestones, a task starting on a non-working day, negative lag, all four dependency types, nested groups, removing a deleted task's dependencies, and a reschedule crossing a holiday block.

## Phase 2: API

- Added `project_create.php`, `project_get.php`, `project_save.php` and `project_delete.php`, all built on `storage.php`'s atomic read/write, token verification and shape validation.
- `project_save.php` enforces optimistic concurrency: a mismatched `revision` gets a 409 with the server's current copy rather than silently overwriting someone else's work.
- Added rate limiting (`enforceRateLimit` in `storage.php`): a small per-IP JSON counter file under `api/data/_rate/`, one minute windows, 429 once the configured limit is exceeded.
- Added `api/cleanup.php`, a CLI-only script (refuses to run over the web) that deletes projects untouched for longer than `retentionDays`, with a `--dry-run` flag and scheduling notes for cron and Laragon/Windows Task Scheduler.
- Manually exercised the full lifecycle (create, get with and without a token, save with a matching and a stale revision, delete with a wrong and a correct token, an invalid project id, and the rate limiter) against a local PHP server. Direct access to `api/data/*.json` and the dotfile deny rules depend on Apache honouring `.htaccess`, which needs checking again once Laragon's docroot points at this project (see README).
