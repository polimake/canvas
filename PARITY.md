# canvas2 ↔ polimake-canvas parity

Audit date: 2026-07-28. canvas2 is the editor going forward; polimake-canvas
(the DOM Canva clone) is frozen for legacy designs. This file maps every
clone feature to its canvas2 status and carries the porting roadmap.

## Ground rule: decoupled from Excalidraw (enforced)

Everything in this package is an **overlay on stock `@excalidraw/excalidraw`**,
and the boundary is structural, not just convention:

- **`src/excal.ts` is the ONLY module that imports `@excalidraw/*`.** It
  re-exports the component, the helpers (`exportToBlob/Canvas/Svg`,
  `convertToExcalidrawElements`, `serializeAsJSON`, `CaptureUpdateAction`), the
  public types, and the canonical derived aliases (`SceneElement`,
  `SceneElements`, `FrameElement`). Every other file imports from `./excal`.
- **The rule is test-enforced**: `__tests__/decoupling.test.ts` scans `src/`
  and fails if any other file mentions `@excalidraw/` — a bypass can't land.
- Only the public surface is used: component props, the imperative API
  (`getSceneElements` / `updateScene` / `onChange` / `scrollToContent` /
  `addFiles`), public helpers, the public types entry. No forked internals, no
  patches, no reaching into Excalidraw's DOM.
- Pages are plain native **frames**; our metadata rides on the public
  `customData` field (e.g. the page-background marker).
- The adapter is also what makes the package testable in node (the real
  Excalidraw touches `window` at import time): tests mock `./excal` and drive
  the overlay logic against a fake imperative API.
- **Upgrade procedure**: bump the dependency → fix `src/excal.ts` until
  `pnpm --filter @studio/canvas2 typecheck` is green → `pnpm --filter
  @studio/canvas2 test` (28 unit tests) → re-run the Playwright smoke flow.
  Behavioral drift in the public API surfaces in the adapter or the tests, not
  scattered across the package.

## Status legend

✔ native — Excalidraw does it out of the box · ✔ ported — built here as an
overlay · ◐ partial · ✗ roadmap — not built yet

| Clone feature | canvas2 status | Where / notes |
| --- | --- | --- |
| Pages (add/duplicate/delete/rename) | ✔ ported | `pages.ts`, frames laid left→right, `PageNavigator` strip |
| Page reorder | ✔ ported | `movePage` ◀ ▶ on the active chip (clone: movePageUp/Down) |
| Render box / clipped artboard | ✔ ported | native frame clipping; export uses `exportingFrame` so ONLY frame content ships |
| Page size + custom resize | ✔ ported, **better than clone** | per-PAGE size (clone is global-only); presets (Post 4:5, 1:1, Story 9:16, 16:9, miniatura YT, A4) + custom W×H + "escalar contenido" reflow (`resizePage`) |
| Export PNG (page / all pages) | ✔ ported | `export.ts` + Exportar menu; exact design pixels by default (1080×1920 story → 1080×1920 file) |
| Export PDF (all pages) | ✔ ported | jsPDF, one artboard per PDF page |
| Export SVG | ✔ ported (clone lacks it) | vector out of the same frame clip |
| Thumbnails (≤512px capture) | ✔ ported | `captureThumbnail` — host wiring to designs/R2 pending (see roadmap) |
| Text layers + inline editing | ✔ native | double-click, wysiwyg, fonts, align |
| Text presets (Título/Subtítulo/Cuerpo) | ✔ ported | `text.ts` + `+T` menu |
| Page background color | ✔ ported | `background.ts`: locked full-bleed rect tagged `customData.c2='pageBackground'`, replace-not-stack |
| Background image (cover + lock) | ✔ ported (earlier) | `imageOps.ts` `setAsBackground` / `extendToPage` |
| Shapes (rect/ellipse/diamond/line/arrow/draw) | ✔ native | Excalidraw toolbar |
| 51 clip-path shapes + 24 frames + components library | ✗ roadmap | could ship as an Excalidraw **library** (`.excalidrawlib`) — zero code, pure data |
| Image layers, crop, replace | ✔ native | 0.18 has built-in image cropping |
| Media browser (MediaMonster) | ◐ seam ready | `media.ts` `insertImageFromUrl/Blob` built; mounting the MM browser needs a project-scoped host (next phase) |
| Video layers | ✗ roadmap | Excalidraw has no video element; needs a custom overlay or acceptance as image+poster |
| Selection / multi-select / marquee | ✔ native | |
| Group / ungroup | ✔ native | |
| Z-order | ✔ native + ported | native context menu; per-page reorder in `LayersPanel` via `zorder.ts` |
| Align / distribute (between elements) | ✔ native | context menu |
| Align to PAGE (single selection) | ✔ ported | `align.ts` `alignToPage` + 6 buttons in the LayersPanel header (native align needs 2+ elements) |
| Lock page (frame + all members) | ✔ ported | `setPageLocked` + 🔒 toggle on the active chip; locked pages hide the delete action |
| Snap + alignment guides | ✔ ported default | native object snapping, now ON by default (`objectsSnapModeEnabled`) |
| Lock / hide layers | ✔ ported | `LayersPanel` (hide = opacity 0 emulation) |
| Layers panel | ✔ ported | right-docked, drag reorder, per-page |
| Undo/redo history | ✔ native | includes our ops via `CaptureUpdateAction.IMMEDIATELY` |
| Keyboard shortcuts | ✔ native | |
| Copy/paste/duplicate | ✔ native | |
| Color picker + eyedropper | ✔ native | |
| Gradients (root/shape) | ✗ roadmap | Excalidraw has no gradients; low priority |
| Text effects (shadow/neon/outline…) | ✗ roadmap | not native; would be CSS-free SVG filters — defer |
| Fonts system (73 Google families, brand fonts) | ◐ | Excalidraw ships 5 families; custom-font support is limited — evaluate on demand |
| Zoom / fit / pinch | ✔ native | plus `goToPage` fit-to-frame |
| JSON persistence | ✔ ported | `serialize.ts` = Excalidraw canonical JSON (lossless round-trip) |
| Save to `designs` table + content `designId` | ✗ **next phase** | store scene JSON in `editorConfig` with `format:'excalidraw'` marker; server CRUD unchanged |
| Autosave draft + unsaved guard | ✗ next phase | host-side, port pattern from `useContentCanvasEditor` |
| blob-URL guard | n/a | Excalidraw inlines image bytes as dataURLs in `files` — the blob-URL failure mode doesn't exist |
| Review comments overlay | ✗ roadmap | portal-style overlay like the clone's `data-polimake-*` slots, once canvas2 mounts in the content page |
| Read-only / comment mode | ✔ native | `viewMode` prop already wired |
| Templates + AI slot-fill | ✗ roadmap | frames with named elements as slots; pairs with the studio-mcp design tools |

## Visual pass (same day, later still)

- All chrome glyphs/emojis replaced with an inline SVG icon set (`icons.tsx`,
  no icon-library dependency, currentColor strokes).
- Pages sit **flush against each other** (`PAGE_GAP = 0`), Canva-style.
- Pages are **straight-edged**: Excalidraw draws frame outlines with rounded
  corners and no public radius knob, so the native outline is disabled
  (`frameRendering.outline: false`) and every page carries a locked,
  sharp-cornered white "paper" rect (roughness 0, hairline border) as its
  visual. The paper auto-creates on new pages, stretches exactly on resize,
  is hidden from the layers list, and `ensurePagePapers` migrates legacy
  scenes (which also get re-packed flush on load).

## Hardening pass (same day, later)

- `src/excal.ts` adapter created; all 12 modules rewired through it (duplicated
  `SceneElement`/`SceneElements`/`FrameElement` aliases deduped into the
  adapter). Import specifiers are extensionless (`./excal`) — Turbopack
  consumes this package as raw TS source and does not resolve `.js`-suffixed
  specifiers to `.ts` files.
- Vitest suite added (28 tests): the decoupling guard plus behavior specs for
  `resizePage` math (center remap + uniform k + fontSize), `relayoutPages`
  packing/no-op, `movePage`, `duplicatePage` id remapping, `setPageLocked`,
  page-background replace-not-stack, `alignToPage` (all six alignments, locked
  and cross-page exclusion), and z-order reordering.
- New parity ports: `alignToPage` (+ LayersPanel buttons) and page lock
  (+ chip toggle).

## What was added on 2026-07-28

`resizePage` + `relayoutPages` + `movePage` + `getPageSize` + size presets
(`PAGE_SIZE_PRESETS`), export menu UI (PNG page/all, SVG, PDF) + `downloadBlob`,
text presets (`insertTextPreset`), page background color
(`setPageBackgroundColor`/`getPageBackground`), snapping on by default, and the
hydration-race fix (first page ships inside `initialData`; legacy frameless
scenes get a page after hydration settles).

Runtime-verified with Playwright against `/canvas` (dev): fresh boot shows
Página 1 at 1640×924 · add → Página 2 · Story preset → strip reads 1080×1920 ·
insert Título + blue background · export PNG → file is exactly 1080×1920 named
after the page · move-left + reload → order and sizes persist.

## Suggested port order (next)

1. **Persistence to `designs`** + content `designId` + thumbnails via
   `captureThumbnail` → the design-thumbnail upload endpoint (makes canvas2 the
   real editor).
2. **MediaMonster browser** in a project-scoped host, feeding
   `insertImageFromUrl`.
3. **Shape/frame/component libraries** as `.excalidrawlib` data.
4. **Templates with named slots** + studio-mcp tools
   (`list_design_templates`, `create_design_from_template`).
5. Review-comments overlay when canvas2 replaces the Lienzo tab.
6. Video layers (or a deliberate "poster-only on canvas" decision).
