import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import { type DrillSheetResult, formatFeetInches } from "@/lib/drill-sheet";
import {
  getBootSymbol,
  getElevationBreakdown,
  getKnockoutSpokes,
  getOpeningCallout,
  getOpeningPlacements,
  polarToXY,
  type DiagramLayout,
} from "@/lib/drill-sheet-diagram";
import { getAppSettings, type CompanyProfile } from "@/lib/app-settings";
import { getCompanyLogoDataUri } from "@/lib/company-logo";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function feet(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(2);
}

/** Dimension label: inches under 2', otherwise feet-inches (matches example). */
function dimLabel(feetValue: number): string {
  if (feetValue <= 0) {
    return "";
  }
  const inches = Math.round(feetValue * 12);
  return feetValue < 2 ? `${inches}"` : formatFeetInches(feetValue);
}

function n(value: number): string {
  return value.toFixed(1);
}

// ---------------------------------------------------------------------------
// Plan view: BASE SECTION (with openings) + RISER (blank), each with knockout
// spokes and a double wall. The outlet (low invert) is forced to 12 o'clock.
// ---------------------------------------------------------------------------
function drawCircle(
  layout: DiagramLayout,
  title: string,
  subtitle: string,
  result: DrillSheetResult | null,
): string {
  const { cx, cy, radius } = layout;
  const spokes = getKnockoutSpokes(layout, 8, 10, 26)
    .map(
      (s) =>
        `<line x1="${n(s.x1)}" y1="${n(s.y1)}" x2="${n(s.x2)}" y2="${n(s.y2)}" stroke="#9ca3af" stroke-width="1" />`,
    )
    .join("");

  let openings = "";
  if (result) {
    const placements = getOpeningPlacements(result.openings, layout);
    openings = placements
      .map((placement, index) => {
        const opening = result.openings[index];
        const callout = getOpeningCallout(opening, result.lowInvertElevation);
        const boot = getBootSymbol(placement, layout);
        const angle = placement.angleDeg;

        const badge = boot.badge;

        let labelText = "";
        if (opening.isLowInvert && callout.holeLabel) {
          // Low invert: hole label centered above the circle (matches example PNG).
          labelText = `<text x="${n(cx)}" y="${n(cy - radius - 10)}" text-anchor="middle" font-size="10" fill="#111827">${escapeHtml(callout.holeLabel)}</text>`;
        } else if (callout.holeLabel) {
          const labelPos = polarToXY(angle, radius + 28, cx, cy);
          const dx = labelPos.x - cx;
          const anchor =
            Math.abs(dx) < 18 ? "middle" : dx > 0 ? "start" : "end";
          const below = labelPos.y > cy;
          labelText = `<text x="${n(labelPos.x)}" y="${n(below ? labelPos.y + 12 : labelPos.y - 4)}" text-anchor="${anchor}" font-size="10" fill="#111827">${escapeHtml(callout.holeLabel)}</text>`;
        }

        const bowtie = `<polygon points="${n(boot.bowtie[0].x)},${n(boot.bowtie[0].y)} ${n(boot.bowtie[1].x)},${n(boot.bowtie[1].y)} ${n(boot.center.x)},${n(boot.center.y)}" fill="#ffffff" stroke="#111827" stroke-width="1.2" /><polygon points="${n(boot.bowtie[2].x)},${n(boot.bowtie[2].y)} ${n(boot.bowtie[3].x)},${n(boot.bowtie[3].y)} ${n(boot.center.x)},${n(boot.center.y)}" fill="#ffffff" stroke="#111827" stroke-width="1.2" />`;

        const arrow = `<line x1="${n(boot.arrowTail.x)}" y1="${n(boot.arrowTail.y)}" x2="${n(boot.arrowTip.x)}" y2="${n(boot.arrowTip.y)}" stroke="#111827" stroke-width="1.2" marker-end="url(#plan-arrow)" />`;

        const badgeMark = `<circle cx="${n(badge.x)}" cy="${n(badge.y)}" r="7" fill="#ffffff" stroke="#111827" stroke-width="1" /><text x="${n(badge.x)}" y="${n(badge.y + 3)}" text-anchor="middle" font-size="9" font-weight="700" fill="#111827">${escapeHtml(placement.label)}</text>`;

        return `${arrow}${bowtie}${badgeMark}${labelText}`;
      })
      .join("");
  }

  return `
    <text x="${n(cx)}" y="14" text-anchor="middle" font-size="11" font-weight="700" fill="#111827">${escapeHtml(title)}</text>
    ${subtitle ? `<text x="${n(cx)}" y="26" text-anchor="middle" font-size="9" fill="#374151">${escapeHtml(subtitle)}</text>` : ""}
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(radius)}" fill="#ffffff" stroke="#111827" stroke-width="1.5" />
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(radius - 4)}" fill="none" stroke="#111827" stroke-width="0.75" />
    <circle cx="${n(cx)}" cy="${n(cy)}" r="1.5" fill="#111827" />
    ${spokes}
    ${openings}
  `;
}

function buildPlanSvg(result: DrillSheetResult): string {
  const width = 520;
  const height = 210;
  const cy = 120;
  const radius = 58;
  const base = drawCircle(
    { cx: 132, cy, radius },
    "BASE SECTION",
    "(RIGHT SIDE UP)",
    result,
  );
  const riser = drawCircle({ cx: 388, cy, radius }, "RISER", "", null);

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        <marker id="plan-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#111827" />
        </marker>
      </defs>
      ${base}
      ${riser}
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Side elevation: fixed-layout outline cross-section matching the example PNG.
// Band pixel heights are visual only; dimension/elevation labels use real data.
// ---------------------------------------------------------------------------

/** Nominal access opening width (not in data model). */
const NOMINAL_ACCESS_OPENING_IN = 24;

function slashTick(x: number, y: number, size = 3): string {
  return `<line x1="${n(x - size)}" y1="${n(y - size)}" x2="${n(x + size)}" y2="${n(y + size)}" stroke="#111827" stroke-width="0.75" />`;
}

function drawVSlashDim(
  dimX: number,
  yTop: number,
  yBot: number,
  label: string,
  witnessX: number,
): string {
  if (!label || yBot - yTop < 2) {
    return "";
  }
  const mid = (yTop + yBot) / 2;
  return `
    ${slashTick(dimX, yTop)}
    ${slashTick(dimX, yBot)}
    <line x1="${n(dimX)}" y1="${n(yTop)}" x2="${n(dimX)}" y2="${n(yBot)}" stroke="#111827" stroke-width="0.75" />
    <line x1="${n(dimX)}" y1="${n(yTop)}" x2="${n(witnessX)}" y2="${n(yTop)}" stroke="#9ca3af" stroke-width="0.5" />
    <line x1="${n(dimX)}" y1="${n(yBot)}" x2="${n(witnessX)}" y2="${n(yBot)}" stroke="#9ca3af" stroke-width="0.5" />
    <text x="${n(dimX - 4)}" y="${n(mid + 3)}" text-anchor="end" font-size="9" fill="#111827">${escapeHtml(label)}</text>
  `;
}

function drawHSlashDim(
  y: number,
  xLeft: number,
  xRight: number,
  label: string,
): string {
  const mid = (xLeft + xRight) / 2;
  return `
    ${slashTick(xLeft, y)}
    ${slashTick(xRight, y)}
    <line x1="${n(xLeft)}" y1="${n(y)}" x2="${n(xRight)}" y2="${n(y)}" stroke="#111827" stroke-width="0.75" />
    <text x="${n(mid)}" y="${n(y - 4)}" text-anchor="middle" font-size="9" fill="#111827">${escapeHtml(label)}</text>
  `;
}

/** Lap joint notch on the outer wall (tongue-and-groove detail). */
function drawLapLeft(
  y: number,
  outerX: number,
  depth: number,
  width: number,
): string {
  return `<polyline points="${n(outerX)},${n(y)} ${n(outerX - width)},${n(y)} ${n(outerX - width)},${n(y + depth)}" fill="none" stroke="#111827" stroke-width="1" />`;
}

function drawLapRight(
  y: number,
  outerX: number,
  depth: number,
  width: number,
): string {
  return `<polyline points="${n(outerX)},${n(y)} ${n(outerX + width)},${n(y)} ${n(outerX + width)},${n(y + depth)}" fill="none" stroke="#111827" stroke-width="1" />`;
}

/** Small corner "+" mark, e.g. for grade-ring bolt/adjustment points. */
function drawCornerCross(x: number, y: number, size = 2.5): string {
  return `<line x1="${n(x - size)}" y1="${n(y)}" x2="${n(x + size)}" y2="${n(y)}" stroke="#111827" stroke-width="0.75" /><line x1="${n(x)}" y1="${n(y - size)}" x2="${n(x)}" y2="${n(y + size)}" stroke="#111827" stroke-width="0.75" />`;
}

/** Diagonal hatch fill for the casting frame band. */
function drawHatch(x: number, y: number, width: number, height: number): string {
  const lines: string[] = [];
  const step = 5;
  for (let lx = x - height; lx < x + width; lx += step) {
    const x1 = Math.max(x, lx);
    const y1 = y + (x1 - lx);
    const x2 = Math.min(x + width, lx + height);
    const y2 = y + (x2 - lx);
    if (x2 > x1) {
      lines.push(
        `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#111827" stroke-width="0.5" />`,
      );
    }
  }
  return lines.join("");
}

function buildElevationSvg(
  result: DrillSheetResult,
  insideDiameterFeet: number | null,
): string {
  const breakdown = getElevationBreakdown(result);
  if (breakdown.bands.length === 0) {
    return "";
  }

  const sumKey = (key: string) =>
    breakdown.bands
      .filter((band) => band.key === key)
      .reduce((sum, band) => sum + band.heightFeet, 0);
  const fCasting = sumKey("CASTING");
  const fBrick = sumKey("BRICK");
  const fTopSlab = sumKey("TOPSLAB");
  const fRiser = sumKey("RISER");
  const fBase = sumKey("BASE");
  const fSlab = breakdown.baseSlabFeet;

  // Fixed pixel band heights (visual proportions; labels from real data).
  const BAND = {
    casting: 8,
    brick: 10,
    topSlab: 11,
    riser: 72,
    base: 52,
    slab: 8,
  };

  const width = 260;
  const height = 240;
  const topY = 16;
  const centerX = 118;

  // The structure is a constant-diameter precast cylinder (matches the
  // example): riser and base share the same wall width — there is no
  // tapered cone. Only the casting/brick/top-slab collar above the riser is
  // narrower (it seats the frame over the access opening), stepping out to
  // the full riser width via a lap notch, exactly like the riser-to-base
  // joint below it.
  const wallOut = 50;
  const wallIn = 42;
  const collarOut = 20;
  const collarIn = 14;
  const wAccess = 12;
  const lapDepth = 2;
  const lapWidth = 5;

  const riserPx = fRiser > 0 ? BAND.riser : 8;
  const basePx = fBase > 0 ? BAND.base : 8;
  const castingPx = fCasting > 0 ? BAND.casting : 4;

  let y = topY;
  const yRim = y;
  y += castingPx;
  const yBrickTop = y;
  y += fBrick > 0 ? BAND.brick : 0;
  const ySlabTop = y;
  y += BAND.topSlab;
  const yWallTop = y;
  y += riserPx;
  const yRiserBot = y;
  y += basePx;
  const yFloor = y;
  y += BAND.slab;
  const yBase = y;

  const parts: string[] = [];

  // ---- Base slab (full footprint) ----
  parts.push(
    `<rect x="${n(centerX - wallOut)}" y="${n(yFloor)}" width="${n(wallOut * 2)}" height="${n(yBase - yFloor)}" fill="#ffffff" stroke="#111827" stroke-width="1.2" />`,
  );

  // ---- Base walls (double lines, same width as the riser) ----
  parts.push(
    `<line x1="${n(centerX - wallOut)}" y1="${n(yRiserBot)}" x2="${n(centerX - wallOut)}" y2="${n(yFloor)}" stroke="#111827" stroke-width="1.2" />`,
  );
  parts.push(
    `<line x1="${n(centerX - wallIn)}" y1="${n(yRiserBot)}" x2="${n(centerX - wallIn)}" y2="${n(yFloor)}" stroke="#111827" stroke-width="1" />`,
  );
  parts.push(
    `<line x1="${n(centerX + wallOut)}" y1="${n(yRiserBot)}" x2="${n(centerX + wallOut)}" y2="${n(yFloor)}" stroke="#111827" stroke-width="1.2" />`,
  );
  parts.push(
    `<line x1="${n(centerX + wallIn)}" y1="${n(yRiserBot)}" x2="${n(centerX + wallIn)}" y2="${n(yFloor)}" stroke="#111827" stroke-width="1" />`,
  );
  // Interior floor line
  parts.push(
    `<line x1="${n(centerX - wallIn)}" y1="${n(yFloor)}" x2="${n(centerX + wallIn)}" y2="${n(yFloor)}" stroke="#111827" stroke-width="1" />`,
  );

  // ---- Riser-to-base lap joint (no width change, just the notch detail) ----
  parts.push(drawLapLeft(yRiserBot, centerX - wallOut, lapDepth, lapWidth));
  parts.push(drawLapRight(yRiserBot, centerX + wallOut, lapDepth, lapWidth));

  // ---- Riser walls (double lines, same width as the base) ----
  parts.push(
    `<line x1="${n(centerX - wallOut)}" y1="${n(yWallTop)}" x2="${n(centerX - wallOut)}" y2="${n(yRiserBot)}" stroke="#111827" stroke-width="1.2" />`,
  );
  parts.push(
    `<line x1="${n(centerX - wallIn)}" y1="${n(yWallTop)}" x2="${n(centerX - wallIn)}" y2="${n(yRiserBot)}" stroke="#111827" stroke-width="1" />`,
  );
  parts.push(
    `<line x1="${n(centerX + wallOut)}" y1="${n(yWallTop)}" x2="${n(centerX + wallOut)}" y2="${n(yRiserBot)}" stroke="#111827" stroke-width="1.2" />`,
  );
  parts.push(
    `<line x1="${n(centerX + wallIn)}" y1="${n(yWallTop)}" x2="${n(centerX + wallIn)}" y2="${n(yRiserBot)}" stroke="#111827" stroke-width="1" />`,
  );

  // ---- Collar-to-riser step (narrow seat widens out to the full wall) ----
  parts.push(
    `<line x1="${n(centerX - collarOut)}" y1="${n(yWallTop)}" x2="${n(centerX - wallOut)}" y2="${n(yWallTop)}" stroke="#111827" stroke-width="1" />`,
  );
  parts.push(
    `<line x1="${n(centerX + collarOut)}" y1="${n(yWallTop)}" x2="${n(centerX + wallOut)}" y2="${n(yWallTop)}" stroke="#111827" stroke-width="1" />`,
  );
  parts.push(drawLapLeft(yWallTop, centerX - collarOut, lapDepth, lapWidth));
  parts.push(drawLapRight(yWallTop, centerX + collarOut, lapDepth, lapWidth));

  // ---- Top-slab collar (plain, narrow neck above the riser) ----
  parts.push(
    `<line x1="${n(centerX - collarOut)}" y1="${n(ySlabTop)}" x2="${n(centerX - collarOut)}" y2="${n(yWallTop)}" stroke="#111827" stroke-width="1.2" />`,
  );
  parts.push(
    `<line x1="${n(centerX + collarOut)}" y1="${n(ySlabTop)}" x2="${n(centerX + collarOut)}" y2="${n(yWallTop)}" stroke="#111827" stroke-width="1.2" />`,
  );

  // ---- Brick/grade-ring collar, with corner bolt marks ----
  if (fBrick > 0) {
    parts.push(
      `<rect x="${n(centerX - collarOut)}" y="${n(yBrickTop)}" width="${n(collarOut * 2)}" height="${n(ySlabTop - yBrickTop)}" fill="#ffffff" stroke="#111827" stroke-width="1.2" />`,
    );
    parts.push(drawCornerCross(centerX - collarOut, yBrickTop));
    parts.push(drawCornerCross(centerX - collarOut, ySlabTop));
    parts.push(drawCornerCross(centerX + collarOut, yBrickTop));
    parts.push(drawCornerCross(centerX + collarOut, ySlabTop));
  }

  // ---- Casting frame, hatched ----
  if (fCasting > 0) {
    parts.push(
      `<rect x="${n(centerX - collarOut)}" y="${n(yRim)}" width="${n(collarOut * 2)}" height="${n(yBrickTop - yRim)}" fill="#ffffff" stroke="#111827" stroke-width="1" />`,
    );
    parts.push(drawHatch(centerX - collarOut, yRim, collarOut * 2, yBrickTop - yRim));
  }
  // Heavy rim line extending past walls
  parts.push(
    `<line x1="${n(centerX - collarOut - 4)}" y1="${n(yRim)}" x2="${n(centerX + collarOut + 4)}" y2="${n(yRim)}" stroke="#111827" stroke-width="1.5" />`,
  );

  // ---- Left-side vertical dimensions (slash ticks) ----
  const dimX = centerX - wallOut - 22;
  const witnessX = centerX - wallOut;
  if (fCasting > 0) {
    parts.push(drawVSlashDim(dimX, yRim, yBrickTop, dimLabel(fCasting), witnessX));
  }
  if (fBrick > 0) {
    parts.push(drawVSlashDim(dimX, yBrickTop, ySlabTop, dimLabel(fBrick), witnessX));
  }
  parts.push(drawVSlashDim(dimX, ySlabTop, yWallTop, dimLabel(fTopSlab), witnessX));
  if (fRiser > 0) {
    parts.push(drawVSlashDim(dimX, yWallTop, yRiserBot, dimLabel(fRiser), witnessX));
  }
  if (fBase > 0) {
    parts.push(drawVSlashDim(dimX, yRiserBot, yFloor, dimLabel(fBase), witnessX));
  }
  parts.push(drawVSlashDim(dimX, yFloor, yBase, dimLabel(fSlab), witnessX));

  // ---- Right-side elevation callouts ----
  const elevX = centerX + wallOut + 4;
  const elevMark = (y: number, value: number | null) => {
    if (value == null) {
      return "";
    }
    return `
      <line x1="${n(centerX + wallOut)}" y1="${n(y)}" x2="${n(elevX)}" y2="${n(y)}" stroke="#9ca3af" stroke-width="0.5" />
      <text x="${n(elevX + 2)}" y="${n(y + 3)}" text-anchor="start" font-size="9" fill="#111827">${value.toFixed(2)}</text>
    `;
  };
  parts.push(elevMark(yRim, breakdown.elevations.rim));
  parts.push(elevMark(yBrickTop, breakdown.elevations.topOfBrick));
  parts.push(elevMark(ySlabTop, breakdown.elevations.topOfSlab));
  parts.push(elevMark(yFloor, breakdown.elevations.floor));
  parts.push(elevMark(yBase, breakdown.elevations.baseBottom));

  // ---- Interior horizontal dimensions ----
  parts.push(
    drawHSlashDim(yWallTop + 8, centerX - wAccess, centerX + wAccess, `${NOMINAL_ACCESS_OPENING_IN}"`),
  );
  if (insideDiameterFeet != null) {
    parts.push(
      drawHSlashDim(
        (yWallTop + yRiserBot) / 2 + 14,
        centerX - wallIn,
        centerX + wallIn,
        dimLabel(insideDiameterFeet),
      ),
    );
  }

  // ---- Pipe stubs at inverts (mapped onto fixed layout by elevation ratio) ----
  const rim = breakdown.elevations.rim;
  const baseBottom = breakdown.elevations.baseBottom;
  if (rim != null && baseBottom != null && baseBottom < rim) {
    const elevSpan = rim - baseBottom;
    for (const opening of result.openings) {
      if (opening.invertElevation == null) {
        continue;
      }
      const t = (rim - opening.invertElevation) / elevSpan;
      const py = yRim + t * (yBase - yRim);
      if (py < yWallTop || py > yFloor) {
        continue;
      }
      parts.push(
        `<line x1="${n(centerX - wallOut - 10)}" y1="${n(py)}" x2="${n(centerX - wallIn)}" y2="${n(py)}" stroke="#111827" stroke-width="2.5" />`,
      );
    }
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      ${parts.join("")}
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Right/bottom-left data blocks.
// ---------------------------------------------------------------------------
function calcRow(label: string, value: string, opts: { underline?: boolean; total?: boolean } = {}) {
  const cls = [opts.underline ? "u" : "", opts.total ? "total" : ""]
    .filter(Boolean)
    .join(" ");
  return `
    <tr class="${cls}">
      <td class="lbl">${escapeHtml(label)}</td>
      <td class="num">${escapeHtml(value)}</td>
    </tr>
  `;
}

function summarizeRisers(result: DrillSheetResult): string {
  const risers = result.sections.filter((section) => section.role === "RISER");
  if (risers.length === 0) {
    return "—";
  }
  const groups = new Map<string, number>();
  for (const riser of risers) {
    const key = formatFeetInches(riser.heightFeet);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return Array.from(groups.entries())
    .map(([heightLabel, count]) =>
      count > 1 ? `${count} @ ${heightLabel}` : heightLabel,
    )
    .join(", ");
}

function baseHeightLabel(result: DrillSheetResult): string {
  const base = result.sections.find((section) => section.role === "BASE");
  return base ? formatFeetInches(base.heightFeet) : "—";
}

export async function buildDrillSheetPdfHtml(
  meta: DrillSheetPreviewMeta,
  result: DrillSheetResult,
) {
  const settings = await getAppSettings();
  const logoDataUri = await getCompanyLogoDataUri();
  const company: CompanyProfile = {
    name: settings.companyName,
    address: settings.companyAddress,
    phone: settings.companyPhone,
    email: settings.companyEmail,
  };
  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="" />`
    : "";

  const planSvg = buildPlanSvg(result);
  const elevationSvg = buildElevationSvg(result, meta.insideDiameterFeet);

  const calcRows = [
    calcRow("Rim Elevation", feet(result.rimElevation)),
    calcRow("Low Invert", feet(result.lowInvertElevation), { underline: true }),
    calcRow("Invert to Top", feet(result.invertToTopFeet)),
    calcRow("Casting (-)", feet(result.castingHeightFeet)),
    calcRow("Top Slab (-)", feet(result.topSlabHeightFeet)),
    calcRow("Brick Adjustment (-)", feet(result.brickAdjustmentFeet)),
    calcRow("Sump (+)", feet(result.sumpFeet), { underline: true }),
    calcRow("Wall Height", feet(result.wallHeightFeet), { total: true }),
  ].join("");

  const MIN_PIPE_ROWS = 4;
  const openingRows: string[] = [];
  for (let i = 0; i < Math.max(result.openings.length, MIN_PIPE_ROWS); i += 1) {
    const opening = result.openings[i];
    const label = opening?.label?.trim() || String.fromCharCode(65 + i);
    if (opening) {
      openingRows.push(`
        <tr>
          <td class="letter">${escapeHtml(label)}</td>
          <td>${opening.invertElevation != null ? opening.invertElevation.toFixed(2) : ""}</td>
          <td>${opening.pipeDiameterInches != null ? `${opening.pipeDiameterInches}"` : ""}</td>
          <td>${escapeHtml(opening.pipeType?.trim() || "")}</td>
          <td>${opening.hasBoot ? "Yes" : "No"}</td>
        </tr>
      `);
    } else {
      openingRows.push(`
        <tr>
          <td class="letter">${escapeHtml(label)}</td>
          <td></td><td></td><td></td><td></td>
        </tr>
      `);
    }
  }

  const warningsHtml =
    result.warnings.length > 0
      ? `<div class="warnings"><ul>${result.warnings
          .map((warning) => `<li>${escapeHtml(warning)}</li>`)
          .join("")}</ul></div>`
      : "";

  const insideDiameterLabel =
    meta.insideDiameterFeet != null
      ? `${Math.round(meta.insideDiameterFeet)} 'Ø`
      : "—";
  const brickInches = `${Math.round(result.brickAdjustmentFeet * 12)}"`;

  const fieldList = [
    ["Contractor", meta.contractor],
    ["Project", meta.project],
    ["Date", meta.date],
    ["Manhole #", meta.manholeNumber],
    ["Casting", meta.castingName],
    ["Steps", meta.hasSteps ? "Yes" : "No"],
  ]
    .map(
      ([label, value]) =>
        `<div class="field"><span class="fl">${escapeHtml(label)}:</span> <span class="fv">${escapeHtml(value || "")}</span></div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(meta.manholeNumber || "Drill Sheet")} Drill Sheet</title>
    <style>
      @page { size: Letter portrait; margin: 0.5in; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 7.5in; }
      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #111827;
        background: #fff;
        font-size: 10px;
        line-height: 1.3;
      }
      /* Hand-entry data fields use a casual font (matches the reference
         drill sheet); headings/titles stay plain bold Arial. */
      .data-font {
        font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;
      }
      .sheet {
        border: 1px solid #111827;
        padding: 8px 10px;
        page-break-inside: avoid;
        break-inside: avoid;
        max-height: 10in;
        overflow: hidden;
      }
      .head { display: flex; justify-content: space-between; align-items: flex-start; }
      .brand { display: flex; align-items: flex-start; gap: 8px; flex-shrink: 0; }
      .logo { max-height: 80px; max-width: 200px; object-fit: contain; }
      .company-name { font-size: 17px; font-weight: 700; margin: 0; }
      .company-meta { font-size: 10px; color: #4b5563; margin: 1px 0 0; white-space: nowrap; }
      .approved { font-size: 14px; padding-top: 4px; white-space: nowrap; flex-shrink: 0; }
      .approved .ul {
        display: inline-block;
        width: 160px;
        border-bottom: 1px solid #111827;
        margin-left: 4px;
      }
      .fields { margin: 8px 0 6px; }
      .field { font-size: 14px; line-height: 1.5; }
      .field .fl { color: #111827; }
      .field .fv { font-weight: 400; }
      .circles { margin: 2px 0 4px; page-break-inside: avoid; break-inside: avoid; }
      .circles svg { display: block; width: 100%; height: auto; }
      .bottom {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .bottom-left { width: 46%; flex-shrink: 0; }
      .bottom-right { flex: 1; min-width: 0; }
      .bottom-right svg { display: block; width: 100%; height: auto; }
      table.calc { border-collapse: collapse; margin: 0 0 6px; width: 100%; }
      table.calc td { padding: 1px 3px; font-size: 14px; }
      table.calc td.lbl { text-align: right; }
      table.calc td.num {
        text-align: right;
        font-variant-numeric: tabular-nums;
        min-width: 56px;
      }
      table.calc tr.u td.num { border-bottom: 1px solid #111827; }
      table.calc tr.total td { font-weight: 700; padding-top: 3px; }
      .use-line { font-weight: 400; margin: 6px 0 2px; font-size: 14px; }
      .use-line span { margin-right: 10px; }
      .brick-line { margin: 2px 0 8px; font-size: 14px; }
      table.grid { border-collapse: collapse; width: 100%; }
      table.grid th, table.grid td {
        border: 1px solid #111827;
        padding: 3px 8px;
        text-align: center;
        font-size: 14px;
      }
      table.grid th { font-size: 11px; letter-spacing: 0.04em; }
      table.grid td.letter { font-weight: 700; }
      .warnings {
        border: 1px solid #f59e0b;
        background: #fffbeb;
        padding: 3px 6px;
        margin-top: 4px;
      }
      .warnings ul { margin: 0; padding-left: 14px; color: #92400e; font-size: 8px; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="head">
        <div class="brand">
          ${logoHtml}
          <div>
            ${logoDataUri ? "" : `<p class="company-name">${escapeHtml(company.name)}</p>`}
            <p class="company-meta">${escapeHtml(company.address)}</p>
            <p class="company-meta">${escapeHtml(company.phone)}</p>
          </div>
        </div>
        <div class="approved">Approved By:<span class="ul"></span></div>
      </div>

      <div class="fields data-font">${fieldList}</div>

      <div class="circles">${planSvg}</div>

      <div class="bottom">
        <div class="bottom-left data-font">
          <table class="calc">${calcRows}</table>
          <div class="use-line">
            <span>USE: ${escapeHtml(insideDiameterLabel)}</span>
            <span>Base: ${escapeHtml(baseHeightLabel(result))}</span>
            <span>Riser: ${escapeHtml(summarizeRisers(result))}</span>
          </div>
          <div class="brick-line">Brick Adjustment: ${escapeHtml(brickInches)}</div>
          <table class="grid">
            <thead>
              <tr>
                <th></th><th>INVERT</th><th>DIA</th><th>TYPE</th><th>BOOT</th>
              </tr>
            </thead>
            <tbody>${openingRows.join("")}</tbody>
          </table>
          ${warningsHtml}
        </div>
        <div class="bottom-right">
          ${elevationSvg || '<p class="company-meta">No sections selected.</p>'}
        </div>
      </div>
    </div>
  </body>
</html>`;
}
