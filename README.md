# Gantt Chart Planner

A free, login-free Gantt chart tool for planning coursework and group projects. Pick a template or start blank, build a plan with tasks, groups, milestones and dependencies, then share a link with yourself or your group and come back to it any time.

> Screenshot: add a picture of the editor here (`docs/screenshot.png`).

## Features

- Tasks, groups (nested), and milestones, with drag to move, drag the edge to resize, and a handle for percent complete.
- Four dependency types (finish-to-start, start-to-start, finish-to-finish, start-to-finish) with lag, created by dragging between bars. Circular dependencies are refused with a plain English message.
- Automatic scheduling around a working calendar: choose working days and add holidays or closures (single days or ranges, plus built-in England bank holidays for 2026 and 2027) in the Calendar dialog.
- Critical path highlighting.
- Undo and redo (100 steps).
- Zoom: day, week, month and quarter.
- Autosave, with a conflict dialog if two people save at once so nothing is lost silently.
- Share links: an edit link and a view-only link. No accounts.
- Download and upload as a `.json` file.
- Export to PNG and PDF (A4 or A3), and a print view. Exports include the whole chart.
- Starter templates (Employer Set Project, web build sprint plan).
- Keyboard accessible, with a shortcuts cheat sheet (press `?`).

## Quick start (Laragon and Vite)

You need Node.js and Laragon (Apache and PHP 8).

1. Put the project folder where Apache serves it (the Laragon `www` folder, or add the folder as a site). The API should answer at `http://localhost/api/`.
2. Install the frontend packages:

   ```bash
   npm install
   ```

3. Create the frontend config (it is not committed):

   ```bash
   cp .config.example.json .config.json
   ```

4. Optionally create the API config (defaults are used if it is missing):

   ```bash
   cp api/.config.example.json api/.config.json
   ```

5. Start the dev server and open the address it prints (normally `http://localhost:5173`):

   ```bash
   npm run dev
   ```

Other commands:

```bash
npm test        # unit tests (Vitest)
npm run lint    # oxlint
npm run build   # production build into dist/
```

For large chart testing in dev, open `/p/x?sample=large` (about 130 tasks) or `/p/x?sample=huge` (about 520 tasks).

## Configuration

### Frontend: `.config.json` (project root)

Read at build time.

| Field | Meaning | Default |
|---|---|---|
| `apiBase` | Origin and path of the PHP API | `http://localhost/api` |
| `maxUploadBytes` | Largest `.json` file accepted on upload | `1048576` (1 MB) |

### Backend: `api/.config.json`

| Field | Meaning | Default |
|---|---|---|
| `dataDir` | Folder (inside `api/`) where project files are stored | `data` |
| `maxProjectBytes` | Largest project the server will store | `1048576` |
| `maxTasks` | Most tasks allowed in one project | `1000` |
| `allowedOrigins` | Extra browser origins allowed by CORS, besides localhost | `[]` |
| `rateLimitPerMinute` | Requests per minute allowed from one client | `60` |
| `retentionDays` | Days since last update before the cleanup script deletes a project | `365` |

Every endpoint includes `api/cors.php` first. It reflects any `localhost:PORT` origin back to the browser, so Vite works on whatever port it picks.

## Deployment on shared hosting (Hostinger, Dreamhost and similar)

1. Set `apiBase` in `.config.json` to your live API address, then run `npm run build`.
2. Upload the contents of `dist/` to the web root.
3. Upload the `api/` folder and the root `.htaccess`. The `.htaccess` does three jobs: it sends unknown paths to `index.html` so refreshing `/p/{id}` works, it passes the `Authorization` header through to PHP (Apache drops it otherwise, and saving would fail), and it blocks hidden files such as `.git`.
4. Make `api/data/` writable by PHP (usually `755`, or `775` if the host needs it). It contains an `.htaccess` that refuses all direct requests, so project files can only be reached through the API. Check this by requesting `/api/data/anything.json`; you should get a 403.
5. Add your site's origin to `allowedOrigins` in `api/.config.json` if the frontend and API are on different origins.
6. Schedule the cleanup script (below).

The rewrite rules need `AllowOverride All` in Apache.

## How share links work

Creating a chart gives it a random 16 character id and a random edit token. The server stores only a hash of the token.

- **Edit link:** `/p/{id}?k={token}`. Anyone with this link can change the chart, so treat it like a password and do not put personal details in the chart.
- **View link:** `/p/{id}`. Opens read-only. Zoom, scroll and selection still work.

The browser remembers recent charts (and their edit tokens) in local storage, so the home page can reopen them. Clearing browser data loses that list, not the charts. Keep the edit link somewhere safe.

If two people save at the same time, the second save is refused with a conflict. The editor then offers three choices: download my version first, use their version, or keep mine (overwrite theirs).

## Cleanup script

`api/cleanup.php` deletes projects not updated for `retentionDays`. It only runs from the command line and refuses web requests.

```bash
php api/cleanup.php --dry-run   # show what would be deleted
php api/cleanup.php             # delete
```

Schedule it daily. With cron:

```
5 0 * * * /usr/bin/php /path/to/gantt/api/cleanup.php >> /path/to/gantt/api/data/cleanup.log 2>&1
```

On Windows, use Laragon or Windows Task Scheduler to run `php.exe` with the full path to `api\cleanup.php`.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Y or Ctrl+Shift+Z | Redo |
| Delete or Backspace | Delete the selected task |
| Enter or Space | Select the focused task row |
| F2, or Enter on a selected row | Rename the selected task |
| Tab and Shift+Tab | Move focus between controls |
| Esc | Close the open dialog |
| Ctrl + scroll wheel | Zoom the timeline |
| ? | Show the shortcut list |

## Project layout

```
api/            PHP endpoints (project_create, get, save, delete, cleanup), cors.php, storage.php
docs/           JSON schema and the teacher guide
src/lib/        Pure logic (dates, calendar, scheduler, validation), unit tested
src/state/      Reducer and undo history
src/components/ Editor pieces (table, timeline, dialogs)
src/pages/      Home, editor and print pages
src/styles/     app.css, the only stylesheet
```

Design choices and their reasons are in `DECISIONS.md`; the history is in `CHANGELOG.md`. Teachers should read [docs/TEACHER.md](docs/TEACHER.md).

## Licence

Released under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).

- **Attribution:** give credit, link to the licence, and say if you changed it.
- **NonCommercial:** no commercial use.
- **ShareAlike:** share your changes under the same licence.

Full terms and third-party software are listed in [LICENSE.md](LICENSE.md). Legal code: <https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode>
