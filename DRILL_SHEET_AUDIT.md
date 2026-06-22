# Drill Sheet PDF — Codebase Audit

Read-only audit. No files were modified to produce this report.

**Correction to assumed architecture:** this is **not an Electron app**. It is a
**Next.js 16 (App Router) web app** running server actions on Node, talking to
PostgreSQL via Prisma. There is no `BrowserWindow`/`webContents.printToPDF` — PDF
rendering is done by launching a real **Puppeteer-controlled Chromium/Brave**
browser from a Next.js server action and calling `page.pdf()`. (Verified: no
`electron`, `BrowserWindow`, or `webContents` references anywhere in the repo
outside of `node_modules` transitive listings in `package-lock.json`.)

---

## 1. PDF Generation Pipeline

**Library:** [Puppeteer](https://pptr.dev/) drives a real Chromium/Brave install
and calls `page.pdf()` on a rendered HTML document. `pdf-lib` is also a
dependency but is **not** used for drill sheets — it's used for a different
feature (`lib/submittal-package.ts`, stitching/merging existing PDFs for
submittal packages).

**package.json dependencies (relevant excerpt):**

```json
"dependencies": {
  "@prisma/adapter-pg": "^7.8.0",
  "@prisma/client": "^7.8.0",
  "next": "16.2.9",
  "pdf-lib": "^1.17.1",
  "pg": "^8.21.0",
  "prisma": "^7.8.0",
  "puppeteer": "^25.1.0",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "xlsx": "^0.18.5"
}
```

`postinstall` script: `prisma generate && puppeteer browsers install chrome` —
Puppeteer's bundled Chrome is installed at `npm install` time as a fallback.

**Where PDF generation happens:**

- `lib/quote-pdf.ts` — the actual Puppeteer launch + `page.pdf()` call. Despite
  the filename, this is the **shared PDF renderer** used by both quotes and
  drill sheets (and likely other features) — it just takes an HTML string and
  an output path.
- `app/drill-sheets/pdf-actions.ts` — the server action (`"use server"`) that
  drill sheet UI buttons call. It fetches data, builds HTML, then calls
  `writeQuotePdfFromHtml` from `lib/quote-pdf.ts`.

This all executes in the **Next.js server action runtime** (Node.js process
behind the dev/prod server), not in a browser tab and not in an Electron main
process.

**Drawing method:** **HTML + inline SVG**, rendered to PDF via Chromium's print
engine. There is no raw PDF coordinate drawing (no `pdf-lib` page operators for
this feature) and no `<canvas>`. The plan-view circles and the side elevation
cross-section are both built as **SVG markup strings**, concatenated into an
HTML document, then Puppeteer prints that HTML to a Letter-size PDF with
`@page` CSS.

Representative snippet (`lib/quote-pdf.ts:55-80`):

```ts
export async function writeQuotePdfFromHtml(html: string, outputPath: string) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: await resolveBrowserExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("print");
    await page.pdf({
      path: outputPath,
      format: "Letter",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });
  } finally {
    await browser.close();
  }
}
```

Browser resolution prefers an installed Brave/Chrome on Windows
(`lib/quote-pdf.ts:8-23`: checks `%LOCALAPPDATA%\BraveSoftware\...`, then
`Program Files` Brave/Chrome paths) and falls back to Puppeteer's bundled
Chromium (`puppeteer.executablePath()`).

---

## 2. The Drill Sheet Feature End-to-End

File order, UI → disk:

1. **UI trigger** — `components/drill-sheets/drill-sheet-pdf-button.tsx`
   A client component "Generate PDF" button. `onClick` calls the server action
   `generateDrillSheetPdf(drillSheetId)` inside a `useTransition`.
2. **Server action / data fetch** — `app/drill-sheets/pdf-actions.ts`
   `generateDrillSheetPdf()`:
   - Permission check: `requirePermission(AppPermission.STRUCTURES_MANAGE)`.
   - Fetches the `JobStructure` row (and related `manholeDetail`, `openings`,
     `sections`, `castings`) via Prisma using `drillSheetDetailInclude` from
     `lib/drill-sheet-detail.ts`.
   - Calls `buildDrillSheetDetail(sheet)` to reshape DB rows into
     `{ meta, result }`.
3. **HTML build / "drawing"** — `lib/drill-sheet-pdf-html.ts`
   `buildDrillSheetPdfHtml(meta, result)` builds the full HTML+SVG document
   string (header/company info, plan-view SVG, calc table, pipe data grid,
   side-elevation SVG).
4. **Geometry helpers** — `lib/drill-sheet-diagram.ts`
   Pure functions for polar coordinates, opening placement, boot/badge glyph
   geometry, knockout spokes, and the elevation band breakdown. Shared between
   the PDF builder and the on-screen live preview (`components/drill-sheets/
   drill-sheet-preview.tsx`), so the print and the editor preview stay visually
   identical.
5. **PDF render** — `lib/quote-pdf.ts` `writeQuotePdfFromHtml(html, outputPath)`
   (Puppeteer, see §1).
6. **Output path resolution** — `lib/drill-sheet-pdf-path.ts`
   - `resolveDrillSheetPdfDirectory(jobFolderPath)`: if the structure is linked
     to a `Job` with a `folderPath`, saves to `<jobFolder>\03 Drill Sheets\`;
     otherwise falls back to `C:\PrecastGeneratedPDFs\DrillSheets`.
   - `buildDrillSheetPdfBaseName(manholeNumber, projectName)` sanitizes a
     filename like `"<manhole#> - <project>.pdf"`.
   - Actual unique-path resolution is delegated to `resolveQuotePdfOutputPath`
     from `lib/quote-pdf-path.ts` (re-exported), shared with the quotes PDF
     feature.
7. **Post-write side effects** (`app/drill-sheets/pdf-actions.ts`):
   - If the structure belongs to a job, registers the new file in the job's
     file index via `registerJobFile()` (`lib/job-files-service.ts`).
   - Calls `launchWindowsFile(outputPath)` (`lib/windows-explorer.ts`) to reveal
     the saved PDF in Windows Explorer — failure here is swallowed since the
     PDF is already written.
   - Returns `{ success: true, filePath }` to the client, which displays
     `Saved: <path>`.

### Core layout function (plan view, `lib/drill-sheet-pdf-html.ts:108-132`)

```ts
function buildPlanSvg(result: DrillSheetResult): string {
  const width = 520;
  const height = 175;
  const cy = 108;
  const radius = 58;
  const base = drawCircle({ cx: 132, cy, radius }, "BASE SECTION", "(RIGHT SIDE UP)", result);
  const riser = drawCircle({ cx: 388, cy, radius }, "RISER", "", null);
  return `<svg viewBox="0 0 ${width} ${height}" ...>${base}${riser}</svg>`;
}
```

`drawCircle()` (`lib/drill-sheet-pdf-html.ts:47-106`) draws the structure
circle, 8 knockout spokes, and — for the BASE circle only — each pipe opening's
boot "bowtie" glyph, outward arrow, lettered badge, and invert/hole callout
text, using placements computed by `getOpeningPlacements()`.

### Core layout function (side elevation, `lib/drill-sheet-pdf-html.ts:221-450`)

`buildElevationSvg(result, insideDiameterFeet)` builds a fixed-pixel-proportion
cross-section (casting → brick → top slab/cone → riser wall → base wall → base
slab), with:

- Left-side "slash tick" dimension lines (`drawVSlashDim`) per band, labeled
  with real heights from `getElevationBreakdown()`.
- Right-side elevation callouts (rim / top-of-brick / top-of-slab / floor /
  base-bottom), pulled from real computed elevations.
- Pipe stub marks positioned by linear-interpolating each opening's invert
  elevation between rim and base-bottom (`lib/drill-sheet-pdf-html.ts:421-443`)
  — **note:** this vertical placement is a proportional approximation against a
  fixed-pixel layout, not a to-scale drawing (see §4 "Flag" notes).

---

## 3. Data Model

From `prisma/schema.prisma`. All structure-instance tables hang off
`JobStructure` (lines 387–430); the manhole-specific calc fields live in
`JobStructureManholeDetail`. Pipe openings live in `JobStructureOpening`.
Base/riser pour sections live in `JobStructureSection`. Castings (frame/cover)
live in `JobStructureCasting`. Template/catalog data (per-diameter section
sizes, boot lookup table, brick/key minimums) lives in `StructureTemplate*`.

### `JobStructureManholeDetail` (schema.prisma:517-545) — the calc/header fields

| Field | Type | Notes |
|---|---|---|
| `manholeStandard` | `String?` | |
| `contractorName` | `String?` | |
| `projectName` | `String?` | |
| `sheetDate` | `DateTime?` | |
| `hasSteps` | `Boolean` (default false) | |
| `rimElevation` | `Decimal? (12,4)` | |
| `lowestInvertElevation` | `Decimal? (12,4)` | derived/stored, also recomputed from openings |
| `requiredWallHeight` | `Decimal? (12,4)` | = riser+base sum |
| `invertToTopFeet` | `Decimal? (12,4)` | rim − low invert |
| `castingHeightFeet` | `Decimal? (12,4)` | |
| `topSlabHeightFeet` | `Decimal? (12,4)` | |
| `sumpFeet` | `Decimal? (12,4)` | |
| `brickAdjustmentFeet` | `Decimal? (12,4)` | |
| `hasKey` | `Boolean` (default true) | |
| `baseSlabThickness` | `Decimal? (12,4)` | stored but **not used** by the PDF/diagram code — see gap list below |
| `topSlabThickness` | `Decimal? (12,4)` | stored but **not used** by PDF/diagram code (distinct from `topSlabHeightFeet`) |
| `insideDiameter` | `Decimal? (12,4)` | feet |
| `coneOrFlatTop` | `String?` | stored, **not rendered** in current PDF |
| `frameAndCoverType` | `String?` | stored, **not rendered** in current PDF (casting name comes from `JobStructureCasting` instead) |
| `chimneyHeight` | `Decimal? (12,4)` | stored, **not used** in current calc/diagram |
| `notes` | `String?` | |

### `JobStructureOpening` (schema.prisma:448-470) — pipe penetrations A–D etc.

| Field | Type | Notes |
|---|---|---|
| `openingNumber` | `Int?` | |
| `wallLocation` | `String?` | used as the opening **label** (A/B/C/D) in `drill-sheet-detail.ts` |
| `clockPosition` | `String?` | stored, **not used** — angle math uses `angle` (degrees), not this field |
| `pipeType` | `String?` | → "TYPE" column |
| `pipeDiameter` | `Decimal? (12,4)` | → "DIA" column |
| `connectionType` | `String?` | stored, **not used** in PDF |
| `invertElevation` | `Decimal? (12,4)` | → "INVERT" column |
| `holeDiameter` | `Decimal? (12,4)` | boot hole size; can be pre-set on the row OR looked up live from `StructureTemplateBootSize` via `lookupHoleDiameter()` |
| `bootType` | `String?` | presence (non-null) is read as boolean "has boot" → "BOOT" column (Yes/No); the actual *string value* of `bootType` is not displayed |
| `gasketType` | `String?` | stored, **not used** in PDF |
| `sleeveType` | `String?` | stored, **not used** in PDF |
| `angle` | `Decimal? (12,4)` | clockwise-from-up bearing in degrees; see §4 |
| `notes` | `String?` | |

### `JobStructureSection` (schema.prisma:433-446) — base/riser breakdown

| Field | Type |
|---|---|
| `role` | `SectionRole` enum (`BASE` \| `RISER`) |
| `heightFeet` | `Decimal (6,4)` |
| `label` | `String?` |
| `sortOrder` | `Int` |

### `JobStructureCasting` (schema.prisma:472-495)

`castingType`, `castingDescription` (used as the PDF "Casting:" field),
`frameSize`, `coverType`, `grateType`, `hatchSize`, `loadRating`, `boltDown`,
`vented`, `quantity`, `notes`. None of the frame/grate/hatch/load-rating detail
fields are currently rendered on the drill sheet PDF — only
`castingDescription` is.

### Template / catalog tables driving the calc

- `StructureTemplate` (289-307): `minimumBrickFeet` (default 0.3333 ft = 4"),
  `keyClearanceFeet` (default 0.3333 ft = 4").
- `StructureTemplateDiameter` (311-327): `insideDiameterFeet`,
  `moldMaxHeightFeet`, `topSlabHeightWithKeyFeet`, `topSlabHeightNoKeyFeet`.
- `StructureTemplateSection` (331-344): per-diameter catalog of pourable
  `BASE`/`RISER` heights the auto-picker chooses from.
- `StructureTemplateBootSize` (347-360): pipe-diameter → boot-hole-diameter
  lookup table (drives sump calc).

### Gaps vs. the example image's data table

The image's per-pipe row is **INVERT / DIA / TYPE / BOOT** for pipes A–D — all
four of those map cleanly to schema fields (`invertElevation`, `pipeDiameter`,
`pipeType`, `bootType` presence). No gap there.

Gaps are in the **header/cross-section** fields, not the pipe table:

- **Wall height "type"/breakdown** (base size vs. riser count/size) is derived
  at render time from `JobStructureSection` rows, not stored as a single
  "type" field — multiple risers of the same height get summarized
  (`summarizeRisers()` in `lib/drill-sheet-pdf-html.ts:467-482`) as e.g.
  `"2 @ 4'-0\""`.
- **Base slab thickness for the drawn detail** is **hardcoded**, not pulled
  from `baseSlabThickness` on `JobStructureManholeDetail` — see
  `NOMINAL_BASE_SLAB_FEET = 8/12` in `lib/drill-sheet-diagram.ts:157` (flagged
  again in §4).
- **Nominal access-opening width** (the 24" hole drawn in the top-slab/cone
  detail) is **hardcoded** as `NOMINAL_ACCESS_OPENING_IN = 24` in
  `lib/drill-sheet-pdf-html.ts:140` — there is no schema field for it.
- `chimneyHeight`, `coneOrFlatTop`, `frameAndCoverType`, `topSlabThickness`,
  `clockPosition`, `connectionType`, `gasketType`, `sleeveType` are stored in
  the schema but **not consumed anywhere** in the diagram/PDF code.

---

## 4. The Math

All core math lives in `lib/drill-sheet.ts` (framework-agnostic, no
Prisma/React imports — reused by both server actions and the live browser
preview) plus `lib/drill-sheet-diagram.ts` for the geometry/SVG-coordinate
layer.

### Bearing → plan-view position (`lib/drill-sheet-diagram.ts:28-40`)

```ts
export function polarToXY(angleDeg, radius, cx, cy) {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(radians),
    y: cy - radius * Math.cos(radians),
  };
}
```

Convention: **angle is clockwise from "up" (12 o'clock) = 0°**, not a
true compass bearing/azimuth. 90° = 3 o'clock (right), 180° = 6 o'clock
(bottom), 270° = 9 o'clock (left). This is an on-paper plan convention, not
geographic north — there's no rotation/orientation field tying the manhole's
drawn "up" to true north or a site plan.

**The lowest-invert pipe is always forced to 0° (straight up)** regardless of
its stored `angle` value (`lib/drill-sheet-diagram.ts:51`:
`const angleDeg = opening.isLowInvert ? 0 : (opening.angleDegrees ?? 0);`).
All other pipes use their stored `angle` value as entered by the user — **the
app does not compute relative bearings between pipes**; the user manually
enters each non-outlet pipe's angle relative to the (always-up) outlet in the
form (`components/drill-sheets/drill-sheet-form.tsx:592-606`, a plain number
input, placeholder `"90"`).

### Sump (floor-to-low-invert) (`lib/drill-sheet.ts:103-113`)

```ts
export function computeSumpFeet(holeDiameterInches, pipeDiameterInches): number {
  if (holeDiameterInches == null || pipeDiameterInches == null) return 0;
  const sumpInches = (holeDiameterInches - pipeDiameterInches) / 2;
  return round4(Math.max(sumpInches, 0) / 12);
}
```
i.e. half the radial clearance between the boot hole and the pipe OD,
converted to feet. Hole diameter comes from `lookupHoleDiameter()`
(`StructureTemplateBootSize` exact-match lookup; returns `null` — and a
warning — if no boot size is configured for that pipe diameter).

### Invert-to-top (`lib/drill-sheet.ts:115-123`)

```ts
export function computeInvertToTopFeet(rimElevation, lowInvertElevation) {
  if (rimElevation == null || lowInvertElevation == null) return null;
  return round4(rimElevation - lowInvertElevation);
}
```

### Wall height / available height (`lib/drill-sheet.ts:314-435`, `computeDrillSheet`)

Plain-English: start from rim-to-low-invert, subtract the casting height and
the top-slab height (which itself depends on whether a "key" notch is used),
add back the sump, and that leftover footage ("available") is what gets
divided between brick adjustment and actual base+riser wall:

```
availableFeet = invertToTopFeet − castingHeightFeet − topSlabHeightFeet + sumpFeet
maxWall       = max(availableFeet − minimumBrickFeet, 0)
{ sections, wallHeightFeet } = selectSections(diameterCatalog, maxWall)
brickAdjustmentFeet = availableFeet − wallHeightFeet
```

`selectSections()` (`lib/drill-sheet.ts:176-250`) is a small **bounded
knapsack/DP**: for each candidate base height (largest first), it calls
`maximizeRisers()` — a coin-change-style DP (`lib/drill-sheet.ts:129-170`,
scaled to hundredths of a foot, `SCALE = 100`) that finds the maximum
riser-height sum ≤ the remaining target using the catalog's riser sizes with
unlimited repeats — then keeps whichever base+riser combo gets closest to
(without exceeding) the max wall height, preferring a single base section. If
nothing fits, it falls back to the smallest base alone.

### Key (keyway) determination (`lib/drill-sheet.ts:376-395`)

Two-pass: first assume `hasKey = true`, compute wall height under that
assumption, then check whether the **highest pipe's boot-hole top** clears the
top of the wall by at least `template.keyClearanceFeet`. If it doesn't clear,
flip to `hasKey = false` and recompute. Can be overridden by the user
(`hasKeyOverride`).

`highestHoleTopElevation()` (`lib/drill-sheet.ts:259-278`):
```
holeTop = invertElevation + pipeDiameterInches/2/12 + holeDiameterInches/2/12
```
i.e. invert + half the pipe OD + half the boot hole diameter (both converted
inches→feet) — the top of the boot hole opening in the wall.

### Elevation breakdown for the side-view drawing (`lib/drill-sheet-diagram.ts:164-224`)

```ts
topOfBrick = rim - castingHeightFeet
topOfSlab  = topOfBrick - brickAdjustmentFeet
topOfWall  = topOfSlab - topSlabHeightFeet
floor      = lowInvertElevation - sumpFeet
baseBottom = floor - NOMINAL_BASE_SLAB_FEET   // hardcoded 8" — see flag below
```

### Things flagged as hardcoded / approximated / missing

1. **`NOMINAL_BASE_SLAB_FEET = 8 / 12`** (`lib/drill-sheet-diagram.ts:157`) —
   base slab thickness used in the elevation drawing/elevations is a fixed 8",
   **not** read from `JobStructureManholeDetail.baseSlabThickness` even though
   that field exists in the schema and is populated by some flows (need to
   verify writers — see Section 3 gap list).
2. **`NOMINAL_ACCESS_OPENING_IN = 24`** (`lib/drill-sheet-pdf-html.ts:140`) —
   the access-opening width drawn in the cone/top-slab is fixed at 24", no
   schema field backs it.
3. **Side-elevation drawing is not to scale.** `buildElevationSvg()` uses
   **fixed pixel band heights** (`BAND.casting/brick/topSlab/riser/base/slab`,
   `lib/drill-sheet-pdf-html.ts:242-249`) for visual proportions; only the text
   labels (dimensions, elevations) reflect real computed numbers. Pipe stub
   marks are placed by **linear interpolation of elevation ratio onto the
   fixed-pixel band layout** (`lib/drill-sheet-pdf-html.ts:421-443`), which is
   an approximation, not a geometrically accurate cross-section.
4. **Angle is plan-convention, not compass bearing.** As noted above, "angle"
   is clockwise-from-up on the drawn circle, manually entered per pipe; there
   is no computation of true bearings, no north arrow, and no validation that
   angles entered for multiple pipes don't overlap each other on the circle.
5. **Boot lookup is an exact-match-only table.** `lookupHoleDiameter()`
   (`lib/drill-sheet.ts:90-101`) does a strict (epsilon) equality match against
   `StructureTemplateBootSize.pipeDiameterInches` — no interpolation/rounding
   for an unlisted pipe size; falls through to `null` + a user-facing warning.
6. **`clockPosition` field is dead.** Stored on `JobStructureOpening` but
   never read; the actual angle math uses the separate `angle` decimal field.

---

## 5. Current Output vs. Target

No sample fixture PDFs, reference PNGs, or automated tests exist in the repo
for this feature (`Glob` for `*drill*sample*`, `__tests__/**drill**`, etc. all
returned no app-level results — only unrelated `node_modules` test files
matched generic `*.test.ts` searches). The only "reference" is informal: code
comments in `lib/drill-sheet-pdf-html.ts` and `lib/drill-sheet-diagram.ts`
repeatedly say things like *"matches example PNG"* / *"matches the example"*
(e.g. lines 30, 116, 134-137, 182), implying a developer was matching a
hand-drawn example image during implementation, but that image is not checked
into the repo.

**Structurally, the generated PDF (`buildDrillSheetPdfHtml`) currently contains, top to bottom:**

1. Header: company logo (if configured) + name/address/phone, "Approved By:"
   signature line.
2. Field list: Contractor, Project, Date, Manhole #, Casting, Steps (Yes/No).
3. Plan view: two side-by-side circles — "BASE SECTION (RIGHT SIDE UP)" with
   pipe openings/boots/badges/callouts, and a blank "RISER" circle — both with
   8 knockout spokes.
4. Bottom-left: a calc table (Rim Elevation → Wall Height, with running
   subtractions/additions), a "USE: Ø / Base / Riser" summary line, a "Brick
   Adjustment" line, and the INVERT/DIA/TYPE/BOOT grid (min 4 rows, A–D even if
   empty), plus any computed warnings (e.g. brick below minimum, missing boot
   size, no sections configured).
5. Bottom-right: the side-elevation cross-section SVG (or a "No sections
   selected" placeholder if there are no `sections`).

**What's structurally absent** relative to a typical hand-drafted drill sheet:
no title block/sheet number, no scale/north-arrow annotation, no
frame/grate/hatch/load-rating casting detail (only `castingDescription`
text), no chimney/cone-vs-flat-top distinction even though those schema
fields exist, and (per §4) the elevation drawing is schematic/proportional
rather than to-scale.

---

## 6. Rendering Capabilities Already Available

- **Not Electron.** Confirmed no `electron`, `BrowserWindow`, or
  `webContents` usage anywhere in source (only incidental mentions inside
  `node_modules`/`package-lock.json` transitive dependency trees, not actual
  app code). There is therefore no `webContents.printToPDF` available — the
  app instead spawns Puppeteer's own Chromium/Brave process per PDF (see §1).
- **SVG**: used extensively and natively (raw inline SVG strings in
  TypeScript, both for the PDF HTML and for the live React preview at
  `components/drill-sheets/drill-sheet-preview.tsx`). No separate SVG library
  dependency is needed or used — it's hand-built markup.
- **Charting libraries**: none found (no d3, recharts, chart.js, etc. in
  `package.json`).
- **Canvas**: not used for this feature.
- **xlsx** (`^0.18.5`) is present as a dependency for spreadsheet
  import/export elsewhere in the app (e.g. bulk product paste) — unrelated to
  drill sheets.
- **pdf-lib** (`^1.17.1`) is present and used for PDF *manipulation*
  (`lib/submittal-package.ts` — merging/stitching existing PDFs into a
  submittal package), not for drawing the drill sheet itself.

---

## 7. Project Meta

- **OS/shell assumptions**: Windows-specific. `lib/quote-pdf.ts` hardcodes
  Windows browser install paths (`%LOCALAPPDATA%\BraveSoftware\...`,
  `C:\Program Files\...`). `lib/drill-sheet-pdf-path.ts` hardcodes a Windows
  fallback output directory `C:\PrecastGeneratedPDFs\DrillSheets`. There's
  also `lib/windows-explorer.ts` (`launchWindowsFile`) to reveal the saved PDF
  in Windows Explorer after generation. Per `AGENTS.md`, the project targets
  installed PostgreSQL 18 on `localhost:5432` and assumes a Windows dev box.
- **Build tooling**: plain **Next.js 16.2.9** App Router project (no
  Vite/Webpack config of its own beyond Next's built-in bundler, no
  electron-builder, no separate main/renderer process split). `next dev` /
  `next build` / `next start` are the only build scripts.
- **How the feature is invoked during dev**: `npm run dev` → `predev` runs
  `prisma generate` → `next dev` starts the Next dev server → navigate to
  `/drill-sheets/[id]` → click "Generate PDF" (`DrillSheetPdfButton`), which
  invokes the `generateDrillSheetPdf` server action over Next's RSC/server-
  action transport — no separate API route or background worker process.
  `postinstall` (`prisma generate && puppeteer browsers install chrome`)
  ensures a Puppeteer-compatible Chromium is available even if no Brave/Chrome
  is installed locally.
- **Permissions**: PDF generation requires the `STRUCTURES_MANAGE`
  `AppPermission` (checked via `requirePermission()` in
  `app/drill-sheets/pdf-actions.ts:28`), consistent with this app's
  role-based, username-only auth model described in `AGENTS.md`.

---

## File Index (all paths relative to repo root)

| Path | Role |
|---|---|
| `lib/quote-pdf.ts` | Puppeteer launch + `page.pdf()` — shared HTML→PDF renderer |
| `lib/drill-sheet-pdf-html.ts` | Builds the full drill-sheet HTML/SVG document |
| `lib/drill-sheet-diagram.ts` | Plan/elevation geometry helpers (shared PDF + live preview) |
| `lib/drill-sheet.ts` | Pure calc engine (`computeDrillSheet`, sump/wall/key/brick math) |
| `lib/drill-sheet-detail.ts` | Maps Prisma rows ↔ `{ meta, result }` shape |
| `lib/drill-sheet-pdf-path.ts` | Output filename/directory resolution |
| `lib/drill-sheet-options.ts` | Template/diameter/casting option loading for the form |
| `app/drill-sheets/pdf-actions.ts` | Server action: fetch → build HTML → render → save → register |
| `app/drill-sheets/actions.ts` | Create/update server actions (persists form → DB) |
| `app/drill-sheets/[id]/page.tsx` | Detail page, hosts the "Generate PDF" button |
| `app/drill-sheets/[id]/preview/page.tsx` | Browser preview/print route |
| `app/drill-sheets/[id]/edit/page.tsx`, `new/page.tsx` | Form pages |
| `components/drill-sheets/drill-sheet-pdf-button.tsx` | UI trigger (client component) |
| `components/drill-sheets/drill-sheet-form.tsx` | Data-entry form incl. per-pipe angle input |
| `components/drill-sheets/drill-sheet-preview.tsx` | Live on-screen SVG preview (mirrors PDF layout) |
| `components/drill-sheets/drill-sheet-preview-content.tsx` | Preview page wrapper |
| `prisma/schema.prisma` (lines 289–562) | `StructureTemplate*`, `JobStructure*` models |
