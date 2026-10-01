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
