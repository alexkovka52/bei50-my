# Task I — cross-app polish, accessibility, performance, responsive (Layer 3)

Read `docs/superpowers/briefs/dementra/L2-common.md` (dev setup, screenshot commands, rules) and the spec.
All screens are merged: `/`, `/map`, `/walks`, `/blocks`, `/blocks/[id]`, `/reports`, `/ai`. You own every file
under `web/src` and `web/README.md` for this task. Do NOT edit `web/package.json`/lockfile (task J owns them),
`web/public/data/**`, `processing/**`, deploy scripts.

## Do
1. Screenshot every route at 1440×900, 1024×768 and 390×844 (use Chrome's device-metrics override for 390 as
   the walks task did; headless windows can't go below 500px). Compare with `design/canvas/*.dc.html`; fix
   visual bugs, overflow, clipped text, overlapping controls, inconsistent spacing between pages.
2. Map attribution: in `web/src/components/map/MapView.tsx` start the compact attribution collapsed (it opens
   over panels today, e.g. the block mini-map) and keep it readable on dark and light cards.
3. States: every route has `loading.tsx` skeletons matching its layout (no layout shift), an `error.tsx`
   boundary with a clear message and a retry button, and empty states when `web/public/data` is missing.
4. Accessibility: one `h1` per page, landmark roles (nav, main), skip link to main content, visible focus
   everywhere (including map panels), `aria-live` for toasts and playback progress text, labels on all
   inputs/icon buttons, colour contrast ≥4.5:1 for text (fix any token misuse), reduced motion honoured
   (no fly-to animations, no auto-play), keyboard operation of tabs/segmented controls (arrow keys).
5. Performance: MapLibre only loaded on routes that need it (dynamic import, `ssr:false`); `plants.geojson`
   (4.3 MB) should not block first paint — only add the plants source when zoom ≥ 16 or use
   `web/public/data/layers.pmtiles` if you can do it without new deps (you can't add deps; skip PMTiles if it
   needs one). Check `npm run build` First Load JS per route and remove accidental client bundles.
6. Metadata: per-route `title`/`description`, Open Graph image (`opengraph-image.png` from the brand mark on
   forest, 1200×630, static file), `robots` allow, `theme-color` forest.
7. `web/README.md`: rewrite for Dementra (what it is, dev setup incl. tile proxy, data bundle command, deploy
   scripts), replacing the old viewer README.
8. `npm run lint`, `npm test`, `npm run build` pass. Commit (`Co-Authored-By: Grok 4.7 <noreply@x.ai>`).
   Report every fix with before/after screenshot paths.
