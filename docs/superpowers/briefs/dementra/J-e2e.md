# Task J — Playwright smoke + accessibility tests (Layer 3)

Read `docs/superpowers/briefs/dementra/L2-common.md` and the spec. You own `web/package.json` +
`web/package-lock.json` (dev deps only), `web/playwright.config.ts`, `web/e2e/**`, and a new npm script. Do not
edit app source; if a test finds a real bug, keep the test, mark it `test.fixme` with a one-line reason, and list
the bug in your report (another task fixes app code).

## Do
1. Add dev deps `@playwright/test` and `@axe-core/playwright`; `npx playwright install chromium`.
2. `playwright.config.ts`: build + `next start` on port 43190 as `webServer` (`npm run build && npx next start
   -p 43190 -H 127.0.0.1`, reuse existing server locally), projects desktop (1440×900) and mobile (Pixel 7
   emulation / 390×844). Chromium launch args `--use-angle=swiftshader --enable-unsafe-swiftshader` so MapLibre
   gets WebGL. Tiles: set `TILES_DEV_ORIGIN` is dev-only, so for tests route `**/tiles/ortho/**` to the local
   files in `/Users/cristian/Development/gigahack2026/bei50/dist/tiles/ortho` with `page.route` when that
   folder exists, else let them 404 (the map must still work).
3. Tests (`e2e/*.spec.ts`), each asserting real data from `web/public/data`:
   - every route returns 200, has one h1, no console errors (ignore tile 404s), and passes axe with no
     serious/critical violations;
   - `/`: status sentence contains the gap/waste/block counts from summary.json; weather card shows either a
     temperature or the unavailable message (mock the Open-Meteo request with `page.route`);
   - `/map`: a MapLibre canvas renders; the layers panel toggles "Gaps" off and on; the search box "V02" flies
     and opens the inspector with "Block V02"; 2D/3D toggle works; `?block=V02` deep link opens the inspector;
   - `/walks`: Farmer tab switches distance to 4.29 km; ticking "Done" on the first task persists after reload;
     GPX download produces a file containing `<gpx`; play/pause changes the progress text;
   - `/blocks`: 30 rows; sorting by Plants puts the max plants first; selecting V03 updates `?selected=V03`;
     `/blocks/V03` shows "Block V03"; `/blocks/NOPE` is 404;
   - `/reports`: every download link returns 200; `/ai`: shows the metrics labels from model.json.
4. npm script `"e2e": "playwright test"`. Run it; everything passes or is `fixme` with a reason.
5. Commit (`Co-Authored-By: Grok 4.7 <noreply@x.ai>`). Report: test list, results, bugs found.
