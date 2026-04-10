# GrantMatch AI — Jazmine's Journey

## Project Overview
A single-page frontend web application that serves as a grant-writing assistant for the nonprofit organization "Jazmine's Journey." It helps users find matched funding opportunities, provides application templates (shells), offers a submission checklist, and includes a simulated AI chat assistant for grant-writing strategy.

## Architecture
- **Type:** Static frontend-only application (no backend, no build system)
- **Entry point:** `index.html`
- **Dependencies:** Loaded via CDN (no package.json)
  - React 18 (via unpkg)
  - Babel Standalone (for in-browser JSX transpilation)
  - Tailwind CSS (via CDN)
  - Google Fonts (Inter)

## Running the App
The app is served with Python's built-in HTTP server:
```
python3 -m http.server 5000
```
Workflow: "Start application" on port 5000

## Deployment
Configured as a **static** deployment with `publicDir: "."`.

## Key Features
- Grant matching with fit scores
- Application narrative shell templates
- Submission checklist
- Simulated AI chat assistant (keyword-based)
- All data is hardcoded mock data in `index.html`
