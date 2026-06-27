import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import {
  type DrillSheetResult,
  formatCurrency,
  formatFeetInches,
  getStructureElevations,
} from "@/lib/drill-sheet";
import { angleToClockPosition } from "@/lib/drill-sheet-diagram";
import { getAppSettings } from "@/lib/app-settings";
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

function buildHeaderHtml(
  company: {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
  },
  logoDataUri: string | null,
) {
  const logo = logoDataUri
    ? `<img src="${logoDataUri}" alt="" style="max-height:48px;max-width:160px;" />`
    : "";
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:2px solid #111827;padding-bottom:10px;">
      <div>${logo}<div style="font-size:14px;font-weight:700;margin-top:4px;">${escapeHtml(company.companyName)}</div>
      <div style="font-size:10px;color:#475569;">${escapeHtml(company.companyAddress)}</div>
      <div style="font-size:10px;color:#475569;">${escapeHtml(company.companyPhone)}</div></div>
      <div style="text-align:right;font-size:11px;">
        <div style="font-size:16px;font-weight:700;">DRILL SHEET</div>
        <div style="margin-top:4px;">Date: _______________</div>
      </div>
    </div>`;
}

function buildMetaTable(meta: DrillSheetPreviewMeta) {
  const rows = [
    ["Structure #", meta.manholeNumber || "—"],
    ["Template", meta.templateName || "—"],
    ["Contractor", meta.contractor || "—"],
    ["Project", meta.project || "—"],
    ["Date", meta.date || "—"],
    ["Casting", meta.castingName || "—"],
    [
      "Inside Diameter",
      meta.insideDiameterFeet != null
        ? formatFeetInches(meta.insideDiameterFeet)
        : "—",
    ],
    ["Steps", meta.hasSteps ? "Yes" : "No"],
  ];
  return `
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px;">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:3px 6px;border:1px solid #e2e8f0;background:#f8fafc;width:140px;font-weight:600;">${escapeHtml(label)}</td><td style="padding:3px 6px;border:1px solid #e2e8f0;">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}
    </table>`;
}

function buildCalcTable(result: DrillSheetResult) {
  const rows = [
    ["Rim Elevation", feet(result.rimElevation)],
    ["Low Invert", feet(result.lowInvertElevation)],
    ["Invert to Top", feet(result.invertToTopFeet)],
    ["Casting Height (-)", feet(result.castingHeightFeet)],
    ["Top Slab Thickness (-)", feet(result.topSlabThicknessFeet)],
    ["Sump (+)", feet(result.sumpFeet)],
    ["Brick (-)", feet(result.brickFeet)],
    [
      "Wall Height",
      `${formatFeetInches(result.wallHeightFeet)} (${feet(result.wallHeightFeet)})`,
    ],
    ["Total Height", feet(result.totalHeightFeet)],
    ["Key in Top Slab", result.hasKey ? "Yes" : "No"],
  ];
  return `
    <h3 style="font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">Height Calculation</h3>
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px;">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:3px 6px;border:1px solid #e2e8f0;background:#f8fafc;width:160px;">${escapeHtml(label)}</td><td style="padding:3px 6px;border:1px solid #e2e8f0;font-variant-numeric:tabular-nums;">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}
    </table>`;
}

function buildSectionsTable(result: DrillSheetResult) {
  if (result.sections.length === 0) {
    return `<p style="font-size:10px;color:#64748b;">No wall sections.</p>`;
  }
  return `
    <h3 style="font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">Precast Sections (Top Slab Separate)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:left;">Role</th>
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:right;">Height</th>
      </tr></thead>
      <tbody>
        ${result.sections
          .map(
            (section) =>
              `<tr><td style="padding:3px 6px;border:1px solid #e2e8f0;">${section.role === "BASE" ? "Base" : "Riser"}</td><td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums;">${formatFeetInches(section.heightFeet)}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function buildOpeningsTable(result: DrillSheetResult) {
  const header = `
    <tr style="background:#f8fafc;font-size:9px;">
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Op</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Material</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Size</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Type</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Invert</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Top Pipe</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Bot Open</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Top Open</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Base→Bot (in)</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Hole</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Boot</th>
      <th style="padding:4px 3px;border:1px solid #e2e8f0;">Angle</th>
    </tr>`;

  const body =
    result.openings.length === 0
      ? `<tr><td colspan="12" style="padding:8px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">No openings</td></tr>`
      : result.openings
          .map((opening, index) => {
            const angleDeg = opening.isLowInvert
              ? 0
              : (opening.angleDegrees ?? 0);
            const angleLabel = opening.isLowInvert
              ? "Up"
              : `${Math.round(angleDeg)}° (${angleToClockPosition(angleDeg)})`;
            return `<tr>
              <td style="padding:3px;border:1px solid #e2e8f0;font-weight:600;">${escapeHtml(opening.label || String.fromCharCode(65 + index))}${opening.isLowInvert ? "*" : ""}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;">${escapeHtml(opening.pipeMaterial ?? "—")}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;">${opening.pipeSizeInches ?? "—"}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;">${escapeHtml(opening.pipeType ?? "—")}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;font-variant-numeric:tabular-nums;">${feet(opening.invertElevation)}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;font-variant-numeric:tabular-nums;">${feet(opening.topOfPipeFeet)}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;font-variant-numeric:tabular-nums;">${feet(opening.bottomOfOpeningFeet)}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;font-variant-numeric:tabular-nums;">${feet(opening.topOfOpeningFeet)}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;font-variant-numeric:tabular-nums;font-weight:700;">${opening.baseTopToOpeningBottomInches ?? "—"}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;">${opening.holeDiameterInches ?? "—"}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;">${escapeHtml(opening.bootModel ?? "—")}</td>
              <td style="padding:3px;border:1px solid #e2e8f0;font-size:9px;">${escapeHtml(angleLabel)}</td>
            </tr>`;
          })
          .join("");

  return `
    <h3 style="font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">Pipe Openings</h3>
    <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:12px;">
      <thead>${header}</thead>
      <tbody>${body}</tbody>
    </table>
    <p style="font-size:9px;color:#64748b;">* = lowest invert (outlet). Base→Bot = distance from top of base slab to bottom of opening (nearest inch).</p>`;
}

function buildElevationsTable(result: DrillSheetResult) {
  const entries = getStructureElevations(result);
  if (entries.length === 0) {
    return "";
  }
  return `
    <h3 style="font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">Elevations (Top to Bottom)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:left;">Location</th>
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:right;">Elevation (ft)</th>
      </tr></thead>
      <tbody>
        ${entries
          .map(
            (entry) =>
              `<tr><td style="padding:3px 6px;border:1px solid #e2e8f0;">${escapeHtml(entry.label)}</td><td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${entry.elevation.toFixed(2)}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function buildQuoteBlock(result: DrillSheetResult) {
  return `
    <div style="margin-top:12px;border:2px solid #111827;padding:10px 12px;">
      <h3 style="font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Quote</h3>
      <table style="width:100%;font-size:11px;">
        <tr><td style="padding:4px 0;">Wall (${formatFeetInches(result.wallHeightFeet)})</td><td style="text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(result.wallPrice))}</td></tr>
        <tr><td style="padding:4px 0;">Boots (Kor-N-Seal)</td><td style="text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(result.bootsPrice))}</td></tr>
        <tr style="border-top:2px solid #111827;font-weight:700;font-size:13px;"><td style="padding:8px 0 0;">Total</td><td style="padding:8px 0 0;text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(result.totalPrice))}</td></tr>
      </table>
    </div>`;
}

function buildWarnings(result: DrillSheetResult) {
  const messages = [
    ...(result.errorMessage ? [result.errorMessage] : []),
    ...result.warnings,
  ];
  if (messages.length === 0) {
    return "";
  }
  return `
    <div style="margin-bottom:12px;padding:8px 10px;background:#fef3c7;border:1px solid #fcd34d;font-size:10px;">
      <strong>Notes:</strong>
      <ul style="margin:4px 0 0;padding-left:16px;">
        ${messages.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}
      </ul>
    </div>`;
}

export async function buildDrillSheetPdfHtml(
  meta: DrillSheetPreviewMeta,
  result: DrillSheetResult,
): Promise<string> {
  const settings = await getAppSettings();
  const logoDataUri = await getCompanyLogoDataUri();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; font-size: 11px; line-height: 1.35; }
    h3 { font-family: Arial, Helvetica, sans-serif; }
  </style>
</head>
<body>
  ${buildHeaderHtml(settings, logoDataUri)}
  ${buildWarnings(result)}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div>${buildMetaTable(meta)}</div>
    <div>${buildCalcTable(result)}</div>
  </div>
  ${buildElevationsTable(result)}
  ${buildSectionsTable(result)}
  ${buildOpeningsTable(result)}
  ${buildQuoteBlock(result)}
</body>
</html>`;
}
