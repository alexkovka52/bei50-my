# Layer 2 — common rules for every screen task (read before your task brief)

1. Read in full: `docs/superpowers/specs/2026-09-29-dementra-frontend.md`, your task's canvas board(s) in
   `design/canvas/`, and the existing app: `web/src/app/layout.tsx`, `web/src/app/globals.css`,
   `web/src/components/shell/*`, `web/src/components/ui/*`, `web/src/components/BrandMark.tsx`,
   `web/src/lib/data/*` (types, server loaders, format helpers), `web/src/lib/map/*` and
   `web/src/components/map/MapView.tsx` (the shared map core: base style with terrain, data layers,
   `setDataLayerVisible`, `setSelectedBlock`, `setMode`).
2. Data is real and already present in `web/public/data/` (30 blocks, 13,308 plants, 1,091 gaps, 83 waste,
   routes). Pages are server components that load with `web/src/lib/data/server.ts`; interactive parts are
   client components. Anything using MapLibre must be client-only and loaded with `next/dynamic` +
   `ssr: false`. Never invent numbers: show "Not measured"/"Pending" for nulls. Note `summary.walks.*.stops`
   is 0 in the current data: show stops only when > 0.
3. File ownership (to avoid merge conflicts between parallel tasks): only create/modify the files your brief
   lists. Do NOT edit `web/src/lib/map/*`, `web/src/components/map/MapView.tsx`, `web/src/components/ui/*`,
   `web/src/components/shell/*`, `globals.css`, `layout.tsx`, `package.json` unless your brief says so. Put
   new shared-looking pieces in your own folder. If you truly need a change in a shared file, describe it in
   your final report instead of making it.
4. Local dev with real imagery (in your worktree, `web/`):
   ```bash
   npm ci
   printf 'TILES_DEV_ORIGIN=http://127.0.0.1:8787\n' > .env.development.local
   (cd /Users/cristian/Development/gigahack2026/bei50 && python3 -m http.server 8787 --bind 127.0.0.1 --directory dist/tiles >/dev/null 2>&1 &)   # ok if already running
   PORT=<your port> npx next dev --turbopack --hostname 127.0.0.1 --port <your port>
   ```
   Use your own port (E 43181, F 43182, G 43183, H 43184). Look at your work: take screenshots with
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader
   --enable-unsafe-swiftshader --hide-scrollbars --virtual-time-budget=30000 --window-size=1440,900
   --screenshot=/tmp/<task>-<name>.png http://127.0.0.1:<port>/<route>` (also 1024×768 and 390×844), open the
   PNGs and compare them with the canvas board. Iterate until it matches. Kill your dev server when done.
5. Quality floor: keyboard reachable controls with visible focus, labels on icon buttons, 44px targets,
   contrast per tokens, `prefers-reduced-motion` respected, no layout shift from late data, responsive
   down to 390px. Design rules from the spec (no all-caps eyebrows, no middle-dot meta strings, no mono).
6. `npm run lint`, `npm test`, `npm run build` must pass. Add `node:test` unit tests (`*.test.mts`) for any
   non-trivial pure logic you write (sorting, filtering, formatting, geometry).
7. Commit on your branch (messages end with `Co-Authored-By: Grok 4.7 <noreply@x.ai>`). No push, deploy, ssh.
   Final report: files, screenshots you checked (paths) and how they compare to the board, commands and
   results, and any shared-file changes you need.
