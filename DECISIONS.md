# Decisions

A running log of choices made while building the Gantt chart planner, kept so later phases (and the owner) know why something is the way it is. Newest at the bottom.

## Phase 0

- **API base URL default.** The brief's own example (`http://localhost/gantt-chart/api`) assumes the app lives in a subfolder of a shared Laragon docroot. The owner's general working convention (in their global Claude instructions) is to repoint Laragon's Apache docroot directly at each project's root, which makes the API reachable at `http://localhost/api`. Went with the latter as the default in `.config.example.json`, since it matches how the owner runs every other project. The owner is repointing Apache themselves; if they use a different arrangement (a dedicated vhost, a subfolder, etc.) they just need to edit `apiBase` in `.config.json` to match, no code changes needed.
- **Config loading.** `.config.json` sits at the project root (not in `public/`), so the frontend reads it with a plain ES module import (`src/services/config.js`) rather than a runtime fetch. That means a change to `.config.json` needs a dev server restart (or rebuild) to take effect, which is an acceptable trade-off for a setting that rarely changes.
- **Lint tool.** The current `npm create vite@latest` React template ships with Oxlint rather than ESLint. The brief doesn't mandate ESLint specifically, so kept Oxlint as the default rather than swapping it out.
- **react-doctor.** Installed per the brief; added a `doctor` script to `package.json`. Findings will be reviewed in the polish phase (phase 9) rather than chased individually as they appear, so the codebase has something worth linting by then.
- **Existing dev server on port 5173.** Something (the IDE's own preview panel) was already serving the app on port 5173 before any `npm run dev` was run deliberately. Per the brief, left it alone rather than starting a second one.

## Phase 1

- **Lag is in working days.** The brief says dependency lag is "in days" without saying which kind. Treated it as working days, consistent with durations already being working days and with how most desktop Gantt tools apply lag against the project's own calendar by default. A negative lag of 1 working day lets a successor start the same working day its predecessor finishes (a one-day overlap).
- **`validateProject` lives in `src/lib/validate.js`, not `scheduler.js`.** The brief's function list put it alongside the scheduler, but it made more sense to separate "pure scheduling maths" (`scheduler.js`) from "is this uploaded file trustworthy" (`validate.js`, which pulls in `ajv` and the JSON Schema file). `validate.js` calls `scheduler.detectCycle` for the cycle check rather than duplicating it.
- **Client-side schema validation uses `ajv` + `ajv-formats`.** Both were already present transitively (via `react-doctor`'s dependencies); promoted them to direct dependencies rather than hand-rolling a schema checker. The PHP side does not use a schema library (no Composer dependency was introduced); `api/storage.php`'s `validateProjectShape` enforces the same rules by hand, which keeps the backend dependency-free.
- **`rollUpGroups(tasks, calendar)` takes a calendar argument.** The brief's suggested signature was `rollUpGroups(tasks)`, but computing a group's rolled-up duration needs the working calendar to measure working days between the earliest child start and latest child end, so a calendar parameter was added.
- **UK bank holidays hard-coded for 2026 and 2027 only**, per the brief's "current and next year, no external call" instruction. The table will need a new entry added for 2028 before the "add bank holidays" button is useful that far ahead; `ukBankHolidaysForYear` returns an empty list for a year it doesn't know, rather than guessing.

## Phase 2

- **Rate limit counter filenames strip colons.** An IPv6 loopback address (`::1`) contains colons, which Windows forbids in filenames. The first rate-limiter test run actually hit this and threw a PHP warning on `fopen`; fixed by excluding `:` from the allowed character set when building the counter filename.
- **`project_save.php` rebuilds the whole document server-side** rather than merging the client's body on top of the stored one. Only the fields a client is allowed to change (title, calendar, view, tasks, dependencies) are taken from the request; `id`, `createdAt` and `editTokenHash` always come from the existing file. This makes it impossible for a save request to smuggle in a changed id or token hash.
- **Rate limiting could not be tested through Apache yet**, since Laragon's docroot hasn't been repointed at this project (the owner is doing that manually). Verified the whole API lifecycle, including the rate limiter, against PHP's built-in development server instead; the Apache-specific checks (direct `/api/data/*.json` access returning 403, dotfile deny) still need a pass once the docroot points here.

## Phase 3

- **The editor works against a local sample project, not the server yet.** `EditorPage` currently builds a starter project (or, with `?sample=large`, a generated one) in memory rather than loading it from `project_get.php`. Real server load and save are planned for the save/load phase (brief phase 6) alongside autosave and the download/upload flow, so building the editor now didn't have to wait on that wiring. The project id from the URL is already read and displayed, ready to be used once loading is connected.
- **Row order is a single global float-ish sequence**, renumbered to clean integers after every structural edit (`renumberOrder` in `taskTree.js`). New tasks are inserted at `afterTask.order + 0.5` so they land in the right place before renumbering tidies things up; this avoids needing to shift every other task's order by hand on every insert.
- **Groups and milestones are excluded from `applyDependencies`' push queue** (a group's dates are a roll-up, not an independent schedule) but a dependency can still point *at* a group in the data; the reducer does not special-case that yet, since the brief doesn't call for it explicitly. Worth revisiting if students start depending on group tasks directly.
- **Vite dev server port.** Added `server: { port: Number(process.env.PORT) || 5173 }` to `vite.config.js` so the Claude Code preview tooling's port assignment actually takes effect; without it Vite always tried 5173 first regardless of what port the harness expected. Does not change normal `npm run dev` behaviour (still defaults to 5173).
- **Bars are distinguished from each other mainly by their text label**, not pattern fills. Every bar always shows its task name alongside it, groups use a distinct bracket shape and milestones a diamond, which covers the brief's "not colour alone" requirement without the extra complexity of SVG pattern fills per colour. Noting this in case a future accessibility pass decides patterns are worth adding.

## Phase 4

- **Colour picker is click-to-cycle, not a popover palette.** Clicking the small swatch next to a task's name steps to the next of the eight colours rather than opening a picker to choose directly. It's fully keyboard accessible (a real button, reachable by Tab, activated by Enter/Space) and far simpler to build correctly than a popover with its own focus trapping; worst case a student clicks through at most seven extra times to reach the colour they want. Worth revisiting with a proper popover if there's time left in the polish phase.
- **Indent/outdent and reorder are toolbar buttons, not Tab/Shift+Tab.** Tab already has an important job (moving focus between controls for keyboard and screen reader users), so hijacking it for indent would break standard navigation. Dedicated "Indent", "Outdent", "Up" and "Down" buttons in the toolbar do the same job and stay fully keyboard reachable.
- **Delete/Backspace deletes the selected task** everywhere except while a text input or textarea has focus (checked via `event.target.tagName`), so renaming a task or typing in a field doesn't accidentally delete it.

## Phase 5

- **Dependency type from a connector drag is inferred, not chosen up front.** Dragging from a bar's start dot vs its end dot picks the predecessor side (S vs F); dropping on the target's own start or end connector dot picks the successor side, and dropping anywhere else on the target bar defaults to its start (so a plain drag-and-drop gives the common Finish-to-Start or Start-to-Start case without any extra clicks). The `DependencyEditor` panel is there for the less common FF/SF cases or to adjust lag afterwards, rather than asking the student to pick a type before they've even dropped the arrow.
- **Dependency arrows are drawn for every dependency whose both ends are currently visible**, not just the ones in the windowed row range the table/timeline are currently rendering. An arrow can span many rows on a long chart, so limiting it to the virtualised window would make arrows flicker in and out as you scroll. With realistic numbers of dependencies (tens, not thousands) this is not a performance concern.
- **A testing gotcha worth recording, not a code bug:** while manually driving the app through synthetic `PointerEvent`s in a headless browser, checking `document.querySelector` immediately after `dispatchEvent` sometimes read the DOM before React's state update had flushed, making working features look broken. Adding a short `await` between dispatching an event and checking its effect resolved it. Noted here in case future manual testing hits the same false alarm.

## Phase 6

- **Upload "open as a new chart" always creates a fresh server copy**, even when uploaded from inside an existing chart's editor, rather than trying to reuse the current project slot. This matches the brief's "ask: open as a new chart or replace the current chart" wording and keeps the two choices genuinely distinct: replace changes this chart in place, open-as-new gets its own link.
- **Read-only gating is a dispatch guard plus a `readOnly` prop**, not a second code path. `EditorContent` wraps the reducer's dispatch so content-changing actions are silently dropped when the project was opened without a valid edit token (view/select/zoom actions still pass through), and a `readOnly` prop threaded into `Toolbar` and `TaskTable` disables the matching buttons and inline-edit affordances so the UI doesn't invite edits it would then ignore.
- **Autosave watches the whole undoable content (title, calendar, view, tasks, dependencies) as one block**, debounced 1.5 seconds, rather than triggering a save from inside every single reducer action. This keeps the save logic in one place in `EditorPage` instead of threading a "did content change" callback through forty-odd reducer cases, at the cost of a `JSON.stringify` comparison on every content change - acceptably cheap at the task counts this app targets.
- **The conflict dialog's "keep mine" option re-submits the same content with the server's newer revision number** rather than diffing or merging the two versions. A proper merge is a much bigger feature (and a risky one to get subtly wrong); "keep mine" vs "use theirs" vs "download mine first" matches what the brief asked for and gives the student an explicit, honest choice instead of a silent merge that might not be what they wanted.

## Phase 7

- **"Fit to one page wide" tiles vertically; "tile across pages" tiles both ways at near-actual size.** The brief names the two fit options but doesn't spell out exactly what each does for a chart taller than one page. Interpreted "fit to one page wide" as: scale so the chart's width matches the page's printable width, then stack as many pages vertically as the (now-scaled) height needs - "one page wide" describes the horizontal fit, not a promise that everything lands on a single sheet. "Tile across pages" instead keeps close to the chart's natural size (96 DPI, so roughly what you'd see on screen) and tiles in both directions, trading more pages for more readable detail on a long or wide chart.
- **Export always rasterises an off-screen, full-size copy of the chart**, not the on-screen editor. The visible editor is deliberately windowed and scrolled for performance; a brief where every acceptance check says "show the entire chart" ruled out capturing whatever happens to be on screen. The off-screen copy is positioned far outside the viewport (`left: -100000px`) rather than `display: none`, since `html-to-image` needs the element actually laid out and painted to rasterise it.
- **The print page re-fetches the project from the server** rather than receiving it from the editor, since `/print/:id` is its own route a student might open directly (a new tab, a bookmark) without ever having the editor open. It loads read-only and does not need an edit token.

## Phase 9

- **`react-doctor` went from 66/100 to 78/100.** Fixed 13 of 16 findings: every dialog (`ConflictDialog`, `DependencyEditor`, `ExportDialog`, `ShareDialog`, `UploadChoiceDialog`) now uses a shared `Dialog` component wrapping the native `<dialog>` element, which gives real focus trapping and Escape-to-close for free rather than five different half-implementations (`ShareDialog` had its own Escape handler; the other four had none at all, which was a genuine gap against the brief's "all dialogs trap focus and close on Esc"). Also fixed: a keyboard-inaccessible click handler on the assignee cell (now a real button), an invalid `<label>` wrapping two controls in `ShareDialog`, a missing `pointercancel` handler on the timeline's pan gesture (a cancelled pointer used to leave panning stuck on), and an O(n²) `array.find` inside a loop in `validate.js` (swapped for a `Map` lookup built once).
- **The remaining 3 findings are all in `EditorPage.jsx`** and were left as-is after consideration: "large component" and "high complexity" are fair - it's the editor's central orchestration point, now a bit smaller after pulling bar-drag handling into `useBarDrag` and autosave into `useAutosave`, but still substantial. Splitting it further (the dialogs, the keyboard shortcut routing, the upload flow) is possible but risks destabilising working, manually-verified code this late in the build; left as a known follow-up rather than a rushed refactor. The third finding ("prop derived into useState", now pointing at `shareOpen`'s initial value depending on the `justCreated` prop) is a false positive here: `ProjectProvider` is keyed on the project id (see the phase 3 decision above), so `EditorContent` always mounts fresh per project and the initial value is never stale.
- **Phone layout is genuinely cramped** (checked at 375px): the task table's fixed minimum width leaves almost no room for the timeline. The brief is explicit that "editing on phones is not required, viewing is nice to have" and that the real requirement is a college laptop and tablet, both of which work well (tablet checked at 768px: toolbar wraps onto a second row, table and timeline both stay usable). Did not build a separate phone layout (e.g. a tab switcher between table and timeline) given that's outside what was asked for; worth doing in a future pass if the college wants phone support.

## Acceptance testing

- **Inline styles that remain are all computed layout values**, which cannot live in a stylesheet: the task row indent, virtualised list spacer heights, timeline and header widths and tick positions, the resizable table pane width, and the `--row-height` custom property. Everything static lives in `app.css`.
- **Export pixel ratio is adaptive.** `safePixelRatio` renders at 2x normally but drops lower for very large charts so the canvas stays under about 16,000 px a side and 100 million pixels. A 500 task chart at a fixed 2x would exceed browser canvas limits and fail or truncate. PDF "tile" mode now divides by the ratio so it really does print at roughly actual size.
- **Apache and the Authorization header.** Apache does not pass it to PHP by default, so the root `.htaccess` copies it into an environment variable and `bearerToken()` also checks `REDIRECT_HTTP_AUTHORIZATION` and `getallheaders()`.
- **The root `.htaccess` now refuses any dotfile or dot folder** (`.git`, `.config.json` and so on) with a 403.
- **`?sample=huge`** builds a 520 task chart for the 500 task performance check, alongside the existing `?sample=large`.

## Details, baseline, resources and snapping

- **The details panel is toggled, not automatic.** It takes 19rem from the timeline, so it opens from the Details button rather than whenever something is selected.
- **Text edits commit on blur or Enter** (not on every keystroke), for both the panel and the table cells, so one edit is one undo step. Invalid input is ignored and the box resets.
- **A group with children cannot change type**, since the children would lose their parent's roll-up. Empty groups and plain tasks can be converted freely.
- **Duplicate copies only dependencies that sit wholly inside the copied subtree.** Links to tasks outside it are not copied, since a copy that silently inherited outside constraints would surprise people.
- **Baseline is one snapshot, taken for every task at once** (start and duration). Variance is measured at the finish, in working days. Multiple baselines stay a phase 2 item.
- **Overlap warnings count calendar overlap of a person's own tasks**, regardless of percent complete. Shared tasks (comma separated names) count for each person. It does not try to measure load per day.
- **Patterns, not just colours.** Eight distinct SVG patterns (stripes, dots, cross-hatch and so on) at 55% white over each bar. Milestones and group brackets are already distinguished by shape.
- **Week snapping rounds to the nearest week start** (up to 3 days into a week rounds back, later rounds forward), then to a working day.
- **Still not built:** drag to reorder rows in the table (the Up and Down buttons remain), CSV import and export.

## Wheel zoom

- **A plain wheel over the timeline zooms**, as requested, rather than needing Ctrl. The cost is that the wheel no longer scrolls the rows when the pointer is over the timeline. Rows still scroll with the wheel over the task table, with the scrollbar, or with Alt + wheel over the timeline. Shift + wheel (and sideways trackpad swipes) scroll along the dates.
- **Zoom is continuous**, stored as `view.pxPerDay`, with `view.zoom` following to the nearest preset name so older code, the schema and the Zoom list stay meaningful.
- **The zoom is saved with the chart**, like the preset was, so it comes back as you left it and is picked up by exports. It also triggers an autosave after the usual delay.

## Drag to reorder

- **Dragging uses a handle, not the whole row**, so clicking, double-clicking and typing into cells keep working. It uses the browser's built-in drag and drop, which also scrolls the table when you drag near its edge.
- **Dropping on an ordinary task means before or after it.** Only groups accept "inside", because only groups can have children. Indenting under a plain task is still done with the Indent button.
- **Keyboard users keep Up, Down, Indent and Outdent** as the way to reorder; the handle is mouse only.

## CSV

- **Hierarchy is a Level column, predecessors are row numbers.** Both are easy to type or fill down in a spreadsheet, and they survive reordering rows better than internal ids. If a Row column is present predecessors point at it, otherwise at the position in the file.
- **Imports never overwrite silently**: a preview with warnings comes first, "add" and "replace" are separate choices, and both undo in one step. A new chart from the home page keeps no warnings (there is nothing to compare with), so it is best for tidy files.
- **Bad cells are warnings, bad structure is an error.** One unreadable date should not block a 200 row import, but a predecessor loop would make the schedule meaningless, so that is refused.
- **Imported start dates are snapped to working days and successors pushed**, the same as editing in the app. Existing tasks are not rescheduled by an import.
- **A CSV carries tasks and their dependencies only.** The calendar, baselines, collapsed groups and view settings are not included. Use the JSON download for a complete copy.
- **Limits** match the server's defaults: 1000 tasks, 200 character names, 2000 character notes.

## Export bundle size

- **`jsPDF`/`html-to-image` are loaded with a dynamic `import()` inside the export handler, not a static import at the top of `EditorPage.jsx`.** Most students never click Export in a given session, so shipping ~400 KB of PDF/image rendering code to everyone on first load made the editor slower to open for no benefit to most of them. The one-time cost (a network fetch the first time Export is used that session) is a better trade for a tool meant to load quickly on a college laptop.

## Exported chart colour

- **Colour is set as both a CSS class and a plain `fill`/`stroke` attribute on every SVG shape in the timeline**, rather than moving colour out of CSS entirely. A bare presentation attribute has the lowest specificity there is, so the class always wins wherever a stylesheet is actually present (the editor, the print view); the attribute only matters as the fallback for `html-to-image`'s rasterisation, which drops SVG styling but keeps attributes. Two sources of truth for the same colour is a real cost, so `TASK_COLOUR_HEX`/`CHART_COLOURS` in `constants.js` carry a comment pointing back at the `--gc-*` custom properties in `app.css` they must match.
- **This was diagnosed by inspecting `html-to-image`'s own serialised SVG output** (`toSvg()`), not by guessing from the exported image: it confirmed zero SVG descendants received an inlined style, while hundreds of ordinary HTML elements did - which is also why the task table's text and colour swatches (plain HTML, styled with `background-color`) were never affected, only the SVG timeline was.

## PDF tile page cap

- **"Tile" fit is capped at 20 pages, backing off from actual size rather than ever printing at true 96 DPI unconditionally.** A long or day-zoomed chart tiled at actual size has no natural upper bound — a real project produced 114 pages, which nobody is going to read, print or staple together. Twenty is a page count someone could plausibly flick through; beyond that the chart needs a coarser zoom or the "fit to page width" option instead.
- **The back-off shrinks the scale in fixed 15% steps rather than solving for the exact page count.** Simple, always terminates (capped at 40 attempts), and lands close enough — the exact page count is not something a teacher is choosing to the page.
- **The page-layout maths lives in its own dependency-free module (`src/lib/pdfLayout.js`)**, separate from `exportChart.js` which does the actual rasterising and PDF assembly. It exists so a future page-count estimate in the export dialog does not need to pull jsPDF or html-to-image into the main bundle just to show a number.

## Excel export

- **`exceljs` over SheetJS's `xlsx` package.** SheetJS's free Community Edition does not support cell styling (bold header, indent) when writing, which is the entire reason to offer `.xlsx` over the CSV export that already exists - a CSV cannot carry formatting at all. `exceljs` is MIT licensed, has a browser build, and bundled cleanly through Vite without needing Node polyfills.
- **Hierarchy is shown with Excel's own cell indent, not a Level column.** The CSV export carries a Level column because CSV has no concept of formatting at all; a real spreadsheet can show the same information as an actual indent, which reads better and matches what a teacher would expect to see in Excel.
- **Dates are written as UK-formatted text (`dd/mm/yyyy`), not real Excel date values.** A true Excel date is timezone- and locale-sensitive in a way this app's own date handling deliberately avoids (see `lib/dates.js`); writing a plain text string sidesteps that mismatch entirely, at the cost of the student not being able to sort the sheet by date natively.

## Date range and "my tasks" filters

- **The filter is local browser state, not part of the saved project document.** Everything else that affects what the table and timeline show (zoom, snap, columns, critical path) is saved with the chart because it is a shared view of the data. A filter is different: it is one person temporarily narrowing their own screen to find their own tasks, and saving it would mean the next person to open the link sees someone else's filter applied for no reason they can see.
- **A collapsed group still hides its children, even if one of them matches the filter.** Auto-expanding to reveal a match would make the filter sometimes override an explicit choice the student already made (collapsing that group), which is more surprising than simply saying: the filter only ever removes rows, it never adds one back that collapsing had hidden.
- **"My tasks" is a dropdown of names already typed into the chart, not a typed name remembered per device.** Matches an answer already given for this feature: it needs no onboarding step ("type your name first"), has no stale-name problem if a device is shared or reused next term, and costs nothing if nobody has been assigned anything yet (the dropdown is just empty until they are).
- **Exports and the print view always show everything, filter or not.** The filter is a "find my tasks" aid for looking at the live chart, not a way to produce a partial PDF or handout; a teacher checking a submitted export should always see the whole plan.

## Task comments

- **Comments are append-only: no edit, no delete.** With no accounts, anyone with the edit link could alter or remove what claims to be someone else's comment, which would make the log worse than useless for the thing it is for - a lightweight, honest record of who said what on a group project. Notes already covers "a place to jot down and freely rewrite something about this task."
- **A real schema version bump (1 to 2), not an optional bolt-on field treated loosely.** The field needed a proper migration and server-side validation (author and text length limits) rather than just hoping every code path remembers to default it to an array, which is exactly the kind of thing that quietly breaks an old save file months later.
- **The author's name is typed fresh with each comment, not remembered per device or per project.** Matches the answer already given for the "my tasks" filter's different approach (a dropdown, not a remembered name): a shared school device or a chart passed between group members would otherwise attribute comments to whoever used the browser last, which is worse than asking each time.

## Microsoft Project XML

- **Not verified against real Microsoft Project.** This environment has no copy of it to test with, so correctness rests on the published MSPDI schema, written documentation of it, and an export-then-import round trip through this app's own reader - which proves the two are *consistent with each other*, not that Project agrees with either. Two specific numbers carry the most risk if that documentation is wrong: `LinkLag` (written as tenths of a day, e.g. a 2 day lag is `20`) and the working day length assumed throughout (8 hours, Project's own default). If a file exported from here opens in Project with lag or duration that looks scaled wrong, those are the two places to check first.
- **No Calendars block, Resources or Assignments in the export.** Project falls back to its own default Monday-to-Friday calendar for a file that omits one, which already matches this app's own default calendar; a chart using a custom calendar (extra holidays, a different working week) will still show the right dates on every task, since those are written explicitly per task, but re-scheduling after an edit inside Project itself would then follow Project's calendar, not this app's. Resources are skipped outright because this app has no resource pool to export, only a free-text assignee per task.
- **A task with children becomes a group on import, the same rule the CSV importer uses** - MSPDI's own `Summary` flag is read for nothing; whether a task has anything indented beneath it is what decides it, which is more robust against a file that leaves `Summary` blank or wrong than trusting the flag would be.
- **`CsvImportDialog` was generalised rather than duplicated for a second file format.** Everything about it - the file name, the found/warnings summary, the append-or-replace choice - was already format-agnostic once the two headings ("Import from CSV") were parameterised; a near-identical copy for MSPDI would have meant fixing the same bug twice the next time one turned up.
