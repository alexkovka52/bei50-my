---
name: siret3-premium-ui
description: Use when changing Sireț3 / Demetra map chrome, panels, sheets, motion, or visual polish on web/. Triggered by UI, UX, mobile layout, premium, glass, or jury-facing viewer work.
---

# Sireț3 premium map UI

The map is the product. Chrome is Linear-quiet: hairline, no glow, one typeface. One accent, used sparingly.

**REQUIRED:** Search Mobbin (`search_screens` / `search_flows`) before inventing a new chrome pattern. Cite `mobbin_url` in the change notes.

**REQUIRED BACKGROUND:** ui-skills (h-dvh, safe-area, tabular-nums, compositor-only motion).

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#0b0c0b` | Page + map void |
| Hairline | `rgb(255 255 255 / 0.08)` | Dividers, icon rings |
| Type | `#e6e6e2` / `#6d726d` | Primary / muted |
| Leaf | `#2f7a38` | Checked only, never a fill pill |
| Radius | 16px window / 6–8px control | |
| Motion | 180ms `ease-out`, `opacity` + `transform` only | |

No purple. No full-screen gradients. Do not animate `backdrop-filter`. Respect `prefers-reduced-motion`.

## Layout

**Desktop (≥701px)** — framed Sireț3 slide + dark footer:

- No world OSM. Camera `maxBounds` = 311-tile study area. Idle camera is **top-down** so the vineyard fills the window. Pitch only during walk.
- The map lives in one Mintlify-style window: title bar + ortho + metric caption. Plan / inspect open inside that same window.
- Survey numbers are label-over-value. Click a feature → inspect pane. Plan → same window.

**Phone (≤700px)** — Journal / Polarsteps / Flighty:

- Map + compact top pill + zoom cluster.
- One bottom sheet (`max-height: 55dvh`) + 4-tab dock (Layers, Summary, Route, Start).
- Hide identity, legend, Plan Route, scale.
- Safe-area on dock and sheets.

## Motion

Use `motion/react`. Animate only `opacity` and `transform`. 180ms ease-out.

| Event | Motion |
| --- | --- |
| Sheet / planner open | `y: 16 → 0`, fade in |
| Backdrop | fade 0 → 1 |
| Dock active | leaf tint, no layout jump |
| Icon press | `scale: 0.96` |

Loading = small glass pill, never a black full-screen wash.

## Copy and type

- Brand: **Sireț3**. Product: Demetra. Badge: MARCAJ or SAMPLE.
- Data: `tabular-nums`. Headings: `text-wrap: balance`. Notes: `pretty`.
- Icons: forest/leaf on cream. Never `fill="white"` on glass.

## Do not

- Cover the map with two side columns on a phone.
- Split metric digits (`36,9` / `7.99`). Full-width sheet or ≥ 280px card.
- Add a second accent color for chrome.
- Merge the orphan `frontend` branch.
- Draw Sireț3 labels outside Marcaj.

## Verify

Phone 390×844 and desktop 1280×800. Dock, one sheet, readable metrics, map still visible. Then redeploy `dementra.md`.

Patterns and Mobbin links: [references.md](references.md)
