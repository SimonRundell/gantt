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

## Phase 4: Editing

- Extended the toolbar with add task/milestone/group buttons and a task structure group (outdent, indent, move up, move down, delete), all keyboard-reachable and disabled when nothing is selected.
- Added inline editing in the task table: double-click a task's name to rename it, click an assignee cell to edit it, click the colour swatch next to a task's name to cycle through the eight-colour palette.
- Wired up dragging on the timeline: drag the middle of a bar to move it, drag either edge to resize it (adjusting duration), and drag the small handle at the end of the progress fill to set percent complete. Each drag is one undo step, including the dependency cascade it triggers.
- Added the Delete/Backspace keyboard shortcut for removing the selected task (skipped while a text field has focus, so it doesn't fight with normal typing).
- Fixed a bug in `DRAG_PREVIEW`: it took separate `start`/`durationDays` arguments, which meant a percent-only drag had nowhere to put the new percentage. Changed it to take a generic `fields` object instead, shared by date, duration and percent drags alike.
- Manually verified in the browser: renamed a task inline and watched the timeline label update, cycled a colour swatch, dragged a bar to move it (and watched its FS successor and a milestone both cascade forward), resized a bar's end handle (duration and group roll-up updated correctly), and outdented a task out of its group. Undo cleanly reverted each of these as a single step.

## Phase 5: Dependencies

- Added `DependencyArrow`: an orthogonal (elbow) path with a short stub away from each bar and an arrowhead, covering all four dependency types by reading the predecessor's finish-or-start edge and the successor's start-or-finish edge from the dependency type.
- Added connector dots to `TaskBar` and `MilestoneMarker` (visible on hover or selection) that start a drag-to-create gesture. Dropping on a specific connector dot targets that exact edge; dropping anywhere else on a bar defaults to its start. The combination of which dot you drag from and which edge you drop on decides FS, SS, FF or SF automatically.
- Added `DependencyEditor`, a small panel for changing a selected dependency's type or lag, or deleting it, and `Toast`, a small self-dismissing notice used to show the "that would create a circular dependency" message from the reducer.
- Manually verified in the browser: clicked an existing arrow and edited its lag (watched the whole downstream chain reschedule), dragged a new dependency from a milestone's connector onto a task bar (created a Start-to-Start dependency, correctly left the unaffected schedule alone since the constraint was already satisfied), attempted a dependency that would have closed a loop (rejected, with the toast message shown), and deleted a dependency from its editor panel.

## Phase 6: Save, load and the home page

- Added `src/lib/templates.js`: the Employer Set Project (12 week) and web build sprint plan templates, each a realistic group/task/milestone/dependency structure anchored to the coming Monday, plus the blank project.
- Built `HomePage`: start from a template, upload a `.json` file (validated and migrated before use), and a recent charts list backed by `src/lib/recentProjects.js` (wrapped in try/catch throughout, since localStorage is a convenience, not a requirement).
- Added `src/services/projects.js` (create/get/save/delete against the PHP API) and wired `EditorPage` to actually load a project from the server by id, rather than always using the local sample.
- Added autosave: a 1.5 second debounce after a change, a save status in the toolbar, and a `SET_SERVER_META` reducer action for updating the tracked revision without it becoming an undo step.
- Added 409 conflict handling: `ConflictDialog` offers keep mine, use theirs, or download mine first, rather than silently discarding anyone's work.
- Added `ShareDialog` (shown automatically right after a chart is first created, and from the toolbar afterwards) with the edit link, the view-only link, copy buttons and the "anyone with this link can edit" notice.
- Added download (`src/lib/downloadFile.js`, filename `{slug}-{yyyymmdd}.json`) and upload (via `UploadChoiceDialog`, offering "open as a new chart" or "replace the current chart") in the editor toolbar.
- Added read-only support: opening a chart without a valid edit token shows "View only", disables every editing control (toolbar buttons, inline table editing, bar dragging, dependency creation) while still allowing zoom, scroll and selection.
- Found and fixed a real bug during manual testing: the autosave effect's "skip the first run" guard was a boolean ref, which React StrictMode's deliberate double-invocation of effects in development defeated, causing one spurious extra save (and an unnecessary revision bump) every time a chart loaded. Replaced it with a content-equality check against the last-saved version, which is immune to being invoked twice.
- Manually verified against a locally running PHP server: created a chart from a template (23 tasks, server-assigned id and token), watched the share dialog appear automatically, made an edit and watched the save status go from "Unsaved changes" to "Saved" with the file on disk updating to match, confirmed a fresh page load no longer bumps the revision, downloaded the chart, and opened the same chart without a token to confirm it came up "View only" with every editing control disabled.

## Phase 7: Export and print

- Added `FullChartView`: renders every row and the whole date range with no scrolling and no windowing, reusing the same `TaskRow`, `TaskBar`, `MilestoneMarker` and `DependencyArrow` building blocks as the live editor so the exported and printed output looks like the chart, not a reinterpretation of it.
- Added `PrintPage` at `/print/:id`: loads the project read-only, shows a "Print this chart" button that calls `window.print()`, and otherwise just renders `FullChartView`. Print styling (A4 landscape, 10mm margins, hiding the print button, forcing background colours to print, avoiding breaking a row across a page) lives in `app.css` under `@media print`.
- Added `src/lib/exportChart.js`: `exportChartAsPng` rasterises a DOM node with `html-to-image` and downloads it; `exportChartAsPdf` does the same then slices the resulting image across one or more `jsPDF` pages, with a title/date header and a page-number/licence footer on every page. "Fit to one page wide" scales the whole chart to the page's width and tiles vertically as needed; "tile across pages" prints close to actual size across a grid of pages both ways.
- Added `ExportDialog` (format, page size, orientation, fit) and wired an always-mounted, off-screen `FullChartView` into the editor (positioned far off-screen, not `display: none`, since rasterising needs an actual laid-out and painted element) so export always captures the entire chart regardless of the current scroll position or zoom level in the visible editor.
- Manually verified in the browser: exported a seven-task chart as both PNG and PDF (A4 landscape, fit to width) with no errors, confirmed the off-screen export node renders all tasks before export, and opened the print view to confirm the whole chart renders with a working print button.

## Phase 9: Polish

- Ran `react-doctor`: score went from 66/100 to 78/100. Added a shared `Dialog` component (wrapping the native `<dialog>` element) and moved every dialog (`ConflictDialog`, `DependencyEditor`, `ExportDialog`, `ShareDialog`, `UploadChoiceDialog`) onto it, which gives all of them real focus trapping and Escape-to-close for free. Fixed a keyboard-inaccessible click handler (the assignee cell is now a real button), an invalid `<label>` wrapping two controls in `ShareDialog`, a missing `pointercancel` handler on the timeline's pan gesture, and an O(n²) lookup in `validate.js`.
- Extracted `useBarDrag` and `useAutosave` out of `EditorPage.jsx` to cut down its size and complexity.
- Fixed a real WCAG AA contrast failure: the yellow task colour (`#ca8a04`) only reached 2.94:1 against white, under the 3:1 minimum for non-text UI components. Darkened it to `#a16207` (4.92:1). Checked the rest of the eight-colour palette and all the app's text/background pairs by calculating contrast ratios directly; everything else already passed.
- Added `ShortcutsDialog`, opened with `?` or from the toolbar, listing every keyboard shortcut the editor supports.
- Checked responsive behaviour: tablet (768px) works well, with the toolbar wrapping onto a second row. Phone (375px) is cramped, since the task table's minimum width leaves little room for the timeline; left as-is since the brief marks phone viewing as a nice-to-have, not a requirement.

## Acceptance testing

- Fixed saves failing on Apache: the Authorization header never reached PHP, so every save, delete and edit-token check returned 403. Fixed in `.htaccess` and `api/storage.php`.
- Fixed "Keep my version" in the conflict dialog looping forever: it re-saved with the stale revision and hit another 409. `save` now takes the server's revision explicitly.
- Root `.htaccess` now blocks `.git` and other dotfiles (they were being served).
- Keyboard-only rename: F2, or Enter on an already selected row. Listed in the shortcuts dialog. The rename box now selects its text on open.
- PNG and PDF export use an adaptive pixel ratio so a 500 task chart stays within canvas limits. PDF tile mode now prints at the intended size.
- Added JSDoc to 15 nested helper functions that lacked it.
- New tests: undo/redo across drag, resize, edit, indent and delete; FS, SS, FF and SF across a weekend and holiday block; `safePixelRatio`. Suite is 120 tests, all passing.
- Setup note: `.config.json` is gitignored, so a fresh checkout needs `cp .config.example.json .config.json` before `npm run build`.

## Visual refresh

- New look: navy and sky blue brand theme, a two row toolbar (title bar plus tool groups) with line icons, button variants (`btn--primary`, `btn--accent`, `btn--ghost`, `btn--danger`, `btn--on-dark`), a hero header and template cards on the home page, softer dialogs, bar shadows and a clearer table header. All in `src/styles/app.css`.
- Added the floating college banner (`src/components/CMFloatAd.jsx`), shown on every page and hidden when printing. Its inline styles were moved into CSS classes to keep to the single stylesheet rule, and the status bar leaves room for it.
- Added `Icon.jsx`, a small set of inline SVG icons.
- The timeline header uses a shadow instead of a bottom border so it stays exactly 48px and its rows line up with the task table.
- `index.html` links `/favicon.png` (the file itself still needs to be placed in `public/`).

## Calendar dialog

- Added `CalendarDialog` (toolbar **Calendar** button): working days, week start, and holidays or closures added as single days or ranges, shown grouped with remove buttons, plus one-click England bank holidays for 2026 and 2027. Edits are drafted and applied with Save as one undo step.
- Saving a calendar now moves tasks that start on a non-working day forward to the next working day (groups still roll up from their children).
- Added `src/lib/calendarEdit.js` with tests for the range and grouping logic.
- Corrected `docs/TEACHER.md`, which numbered working days 1 to 7; the file format uses 0 (Sunday) to 6 (Saturday). The guide now describes the dialog instead of editing JSON.
