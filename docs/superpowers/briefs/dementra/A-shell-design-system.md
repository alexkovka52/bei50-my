# Task A — Dementra app shell + design system (Layer 1)

You are implementing part of the Dementra frontend rebuild. Read first, in full:
1. `docs/superpowers/specs/2026-09-29-dementra-frontend.md` (the contract; it wins over anything else).
2. `design/canvas/Main.dc.html`, `design/canvas/Overview.dc.html` (approved design; copy its tokens, spacing,
   rail and top bar exactly).
3. The current `web/` app (`package.json`, `next.config.ts`, `src/app/*`, `src/lib/*`).

Work only inside `web/`, except you may read anything. Do NOT touch `web/scripts/`, `web/public/data/`,
`processing/`, `models/`.

## Deliver

1. Rebrand: package name `dementra-web`; `layout.tsx` metadata: title `Dementra` for `/` and the template
   `"%s | Dementra"` elsewhere; description "Aerial vineyard intelligence: every row, every gap, every walk.". Remove all
   TRASHOPOLY/Trashopoly strings and `public/brand/trashopoly-*`, the intro logo animation, and the old
   `components/vineyard-map.tsx`, `route-playback.tsx`, `workspace-chrome.tsx`, `Brand.tsx`, `components/ui/*`
   (unused), `lib/walk.ts`, and `public/{file,globe,next,vercel,window}.svg`. Keep `lib/geo.ts`,
   `lib/route-path.ts`, `lib/layer-visibility.ts`, `lib/motion.ts`, `lib/base-path.ts`, `lib/utils.ts`,
   `lib/parse-start.test.mts` and `public/maplibre-gl-*.mjs`. Do not delete `public/layers/` yet.
2. Brand assets: copy `design/logo/final/*.svg` to `web/public/brand/`, and the web icons from
   `design/logo/final/web-icons/` into `web/src/app/` (App Router icon conventions: `favicon.ico`, `icon.svg`
   from favicon.svg, `apple-icon.png`) plus `web/public/site.webmanifest` (name/short_name "Dementra",
   theme `#0F2A1D`, background `#E3EED4`). Delete the old `src/app/icon.svg` and the Manrope fonts if unused.
3. Tokens: rewrite `src/app/globals.css` with Tailwind v4 `@theme` tokens from the spec (colours, radii,
   font families as CSS vars from next/font), base styles (body dew/forest, focus-visible ring 2px moss with
   2px offset, `prefers-reduced-motion` guard). Fonts: `next/font/google` Bricolage Grotesque (variable,
   axes opsz) + Onest, subsets latin + latin-ext.
4. Components in `src/components/`:
   - `shell/AppShell.tsx` (rail + main slot), `shell/Rail.tsx` (items per spec, active via `usePathname`,
     real `<a>`/`Link`, `aria-current`), `shell/TopBar.tsx` (title, farm pill, flown date, search input with
     label, bell button with aria-label, avatar initials "CP").
   - `ui/`: `Button` (variants primary moss / outline / lime / glass; sizes; min-height 44), `Pill`, `Card`
     (paper, r28), `GlassPanel` (dark glass), `Toggle` (switch, role="switch", lime on), `Segmented`
     (radiogroup), `Stat` (label, big Bricolage value with unit, note), `LegendSwatch`, `StackBar`
     (horizontal segmented bar with accessible text alternative), `Badge`.
   - `BrandMark.tsx` (inline SVG of the mark; props `variant: "light"|"dark"|"small"`, size).
5. Routes (App Router, server components) using `AppShell` + `TopBar`: `/`, `/walks`, `/blocks`,
   `/blocks/[id]`, `/reports`, `/ai` each with the page title and an empty-state body ("Loads in Layer 2"
   is NOT acceptable copy — render a real empty state: heading + one sentence, e.g. "No survey data yet. Run
   `siret3 web-bundle` to publish a flight."). `/map` is full-bleed forest (`#0F2A1D`) without the rail,
   with a back link to `/` and the same empty state in light text. Add `not-found.tsx` and `loading.tsx`.
6. Data client `src/lib/data/`:
   - `types.ts`: TypeScript types for every file in the spec's data contract.
   - `server.ts` (server-only): `getSummary()`, `getBlocks()`, `getBlock(id)`, `getRows()`, `getTasks()`,
     `getModel()` reading `public/data/*.json` with `fs/promises` (path from `process.cwd()`), returning
     `null` when the file is missing, validating `version === 1`.
   - `client.ts`: `layerUrl(name)`, `routeUrl(role)`, `dataUrl(file)` built with `asset()`.
   - `format.ts`: `formatInt(n)` → "13,308", `formatKm(m)` → "39.1 km", `formatHa`, `formatPct`,
     `formatDuration(meters, kmh=4)` → "2 h" / "1 h 19 min", with unit tests in
     `src/lib/data/format.test.mts` run by `npm test` (extend the test script to run all `*.test.mts`).
7. `npm run lint`, `npm test`, `npm run build` all pass. Fix any lint in files you keep.

## Rules
- Follow the spec's design rules (no all-caps eyebrows, no middle dots, no mono, real buttons/links,
  contrast, 44px targets). Match the canvas visually.
- Commit on your current branch with clear messages (end each with
  `Co-Authored-By: Grok 4.7 <noreply@x.ai>`). Do not push, deploy or ssh.
- Finish with a short report: files added/removed, commands run and their results, anything left open.
