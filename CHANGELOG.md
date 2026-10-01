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

## Phase 3: Editor shell

- Added `src/lib/taskTree.js`: flattens the task hierarchy into visible rows (respecting collapsed groups), renumbers order after structural edits, and collects a subtree's ids for cascade delete.
- Added `src/state/projectReducer.js`: the single reducer behind every edit. Handles task add/rename/delete/reorder/indent/outdent, dependency add/update/delete with cycle rejection, calendar changes, undo/redo with a 100-step history, and drag coalescing (a whole drag becomes one undo step).
- Added `src/lib/timelineScale.js`: zoom level constants (day/week/month/quarter pixels-per-day), date range calculation, date-to-pixel conversion, and two-tier header tick generation.
- Added `src/lib/sampleProject.js` for local development: a blank project factory, a small starter example, and a generated "performance sample" (configurable group/task count) for checking the editor stays responsive with a realistic task list.
- Built the editor UI: `Toolbar`, `TaskTable` (sticky header, windowed rows), `Timeline` (SVG grid, task bars, group brackets, milestone diamonds, today line, two-tier sticky header), and `StatusBar`. Vertical scroll stays in sync between the table and the timeline; Ctrl/Cmd+wheel steps through zoom levels; dragging empty timeline background pans the view.
- Wired up undo/redo keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z) and a resizable splitter between the table and timeline panes.
- Added `src/state/projectReducer.test.js`: 15 tests covering add/delete (including cascade delete and dependency cleanup), indent/outdent, dependency cycle rejection, and undo/redo (including drag coalescing and the history depth cap). Caught and fixed a real bug in the process: `applyDependencies` needs to be seeded with the *predecessor's* id, not the successor's, since it looks up what depends on a changed task.
- Manually verified in a running browser: task selection, zoom switching, add task, undo/redo, critical path highlighting, and scroll sync all work; loaded a 132 task generated sample and confirmed the table and timeline both stay responsive with windowed rendering (only the visible rows are actually in the DOM).
