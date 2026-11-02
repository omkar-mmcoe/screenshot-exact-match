# Cadence v3 — Port + Complete UI/UX Refinement

## Goal
Port the uploaded Cadence v3 frontend (single-file `App.tsx`, 3,039 lines, plus `lib.ts` API client) into this project as-is, then apply the "COMPLETE UI/UX REFINEMENT" brief: a premium ivory-and-indigo institutional SaaS design across every view, with the timetable as the strongest component.

Decisions (confirmed): run your existing FastAPI backend locally on `127.0.0.1:8000`; keep the API layer and all business logic untouched; faithful port (internal tab state preserved, no route restructuring).

## 1. Port
- Copy uploads into the project:
  - `src/App.tsx` (from `import_React_..._pasted.txt`) — unchanged logic, including the toast system, race-condition guards, workload math, all CRUD handlers, `ConventionalTimetableGrid` and `FacultyScheduleGrid` with their existing `rowSpan={2}` practical/continuation plan-building.
  - `src/lib.ts` (from `class_ApiError_pasted.txt`) — typed API client, `ApiError`, all fetchers, `API_BASE_URL` from `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`).
- Mount `App` on the `/` route (`src/routes/index.tsx`). App renders client-side (it contains random seed state that would SSR-hydration-mismatch), with a brief branded loading state during hydration.
- Install `lucide-react` (the only missing dependency).
- Root head: Inter via `<link>` tags, unique app title/description/og metadata; remove the template placeholder.
- Read the previously truncated section (faculty/class views, lines ~1430–1600) from the upload before editing those views.

## 2. Design system — one stylesheet (`src/styles.css`)
- Keep `@import "tailwindcss"` + `@theme` structure. Add the Cadence palette as semantic tokens: ivory surfaces (`--ivory-*`), charcoal text (`--stone-*`), indigo accent family, emerald for practicals/success, red for conflicts, amber for reservations — light theme only, per brief.
- Map them through `@theme inline` so utilities (`bg-surface`, `text-ink`, `border-line`, etc.) work; components stop using hardcoded hex classes (`#e5e5df`, `#fafaf7`, …) — presentation classes only, never logic.
- Organized sections: tokens, base/typography, shell (sidebar/header), page layouts, cards, forms/buttons (consistent 32px control heights), timetable, session cards (theory = light indigo, practical = light green, conflict = restrained red), badges, dialogs/toasts, skeletons, scrollbars, responsive, a11y focus-visible, reduced-motion, print.
- Replace the template's default indigo-on-white token values with the ivory identity; dark mode stays available but the app is authored light-first.

## 3. Shell and views (presentation only)
- **Sidebar**: refined brand block, compact academic context selectors (institution → department → semester), active nav with subtle indicator, backend connectivity footer with retry; responsive collapse to an overlay on small screens.
- **Header**: page title + active scope, publication status badge, primary Generate action with live elapsed timer, print button; consistent heights.
- **Overview**: metric cards with strong numeric hierarchy; precheck/validation panel with distinct success/warning/failure states.
- **Generation Studio**: grouped solver controls (CP-SAT / CSP toggle, time limit, seed), primary solve action, precheck diagnostics, results grid, publication controls that clearly show gated state.
- **Master Timetable**: professional toolbar (search, division filter, theory/practical kind toggle, CSV exports), per-division sections with legends.
- **Faculty View** and **Class View**: workload summary (theory vs practical hours), clean selectors, consistent session cards.
- **Settings**: tab navigation without emoji (Lucide icons), consistent form labels/inputs, empty states, CRUD tables and confirmation flows unchanged functionally.
- **Dialogs/toasts**: modern compact modal (session inspection) and toast styling with subtle transitions.

## 4. Timetable (behaviour frozen, visuals upgraded)
- Rows = periods, columns = days; theory = one row; practicals render once at their starting period with `rowSpan={2}`, continuation cells suppressed, all parallel batches inside the same spanning block. Never restructured into slot rows.
- Sticky weekday header, refined period/time labels, subtle grid borders, comfortable row heights, clear free-vs-occupied distinction, horizontal scroll with minimum column widths on small screens, break separator rows styled as calm dividers.

## 5. Print + a11y
- `@media print`: hide sidebar/header/toolbar/dialogs, keep labels and `rowSpan` blocks, readable borders, avoid card page-breaks, fit to page.
- Focus-visible rings, semantic headings/table markup, contrast-checked colors, status conveyed by text not color alone, `prefers-reduced-motion` respected.

## Verification
- Build + TypeScript strict + ESLint clean.
- Playwright against the preview: all six views render, shell and filters work, timetable rowSpan structure present when data exists.
- With your FastAPI offline, views will show the offline/empty states — full data flows (generate, publish, CSV) need your backend running locally; you may need to allow the preview origin in FastAPI CORS for the browser to reach `127.0.0.1:8000`. I will report exactly what I could and could not exercise.
