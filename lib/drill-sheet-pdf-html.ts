import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import {
  type DrillSheetResult,
  formatCurrency,
  formatFeetInches,
  formatFeetInchesShort,
  getStructureDimensions,
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

const panelTitle =
  'class="panel-title" style="font-size:9px;font-weight:700;text-transform:uppercase;margin:0 0 4px;color:#475569;"';
const panelWrap = 'class="panel" style="border:1px solid #e2e8f0;padding:4px 6px;"';
const cellLabel =
  'style="padding:2px 4px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;"';
const cellValue = 'style="padding:2px 4px;border:1px solid #e2e8f0;"';
const thStyle =
  'style="padding:2px 4px;border:1px solid #e2e8f0;background:#f8fafc;text-align:left;font-size:8px;"';
const tdStyle = 'style="padding:2px 4px;border:1px solid #e2e8f0;font-size:8px;"';

function buildHeaderHtml(
  company: {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
  },
  logoDataUri: string | null,
) {
  const logo = logoDataUri
    ? `<img src="${logoDataUri}" alt="" style="max-height:40px;max-width:140px;" />`
    : "";
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:2px solid #111827;padding-bottom:6px;">
      <div>${logo}<div style="font-size:12px;font-weight:700;margin-top:2px;">${escapeHtml(company.companyName)}</div>
      <div style="font-size:9px;color:#475569;">${escapeHtml(company.companyAddress)}</div>
      <div style="font-size:9px;color:#475569;">${escapeHtml(company.companyPhone)}</div></div>
      <div style="text-align:right;font-size:10px;">
        <div style="font-size:14px;font-weight:700;">DRILL SHEET</div>
        <div style="margin-top:2px;">Date: _______________</div>
      </div>
    </div>`;
}

function buildMetaPanel(meta: DrillSheetPreviewMeta) {
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
    ["Inspection", meta.inspection || "—"],
    ["Approved By", meta.approvedBy || "—"],
    ["Use (Base)", meta.useBase || "—"],
    ["Use / Riser", meta.useRiser || "—"],
    ["Brick Adjustment", meta.brickAdjustment || "—"],
  ];
  return `
    <div ${panelWrap}>
      <h3 ${panelTitle}>Header</h3>
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td ${cellLabel}>${escapeHtml(label)}</td><td ${cellValue}>${escapeHtml(value)}</td></tr>`,
          )
          .join("")}
      </table>
    </div>`;
}

function buildCalcPanel(result: DrillSheetResult) {
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
    <div ${panelWrap}>
      <h3 ${panelTitle}>Height Calculation</h3>
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td ${cellLabel}>${escapeHtml(label)}</td><td ${cellValue} style="font-variant-numeric:tabular-nums;">${escapeHtml(value)}</td></tr>`,
          )
          .join("")}
      </table>
    </div>`;
}

function buildQuotePanel(result: DrillSheetResult) {
  return `
    <div ${panelWrap}>
      <h3 ${panelTitle}>Quote</h3>
      <table style="width:100%;font-size:9px;border-collapse:collapse;">
        <tr><td style="padding:2px 0;">Wall (${formatFeetInches(result.wallHeightFeet)})</td><td style="padding:2px 0;text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(result.wallPrice))}</td></tr>
        <tr><td style="padding:2px 0;">Boots (Kor-N-Seal)</td><td style="padding:2px 0;text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(result.bootsPrice))}</td></tr>
        <tr style="border-top:1px solid #111827;font-weight:700;"><td style="padding:4px 0 0;">Total</td><td style="padding:4px 0 0;text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(result.totalPrice))}</td></tr>
      </table>
    </div>`;
}

function buildSectionsPanel(result: DrillSheetResult) {
  const body =
    result.sections.length === 0
      ? `<p style="font-size:9px;color:#64748b;margin:0;">No wall sections.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-size:9px;">
          <thead><tr>
            <th ${thStyle}>Role</th>
            <th ${thStyle.replace("text-align:left", "text-align:right")}>Height</th>
          </tr></thead>
          <tbody>
            ${result.sections
              .map(
                (section) =>
                  `<tr><td ${tdStyle}>${section.role === "BASE" ? "Base" : "Riser"}</td><td ${tdStyle.replace("font-size:8px", "font-size:8px;text-align:right;font-variant-numeric:tabular-nums")}>${formatFeetInches(section.heightFeet)}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
        <p style="font-size:8px;color:#64748b;margin:4px 0 0;">Top slab is always separate.</p>`;

  return `
    <div ${panelWrap}>
      <h3 ${panelTitle}>Precast Sections</h3>
      ${body}
    </div>`;
}

function buildOpeningsTable(result: DrillSheetResult) {
  const header = `
    <tr style="background:#f8fafc;font-size:8px;">
      <th ${thStyle}>Op</th>
      <th ${thStyle}>Material</th>
      <th ${thStyle}>Size</th>
      <th ${thStyle}>Type</th>
      <th ${thStyle}>Invert</th>
      <th ${thStyle}>Top Pipe</th>
      <th ${thStyle}>Bot Open</th>
      <th ${thStyle}>Top Open</th>
      <th ${thStyle}>Base→Bot (in)</th>
      <th ${thStyle}>Hole</th>
      <th ${thStyle}>Boot</th>
      <th ${thStyle}>Angle</th>
    </tr>`;

  const body =
    result.openings.length === 0
      ? `<tr><td colspan="12" ${tdStyle} style="text-align:center;color:#64748b;">No openings</td></tr>`
      : result.openings
          .map((opening, index) => {
            const angleDeg = opening.isLowInvert
              ? 0
              : (opening.angleDegrees ?? 0);
            const angleLabel = opening.isLowInvert
              ? "Up"
              : `${Math.round(angleDeg)}° (${angleToClockPosition(angleDeg)})`;
            return `<tr>
              <td ${tdStyle} style="font-weight:600;">${escapeHtml(opening.label || String.fromCharCode(65 + index))}${opening.isLowInvert ? "*" : ""}</td>
              <td ${tdStyle}>${escapeHtml(opening.pipeMaterial ?? "—")}</td>
              <td ${tdStyle}>${opening.pipeSizeInches ?? "—"}</td>
              <td ${tdStyle}>${escapeHtml(opening.pipeType ?? "—")}</td>
              <td ${tdStyle} style="font-variant-numeric:tabular-nums;">${feet(opening.invertElevation)}</td>
              <td ${tdStyle} style="font-variant-numeric:tabular-nums;">${feet(opening.topOfPipeFeet)}</td>
              <td ${tdStyle} style="font-variant-numeric:tabular-nums;">${feet(opening.bottomOfOpeningFeet)}</td>
              <td ${tdStyle} style="font-variant-numeric:tabular-nums;">${feet(opening.topOfOpeningFeet)}</td>
              <td ${tdStyle} style="font-variant-numeric:tabular-nums;font-weight:700;">${opening.baseTopToOpeningBottomInches ?? "—"}</td>
              <td ${tdStyle}>${opening.holeDiameterInches ?? "—"}</td>
              <td ${tdStyle}>${escapeHtml(opening.bootModel ?? "—")}</td>
              <td ${tdStyle} style="font-size:8px;">${escapeHtml(angleLabel)}</td>
            </tr>`;
          })
          .join("");

  return `
    <div style="margin-top:8px;">
      <h3 ${panelTitle}>Pipe Openings</h3>
      <table style="width:100%;border-collapse:collapse;font-size:8px;">
        <thead>${header}</thead>
        <tbody>${body}</tbody>
      </table>
      <p style="font-size:8px;color:#64748b;margin:4px 0 0;">* = lowest invert (outlet). Base→Bot = distance from top of bottom slab to bottom of opening (nearest inch).</p>
    </div>`;
}

function buildElevationsPanel(result: DrillSheetResult) {
  const entries = getStructureElevations(result);
  if (entries.length === 0) {
    return "";
  }
  return `
    <div ${panelWrap}>
      <h3 ${panelTitle}>Elevations (Top to Bottom)</h3>
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead><tr>
          <th ${thStyle}>Location</th>
          <th ${thStyle.replace("text-align:left", "text-align:right")}>Elevation (ft)</th>
        </tr></thead>
        <tbody>
          ${entries
            .map(
              (entry) =>
                `<tr><td ${tdStyle}>${escapeHtml(entry.label)}</td><td ${tdStyle} style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${entry.elevation.toFixed(2)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function buildDimensionsPanel(result: DrillSheetResult) {
  const entries = getStructureDimensions(result);
  if (entries.length === 0) {
    return "";
  }
  return `
    <div ${panelWrap}>
      <h3 ${panelTitle}>Dimensions (Top to Bottom)</h3>
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead><tr>
          <th ${thStyle}>Component</th>
          <th ${thStyle.replace("text-align:left", "text-align:right")}>Dimension</th>
        </tr></thead>
        <tbody>
          ${entries
            .map(
              (entry) =>
                `<tr><td ${tdStyle}>${escapeHtml(entry.label)}</td><td ${tdStyle} style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${escapeHtml(formatFeetInchesShort(entry.feet))}</td></tr>`,
            )
            .join("")}
        </tbody>
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
    <div style="margin-bottom:8px;padding:6px 8px;background:#fef3c7;border:1px solid #fcd34d;font-size:9px;">
      <strong>Notes:</strong>
      <ul style="margin:2px 0 0;padding-left:14px;">
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

  const elevationsPanel = buildElevationsPanel(result);
  const dimensionsPanel = buildDimensionsPanel(result);
  const row2Panels = [elevationsPanel, dimensionsPanel].filter(Boolean);
  const row2 =
    row2Panels.length > 0
      ? `<div class="${row2Panels.length > 1 ? "grid-2" : ""}" style="margin-top:8px;">
          ${row2Panels.join("")}
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: letter; margin: 0.4in; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; font-size: 10px; line-height: 1.2; }
    h3 { font-family: Arial, Helvetica, sans-serif; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  </style>
</head>
<body>
  ${buildHeaderHtml(settings, logoDataUri)}
  ${buildWarnings(result)}
  <div class="grid-3">
    ${buildMetaPanel(meta)}
    ${buildCalcPanel(result)}
    ${buildQuotePanel(result)}
  </div>
  ${row2}
  <div style="margin-top:8px;">
    ${buildSectionsPanel(result)}
  </div>
  ${buildOpeningsTable(result)}
</body>
</html>`;
}
