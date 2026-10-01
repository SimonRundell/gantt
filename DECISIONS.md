# Decisions

A running log of choices made while building the Gantt chart planner, kept so later phases (and the owner) know why something is the way it is. Newest at the bottom.

## Phase 0

- **API base URL default.** The brief's own example (`http://localhost/gantt-chart/api`) assumes the app lives in a subfolder of a shared Laragon docroot. The owner's general working convention (in their global Claude instructions) is to repoint Laragon's Apache docroot directly at each project's root, which makes the API reachable at `http://localhost/api`. Went with the latter as the default in `.config.example.json`, since it matches how the owner runs every other project. The owner is repointing Apache themselves; if they use a different arrangement (a dedicated vhost, a subfolder, etc.) they just need to edit `apiBase` in `.config.json` to match, no code changes needed.
- **Config loading.** `.config.json` sits at the project root (not in `public/`), so the frontend reads it with a plain ES module import (`src/services/config.js`) rather than a runtime fetch. That means a change to `.config.json` needs a dev server restart (or rebuild) to take effect, which is an acceptable trade-off for a setting that rarely changes.
- **Lint tool.** The current `npm create vite@latest` React template ships with Oxlint rather than ESLint. The brief doesn't mandate ESLint specifically, so kept Oxlint as the default rather than swapping it out.
- **react-doctor.** Installed per the brief; added a `doctor` script to `package.json`. Findings will be reviewed in the polish phase (phase 9) rather than chased individually as they appear, so the codebase has something worth linting by then.
- **Existing dev server on port 5173.** Something (the IDE's own preview panel) was already serving the app on port 5173 before any `npm run dev` was run deliberately. Per the brief, left it alone rather than starting a second one.
