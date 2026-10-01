# AGENT BRIEF: Classroom Gantt Chart Application

**Working name:** `gantt-chart` (rename freely)
**Audience for this document:** a Claude agent building the project unattended.
**Owner:** Simon Rundell, Programme Leader, Faculty of Cybersecurity and Information Technologies, Exeter College.
**Licence:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0). See the Licence section.

---

## 1. Purpose

Build a browser-based Gantt chart planner for students aged 16 to 19 on NCFE Level 2, BTEC Level 3 and T-Level Digital qualifications. Students use it to plan project work (for example an Employer Set Project or an Occupational Specialism build), save their chart as a JSON file or on the server, and come back to it later.

The look and behaviour take inspiration from <https://www.onlinegantt.com/#/gantt>: a task table on the left, a scrollable timeline on the right, drag to move or resize bars, dependency arrows, zoom levels. Do not copy its code, assets or branding. Build everything from scratch with original design.

There are **no logins**. Access is by unguessable project link, and students can also keep their own `.json` file.

---

## 2. Ground rules for the agent

### 2.1 Interaction
- You have standing permission to read, write, install packages and run commands in the project folder.
- You may ask the owner up to 5 clarifying questions before starting and up to 5 more mid-task. Prefer sensible defaults and record them in `DECISIONS.md` instead of asking.
- Keep a running `DECISIONS.md` and a `CHANGELOG.md` as you work.

### 2.2 Writing style (applies to all docs, comments, UI copy and README)
- UK English. Dates as `dd/mm/yyyy` in the UI. Weeks start on Monday.
- Write like a person. Mix short and long sentences. No em-dashes. Avoid stock AI phrasing such as "delve", "pivotal", "seamless", "robust framework", "it is important to note".
- Do not mention any private company or commercial brand in the app, README, footer or licence text. This is College work.

### 2.3 Technology (fixed)
| Layer | Choice |
|---|---|
| Frontend | React + Vite + **JavaScript** (not TypeScript), scaffolded from `npm create vite@latest` (React, JavaScript template) |
| HTTP | Axios |
| Backend | PHP REST endpoints in `/api` |
| Storage | **JSON files on disk** (no MySQL for this project) |
| Styling | **One CSS file** (`src/styles/app.css`). No inline CSS unless unavoidable, and note any exception in `DECISIONS.md`. No CSS frameworks. |
| Rendering | Custom **SVG** timeline plus CSS grid task table. No Gantt library. |
| Fonts | UI text: **Trebuchet MS** (fallback `"Trebuchet MS", "Segoe UI", sans-serif`). Code and monospace: **Courier New**. |
| Docs in code | JSDoc for all JS and JSX, PHPDoc for all PHP |

Project layout follows the Vite template, with React in the **project root** and PHP in `/api`:

```
gantt-chart/
├─ .config.json              (git-ignored, frontend settings)
├─ .config.example.json
├─ .htaccess                 (see 2.6)
├─ index.html
├─ package.json
├─ vite.config.js            (no proxy)
├─ README.md
├─ LICENSE.md
├─ DECISIONS.md
├─ CHANGELOG.md
├─ public/
├─ src/
│  ├─ main.jsx
│  ├─ App.jsx
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/                   (pure logic, unit tested)
│  ├─ pages/
│  ├─ services/              (axios calls)
│  └─ styles/app.css
└─ api/
   ├─ .htaccess              (deny dotfiles, see 8.5)
   ├─ .config.json           (git-ignored, server settings)
   ├─ .config.example.json
   ├─ cors.php               (required, see 2.5)
   ├─ storage.php            (shared file helpers)
   ├─ project_create.php
   ├─ project_get.php
   ├─ project_save.php
   ├─ project_delete.php
   └─ data/                  (git-ignored, holds project JSON, has own .htaccess)
```

### 2.4 Local development
- Laragon serves PHP from Apache on `http://localhost:80`. Vite serves only the React frontend on its own port. **No Vite proxy.**
- Before starting a dev server, check whether port 5173 is already in use. If it is, the owner's Laragon/Vite instance is already running. **Use it for testing. Do not kill the process and do not start another.**
- Frontend reads `.config.json` for `apiBase` (for example `http://localhost/gantt-chart/api`). Never hard-code URLs.
- Server settings are read from `api/.config.json`.

### 2.5 CORS (mandatory pattern)
Create `api/cors.php` and include it **first** in every endpoint. Never write CORS headers inline in an endpoint.

```php
require_once __DIR__ . '/cors.php';   // always first
require_once __DIR__ . '/storage.php';
```

`cors.php` must:
- Echo back the request `Origin` header only when it matches `localhost` on any port (and, for production, any origin listed in `allowedOrigins` in `api/.config.json`).
- Set `Content-Type: application/json; charset=utf-8`.
- Set `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`.
- Set `Access-Control-Allow-Headers: Authorization, Content-Type`.
- Return HTTP 200 and `exit()` for `OPTIONS` pre-flight requests.

### 2.6 Root `.htaccess` (use exactly this)
```apache
RewriteEngine On

# Let real files/directories (including /api/*) resolve normally.
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Everything else falls back to index.html so React Router can handle
# client-side routes (e.g. a hard refresh).
RewriteRule ^ index.html [L]
```

### 2.7 Housekeeping
- When the Vite project is created, run `npx -y react-doctor@latest install` (pre-approved) so the react-doctor skill is available, then follow its guidance.
- Use React Router with `HashRouter` **not required**. Use `BrowserRouter` since the `.htaccess` fallback handles refresh.
- Unit tests with Vitest for everything in `src/lib/`.

---

## 3. Users and sharing model

- No accounts. A project is identified by a random **project ID** and an **edit token**.
- ID: 16 characters from a URL-safe alphabet, generated with `random_bytes()` on the server.
- Edit token: separate 32 character random string, returned once on creation, stored (hashed with `password_hash` or `hash('sha256')`) inside the project file.
- Share links:
  - **Edit link:** `/p/{id}?k={editToken}`
  - **View link (Should have):** `/p/{id}` with no token opens read-only.
- Browser remembers recent projects in `localStorage` (id, title, token, last opened) so students can return without bookmarking. This is a convenience list only. Wrap storage access in try/catch.
- Show a clear, friendly notice on first save: "Anyone with this link can edit your chart. Do not put personal details in it."

---

## 4. Feature scope (MoSCoW)

The owner asked for as many features as is feasible in the MVP. Anything marked **Must** or **Should** below is in v1. **Could** is phase 2. **Won't** is out of scope for now.

### 4.1 Must have (MVP)
1. **Tasks**: create, rename, delete, reorder (drag in table and keyboard move up/down), indent and outdent to build hierarchy.
2. **Task groups (summary tasks)**: a parent task whose dates and % complete roll up from children. Collapse and expand.
3. **Milestones**: zero-duration diamond markers.
4. **Dependencies**: all four types, Finish-to-Start (FS), Start-to-Start (SS), Finish-to-Finish (FF), Start-to-Finish (SF), each with optional lag in days (negative lag allowed). Drawn as elbow arrows in SVG. Circular dependency detection with a clear message.
5. **Auto-scheduling**: moving a task pushes successors according to their dependency rules.
6. **Working calendar**: configurable working days (default Monday to Friday) and a list of non-working dates (holidays, college closures). Non-working days shaded on the timeline. Durations are counted in working days.
7. **% complete**: edit in table and drag handle on bar. Drawn as a darker fill inside the bar.
8. **Assignees**: free-text names per task, shown in the table and optionally on the bar label.
9. **Colours**: per-task colour from a fixed accessible palette (minimum 8 colours), plus a default per group.
10. **Timeline interaction**: drag bar to move, drag edges to resize, drag in empty space to pan, wheel or trackpad to scroll, `Ctrl` + wheel to zoom.
11. **Zoom levels**: Day, Week, Month, Quarter. Header shows two tiers (for example month over week).
12. **Scrollable timeline**: horizontal and vertical scrolling with the task table kept in sync. Table column stays sticky. Timeline header is sticky.
13. **Today line** and a "Go to today" button.
14. **Undo and redo**: at least 100 steps, `Ctrl+Z`, `Ctrl+Y` and `Ctrl+Shift+Z`.
15. **Save and load**:
    - Server save by project link, with autosave (debounced) and a visible save status.
    - **Download** as `.json` and **upload** a `.json` file (validated, see 7).
    - New blank project and "Start from template".
16. **Export and print**:
    - **PNG** export of the whole chart (not just the visible area).
    - **PDF** export, with page size (A4, A3) and orientation, fit-to-width or multi-page tiling.
    - **Print view**: a dedicated route with print-specific CSS in the same `app.css`, hiding editing controls.
17. **Keyboard and accessibility basics**: tab order through table, visible focus, ARIA labels on bars and buttons, colour contrast of at least WCAG AA, bars also distinguishable by pattern or label not colour alone.
18. **Responsive layout** that works on a college laptop and tablet. Editing on phones is not required, viewing is nice to have.

### 4.2 Should have (also in v1 if time allows, otherwise first in phase 2)
1. **Critical path** highlighting (toggle).
2. **Baseline**: save the current plan as a baseline and show it as a thin grey bar under each task, with variance in days.
3. **View-only share link** (see 3).
4. **Resource summary panel**: simple list of assignees with task counts and a load warning when one person has overlapping tasks.
5. **Templates**: three starter charts, for example "Employer Set Project (12 weeks)", "Web build sprint plan", "Blank".
6. **Column chooser** in the table: name, start, end, duration, % complete, assignee, predecessors, notes.
7. **Notes** field per task.
8. **Keyboard shortcut cheat sheet** dialog (`?`).
9. **Snap and grid options**: snap to day, week.
10. **Autosave conflict handling** with a "someone else saved a newer version" prompt (see 8.4).

### 4.3 Could have (phase 2)
- CSV export and import of tasks.
- Excel (`.xlsx`) export.
- Import from Microsoft Project XML, export to it.
- Multiple baselines.
- Per-project themes (high contrast, dark).
- Task comments.
- Duplicate task or group.
- Date range filter and "show only my tasks" filter.
- Embeddable read-only widget.
- Scheduled cleanup page for the teacher to see storage use.

### 4.4 Won't have (for now)
- User accounts or login.
- Real-time multi-user editing.
- Native mobile apps.
- Cost, budget or effort tracking.
- Email notifications.

---

## 5. Data model (JSON save format)

One JSON document per project. The same shape is used for the server file and for download and upload. Include `schemaVersion` so future migrations are possible.

```json
{
  "schemaVersion": 1,
  "id": "k3F9xQ2mA7pL0dVw",
  "title": "ESP Python Project",
  "createdAt": "2026-10-01T09:00:00Z",
  "updatedAt": "2026-10-01T09:30:00Z",
  "revision": 7,
  "calendar": {
    "workingDays": [1, 2, 3, 4, 5],
    "nonWorkingDates": ["2026-12-25", "2026-12-28"],
    "weekStartsOn": 1
  },
  "view": {
    "zoom": "week",
    "showCriticalPath": false,
    "showBaseline": false,
    "columns": ["name", "start", "end", "duration", "percent", "assignee"]
  },
  "tasks": [
    {
      "id": "t1",
      "parentId": null,
      "type": "group",
      "name": "Planning",
      "start": "2026-10-05",
      "durationDays": 5,
      "percent": 40,
      "assignee": "",
      "colour": "blue",
      "notes": "",
      "collapsed": false,
      "order": 0,
      "baseline": { "start": "2026-10-05", "durationDays": 5 }
    },
    {
      "id": "t2",
      "parentId": "t1",
      "type": "task",
      "name": "Write requirements",
      "start": "2026-10-05",
      "durationDays": 2,
      "percent": 100,
      "assignee": "Sam",
      "colour": "green",
      "notes": "",
      "collapsed": false,
      "order": 1,
      "baseline": null
    },
    {
      "id": "t3",
      "parentId": "t1",
      "type": "milestone",
      "name": "Requirements signed off",
      "start": "2026-10-07",
      "durationDays": 0,
      "percent": 0,
      "assignee": "",
      "colour": "orange",
      "notes": "",
      "collapsed": false,
      "order": 2,
      "baseline": null
    }
  ],
  "dependencies": [
    { "id": "d1", "from": "t2", "to": "t3", "type": "FS", "lagDays": 0 }
  ]
}
```

Rules:
- `type` is one of `task`, `group`, `milestone`.
- Dates are ISO `YYYY-MM-DD` strings with no time zone. Treat them as calendar dates and never convert through `Date` in a way that shifts the day. Write helpers in `src/lib/dates.js` that work on UTC midnight.
- `end` is **derived** from `start`, `durationDays` and the calendar. Do not store it.
- Group `start`, `durationDays` and `percent` are derived from children when they have any, and ignored on save.
- Dependency `type` is one of `FS`, `SS`, `FF`, `SF`.
- The edit token hash lives only in the server file as `editTokenHash`. It is **never** sent to the client and **never** included in downloads.

Provide a JSON Schema file `docs/gantt.schema.json` and validate on both client (on upload) and server (on save).

---

## 6. Front end design

### 6.1 Routes
| Route | Page |
|---|---|
| `/` | Home: new chart, open recent, upload `.json`, template picker |
| `/p/:id` | Editor (edit mode if valid `k` token in query or stored token, otherwise read-only) |
| `/print/:id` | Print view |
| `*` | Friendly 404 |

### 6.2 Layout of the editor
```
+----------------------------------------------------------------+
| Title [editable]   Save status   Undo Redo | Zoom | Export | ?  |
+----------------------+-----------------------------------------+
| Task table           | Timeline header (2 tiers, sticky)        |
| (sticky header,      +-----------------------------------------+
|  resizable columns)  | SVG timeline: grid, non-working shading, |
|                      | bars, milestones, arrows, today line     |
+----------------------+-----------------------------------------+
| Status bar: selected task info, project start and end, # tasks   |
+----------------------------------------------------------------+
```
- A draggable splitter sits between table and timeline.
- Table rows and timeline rows share one fixed row height (CSS variable `--row-height`, default 32px) so they stay aligned.
- Use windowed rendering of rows once there are more than 200 tasks (simple custom virtualisation, no new library needed).

### 6.3 Components (suggested)
`HomePage`, `EditorPage`, `PrintPage`, `Toolbar`, `TaskTable`, `TaskRow`, `TaskEditor` (side panel or inline), `Timeline`, `TimelineHeader`, `TimelineGrid`, `TaskBar`, `MilestoneMarker`, `DependencyArrow`, `TodayLine`, `CalendarDialog`, `ExportDialog`, `ShareDialog`, `ShortcutsDialog`, `Toast`.

### 6.4 State management
- Single reducer (`useReducer` plus context) holding the project document and UI state (selection, zoom, scroll).
- History: keep past and future stacks of project snapshots. Use structural sharing, and coalesce rapid drag events into a single undo step on mouse-up.
- Every edit action goes through `reduce(state, action)`, which calls the scheduler (6.5). Keep it pure and test it.

### 6.5 Scheduling engine (`src/lib/scheduler.js`, pure functions, fully unit tested)
Functions to provide, each with JSDoc:
- `addWorkingDays(startISO, n, calendar)` and `workingDaysBetween(aISO, bISO, calendar)`
- `computeEnd(task, calendar)`
- `applyDependencies(project, changedTaskIds)`: topological pass that moves successors forward only (never pulls tasks earlier automatically, to avoid surprising students). Honour all four dependency types and lag.
- `detectCycle(dependencies)` returns the cycle path or `null`
- `rollUpGroups(tasks)`
- `criticalPath(project)` (Should have): forward and backward pass, zero-float tasks flagged
- `validateProject(doc)`

Edge cases the tests must cover: zero-day milestones, tasks starting on a non-working day (snap forward), negative lag, SF dependencies, a group containing a group, deleting a task that has dependencies, and moving a task across a holiday block.

### 6.6 Timeline rendering
- One `<svg>` whose width equals total days times pixels-per-day for the current zoom. Suggested pixels per day: Day 36, Week 12, Month 4, Quarter 1.4. Make these constants.
- Draw in layers: background grid, non-working shading, today line, baseline bars, task bars, progress fills, milestones, dependency arrows, selection handles.
- Dependency arrows: orthogonal path with a small arrowhead, routed to avoid overlapping the source bar. Highlight on hover and on selection of either end.
- Drag handling uses Pointer Events with `setPointerCapture`. Snap to days (or weeks if the option is set). Show a tooltip with new start and end while dragging.
- Create a dependency by dragging from a bar's right-hand connector dot to another bar. Choose type by which connector dot was used (start or end dots) and let the user edit type and lag in a small popover.
- Colours come from CSS custom properties defined in `app.css`, for example `--gc-blue`, `--gc-green`. Task data stores the name, not the hex.

### 6.7 Export and print
- **PNG:** clone the chart (table plus SVG) into an off-screen container sized to the full project, rasterise with `html-to-image` (MIT) at 2x pixel ratio, then download. Provide a progress indicator for large charts.
- **PDF:** use `jsPDF` (MIT). Options: A4 or A3, landscape or portrait, fit to one page wide or tile across pages. Use the same off-screen render as PNG, then place image slices onto pages with a header (title, export date) and footer (page n of N, licence line).
- **Print view:** `/print/:id` renders a clean version and calls `window.print()` from a button. Print CSS in `app.css` under `@media print` sets `@page { size: A4 landscape; margin: 10mm; }`, hides toolbars, forces background colours with `print-color-adjust: exact`, and avoids breaking rows across pages.
- Do not add a server dependency for exports. Everything happens in the browser.

### 6.8 Accessibility and visual design
- Clean, friendly, classroom-appropriate. Light theme by default.
- Use Trebuchet MS for UI and Courier New for any code or ID display.
- Focus styles must be visible. Targets at least 24px. Do not rely on colour alone: groups use a bracket shape, milestones a diamond, completed tasks show a tick in the table.
- Support `prefers-reduced-motion`.
- All dialogs trap focus and close on `Esc`.

---

## 7. Upload and download rules

- Download filename: `{slug-of-title}-{yyyymmdd}.json`.
- Upload accepts `.json` up to the configured size limit (default 1 MB).
- Parse in a try/catch. Validate against the schema. Show a plain English list of problems if invalid (for example "Task 'Test login' depends on a task that does not exist").
- On success, ask: "Open as a new chart" or "Replace the current chart". Never silently overwrite.
- If `schemaVersion` is older, run it through `migrate()` in `src/lib/migrate.js`. If newer than the app understands, refuse politely.
- Strip `editTokenHash` and any unknown top-level keys on import. Treat uploaded text as untrusted: never render it as HTML. React escapes by default, so never use `dangerouslySetInnerHTML`.

---

## 8. Back end design (PHP)

### 8.1 Settings (`api/.config.json`, with `.config.example.json` committed)
```json
{
  "dataDir": "data",
  "maxProjectBytes": 1048576,
  "maxTasks": 1000,
  "allowedOrigins": [],
  "rateLimitPerMinute": 60,
  "retentionDays": 365
}
```

### 8.2 Endpoints
All responses are JSON. Errors use `{ "error": "message" }` with a sensible HTTP status.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `project_create.php` | Body: optional project document or template name. Returns `{ id, editToken, project }`. |
| GET | `project_get.php?id=...` | Returns the project without `editTokenHash`. Includes `canEdit: true` only if a valid token is supplied in the `Authorization: Bearer` header. |
| PUT | `project_save.php?id=...` | Header carries the edit token. Body is the project. Requires matching `revision` for optimistic concurrency. Returns the new `revision` and `updatedAt`. |
| DELETE | `project_delete.php?id=...` | Edit token required. Removes the file. |

Each file starts with:

```php
require_once __DIR__ . '/cors.php';   // always first
require_once __DIR__ . '/storage.php';
```

### 8.3 `storage.php` helpers (all with PHPDoc)
- `loadConfig()`: reads `.config.json` once.
- `projectPath($id)`: validates `$id` against `^[A-Za-z0-9_-]{16}$` and builds the path. Anything else returns 400. This prevents path traversal.
- `readProject($id)` and `writeProject($id, $doc)`: write atomically (temp file in the same folder, `flock`, then `rename`).
- `verifyToken($doc, $token)`: uses `hash_equals` for constant-time comparison.
- `sendJson($status, $payload)` and `fail($status, $message)`.
- `validateProjectShape($doc, $config)`: checks required keys, types, array sizes against `maxTasks`, string lengths (task name max 200, notes max 2000, title max 120), allowed enums, ISO date format and that dependency endpoints exist.

### 8.4 Concurrency
- Every save sends the `revision` the client last loaded. If the server file has a higher revision, return **409** with the server copy. The client then offers: "Keep mine (overwrite)", "Use theirs" or "Download mine first".
- Autosave debounce: 1.5 seconds after the last edit, plus on `beforeunload` using `navigator.sendBeacon` fallback is **not** needed. Keep it simple and show "Unsaved changes" if the final save fails.

### 8.5 Security and safety
- No SQL in this project, so no injection risk, but still validate all input as above.
- `api/data/.htaccess` must contain `Require all denied` (and the Apache 2.2 equivalent) so JSON files cannot be fetched directly. All access goes through the PHP endpoints.
- `api/.htaccess` should deny access to dotfiles such as `.config.json`.
- Disable PHP execution inside `api/data/`.
- Basic per-IP rate limiting using a small file-based counter in `api/data/_rate/`.
- Never log tokens. Never echo `editTokenHash`.
- Add a command-line `api/cleanup.php` (CLI only, refuses web access) that deletes projects not updated for `retentionDays`. Document how to schedule it with cron or Laragon's task scheduler.
- Do not collect personal data. No analytics or third-party scripts. Fonts are system fonts, so no external font requests.

---

## 9. Build plan (suggested phases)

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Scaffold: Vite React JS app, `.htaccess`, `.config` files, `react-doctor` installed, empty `api/` with `cors.php` and `storage.php` | App loads on the existing dev server and `OPTIONS` pre-flight returns 200 |
| 1 | Pure libraries: dates, calendar, scheduler, validation, migrate, with Vitest tests | All tests green, edge cases from 6.5 covered |
| 2 | API: create, get, save, delete with atomic writes, tokens, 409 handling | Manual and scripted tests pass, directory traversal attempts rejected |
| 3 | Static editor: table plus SVG timeline, zoom, scroll sync, today line, non-working shading | Chart renders a 100 task sample smoothly |
| 4 | Editing: add, rename, reorder, indent, groups, milestones, drag move and resize, % complete, colours, assignees | All Must items 1 to 3, 7 to 10 working |
| 5 | Dependencies: arrows, create by drag, four types, lag, cycle detection, auto-schedule | Must items 4 and 5 working |
| 6 | Undo and redo, autosave, download and upload, recent projects, home page, templates | Must items 14 and 15 working |
| 7 | Export: PNG, PDF, print view | Large chart exports whole, not only visible area |
| 8 | Should-haves: critical path, baseline, view-only link, resource panel, column chooser, notes, shortcuts | As time allows, in the listed order |
| 9 | Polish: accessibility pass, responsive pass, README, licence, `DECISIONS.md`, `CHANGELOG.md`, react-doctor review | Acceptance checklist below is complete |

Commit at the end of every phase with a clear message.

---

## 10. Acceptance checklist

- [ ] A student with no login can create a chart, share an edit link, close the browser, and reopen the chart from the link.
- [ ] Download then upload gives an identical chart (round trip test).
- [ ] Moving a task with FS, SS, FF and SF successors reschedules them correctly across a weekend and a configured holiday.
- [ ] A circular dependency is refused with a plain English message.
- [ ] Undo and redo work across drag, resize, edit, indent and delete.
- [ ] PNG, PDF (A4 and A3) and print view all show the **entire** chart.
- [ ] 500 tasks scroll without noticeable lag on a standard college laptop.
- [ ] Hard refresh on `/p/{id}` works through the `.htaccess` fallback.
- [ ] Direct request to `/api/data/{id}.json` returns 403.
- [ ] A 409 conflict offers the three choices and does not lose data.
- [ ] Keyboard-only use can add, edit and delete a task.
- [ ] Contrast checks pass WCAG AA.
- [ ] Every JS and JSX function has JSDoc. Every PHP function has PHPDoc.
- [ ] No inline styles remain except documented exceptions, and all styles live in `src/styles/app.css`.
- [ ] No em-dashes or private company references in UI text, comments or docs.
- [ ] `react-doctor` has been run and findings addressed or noted.

---

## 11. Documentation to produce

`README.md` should cover: what the app is, screenshot placeholder, features, quick start for Laragon and Vite, configuration (`.config.json` fields for front and back end), deployment notes for shared hosting (Hostinger or Dreamhost, including the `.htaccess` and `api/data` permissions), how share links work, the cleanup script, keyboard shortcuts and the licence summary.

A short **teacher guide** (`docs/TEACHER.md`) covering how to set the college holiday calendar, how to share a template, and suggested classroom activities for planning an Employer Set Project.

---

## 12. Licence

Release under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.

Put this precis in `LICENSE.md` and the README, with the full terms linked:

> You are free to **share** (copy and redistribute the material in any medium or format) and **adapt** (remix, transform and build upon the material), under these terms:
> - **Attribution:** you must give appropriate credit, provide a link to the licence, and indicate if changes were made.
> - **NonCommercial:** you may not use the material for commercial purposes.
> - **ShareAlike:** if you remix, transform or build upon the material, you must distribute your contributions under the same licence.
> - **No additional restrictions:** you may not apply legal terms or technological measures that legally restrict others from doing anything the licence permits.
>
> This is a summary, not a substitute for the licence. Full legal code: <https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode>
> Human readable summary: <https://creativecommons.org/licenses/by-nc-sa/4.0/>

Third-party libraries (React, Axios, Vite, jsPDF, html-to-image and so on) keep their own licences. List them with versions in `LICENSE.md` under "Third-party software".

---

## 13. Defaults the agent may assume (record any change in `DECISIONS.md`)

- Default zoom: Week.
- Default calendar: Monday to Friday, empty holiday list, with a button to add UK bank holidays for England as a one-off convenience (hard-code the dates for the current and next year, no external call).
- Default row height 32px, default colour palette of 8 named colours.
- Default new task: 1 working day, starting at the project start or the day after the selected task.
- Autosave on, 1.5 second debounce.
- Server file retention 365 days since last update.
