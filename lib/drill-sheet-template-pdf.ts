import { PDFDocument, PDFTextField } from "pdf-lib";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import { angleToClockPosition } from "@/lib/drill-sheet-diagram";
import {
  type DrillSheetResult,
  formatFeetInches,
  getStructureElevations,
} from "@/lib/drill-sheet";

/** AcroForm field names expected in uploaded drill sheet PDF templates. */
export const DRILL_SHEET_TEMPLATE_FIELD_NAMES = [
  "contractor",
  "project",
  "date",
  "manhole_no",
  "casting",
  "inspection",
  "approved_by",
  "template_name",
  "diameter",
  "rim_elevation",
  "low_invert",
  "invert_to_top",
  "casting_minus",
  "top_slab_minus",
  "sump_plus",
  "brick_minus",
  "wall_height",
  "total_height",
  "key",
  "has_riser",
  "use_base",
  "use_riser",
  "casting_thickness_inches",
  "brick_thickness_inches",
  "top_slab_thickness_inches",
  "base_height_inches",
  "base_slab_thickness_inches",
  "bottom_casting_elevation",
  "top_of_top_slab_elevation",
  "bottom_of_top_slab_elevation",
  "top_of_bottom_slab_elevation",
  "bottom_of_bottom_slab_elevation",
  ...(["a", "b", "c", "d"] as const).flatMap((row) =>
    (
      [
        "invert",
        "dia",
        "type",
        "boot",
        "material",
        "hole",
        "base_to_bottom",
        "angle",
      ] as const
    ).map((suffix) => `${suffix}_${row}`),
  ),
] as const;

export type StructureTemplatePdfRow = {
  id: string;
  templateId: string;
  hasRiser: boolean;
  hasKey: boolean;
  filePath: string;
  originalName: string;
  fileSize: number | null;
};

export type TemplatePdfFieldCoverage = {
  pdfFields: string[];
  matched: string[];
  unmatched: string[];
  missingFromPdf: string[];
};

function decimalFeet(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "";
  }
  return (Math.round(value * 100) / 100).toFixed(2);
}

function inchesFromFeet(feet: number | null | undefined): string {
  if (feet == null || Number.isNaN(feet)) {
    return "";
  }
  const totalInches = Math.round(feet * 12 * 100) / 100;
  if (Number.isInteger(totalInches)) {
    return `${totalInches}"`;
  }
  return `${totalInches}"`;
}

function elevationFeet(
  result: DrillSheetResult,
  key: string,
): number | null {
  const entry = getStructureElevations(result).find(
    (elevation) => elevation.key === key,
  );
  return entry?.elevation ?? null;
}

function baseSectionHeightFeet(result: DrillSheetResult): number | null {
  const baseSections = result.sections.filter(
    (section) => section.role === "BASE",
  );
  if (baseSections.length === 0) {
    return null;
  }
  return baseSections.reduce((sum, section) => sum + section.heightFeet, 0);
}

function openingRowLabel(index: number): string {
  return String.fromCharCode("a".charCodeAt(0) + index);
}

export function templateVariantKey(hasRiser: boolean, hasKey: boolean): string {
  return `${hasRiser ? "riser" : "norisers"}-${hasKey ? "key" : "nokey"}`;
}

export function buildDrillSheetFieldMap(
  meta: DrillSheetPreviewMeta,
  result: DrillSheetResult,
): Record<string, string> {
  const hasRiser = result.sections.some((section) => section.role === "RISER");
  const map: Record<string, string> = {
    contractor: meta.contractor,
    project: meta.project,
    date: meta.date,
    manhole_no: meta.manholeNumber,
    casting: meta.castingName,
    inspection: meta.inspection,
    approved_by: meta.approvedBy,
    template_name: meta.templateName,
    diameter:
      meta.insideDiameterFeet != null
        ? formatFeetInches(meta.insideDiameterFeet)
        : "",
    rim_elevation: decimalFeet(result.rimElevation),
    low_invert: decimalFeet(result.lowInvertElevation),
    invert_to_top: decimalFeet(result.invertToTopFeet),
    casting_minus: decimalFeet(result.castingHeightFeet),
    top_slab_minus: decimalFeet(result.topSlabThicknessFeet),
    sump_plus: decimalFeet(result.sumpFeet),
    brick_minus: meta.brickAdjustment || decimalFeet(result.brickFeet),
    wall_height: decimalFeet(result.wallHeightFeet),
    total_height: decimalFeet(result.totalHeightFeet),
    key: result.hasKey ? "Yes" : "No",
    has_riser: hasRiser ? "Yes" : "No",
    use_base: meta.useBase,
    use_riser: meta.useRiser,
    casting_thickness_inches: inchesFromFeet(result.castingHeightFeet),
    brick_thickness_inches: inchesFromFeet(result.brickFeet),
    top_slab_thickness_inches: inchesFromFeet(result.topSlabThicknessFeet),
    base_height_inches: inchesFromFeet(baseSectionHeightFeet(result)),
    base_slab_thickness_inches: inchesFromFeet(result.baseSlabThicknessFeet),
    bottom_casting_elevation: decimalFeet(elevationFeet(result, "casting")),
    top_of_top_slab_elevation: decimalFeet(elevationFeet(result, "top-slab-top")),
    bottom_of_top_slab_elevation: decimalFeet(
      elevationFeet(result, "top-slab-bottom"),
    ),
    top_of_bottom_slab_elevation: decimalFeet(elevationFeet(result, "floor")),
    bottom_of_bottom_slab_elevation: decimalFeet(
      elevationFeet(result, "bottom-slab"),
    ),
  };

  result.openings.slice(0, 4).forEach((opening, index) => {
    const row = openingRowLabel(index);
    map[`invert_${row}`] = decimalFeet(opening.invertElevation);
    map[`dia_${row}`] =
      opening.pipeSizeInches != null ? `${opening.pipeSizeInches}"` : "";
    map[`type_${row}`] = opening.pipeType ?? "";
    map[`boot_${row}`] = opening.bootModel ?? "";
    map[`material_${row}`] = opening.pipeMaterial ?? "";
    map[`hole_${row}`] =
      opening.holeDiameterInches != null
        ? `${opening.holeDiameterInches}"`
        : "";
    map[`base_to_bottom_${row}`] =
      opening.baseTopToOpeningBottomInches != null
        ? `${opening.baseTopToOpeningBottomInches}"`
        : "";
    map[`angle_${row}`] =
      opening.angleDegrees != null
        ? angleToClockPosition(opening.angleDegrees)
        : "";
  });

  return map;
}

export function selectTemplateVariant(
  templatePdfs: StructureTemplatePdfRow[],
  result: DrillSheetResult,
): StructureTemplatePdfRow | null {
  if (templatePdfs.length === 0) {
    return null;
  }

  const hasRiser = result.sections.some((section) => section.role === "RISER");
  const hasKey = result.hasKey;

  const find = (riser: boolean, key: boolean) =>
    templatePdfs.find(
      (row) => row.hasRiser === riser && row.hasKey === key,
    ) ?? null;

  const exact = find(hasRiser, hasKey);
  if (exact) {
    return exact;
  }

  const sameKeyAnyRiser = find(!hasRiser, hasKey);
  if (sameKeyAnyRiser) {
    return sameKeyAnyRiser;
  }

  const sameRiserAnyKey = find(hasRiser, !hasKey);
  if (sameRiserAnyKey) {
    return sameRiserAnyKey;
  }

  if (templatePdfs.length === 1) {
    return templatePdfs[0]!;
  }

  return null;
}

export async function fillDrillSheetTemplatePdf(
  bytes: Uint8Array,
  fieldMap: Record<string, string>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) {
      continue;
    }

    const name = field.getName();
    const value = fieldMap[name];
    if (value == null || value === "") {
      continue;
    }

    field.setText(value);
  }

  return doc.save();
}

export async function listTemplatePdfFields(
  bytes: Uint8Array,
): Promise<TemplatePdfFieldCoverage> {
  const doc = await PDFDocument.load(bytes);
  const pdfFields = doc.getForm().getFields().map((field) => field.getName());
  const expected = new Set<string>(DRILL_SHEET_TEMPLATE_FIELD_NAMES);
  const pdfFieldSet = new Set(pdfFields);

  const matched = pdfFields.filter((name) => expected.has(name));
  const unmatched = pdfFields.filter((name) => !expected.has(name));
  const missingFromPdf = DRILL_SHEET_TEMPLATE_FIELD_NAMES.filter(
    (name) => !pdfFieldSet.has(name),
  );

  return { pdfFields, matched, unmatched, missingFromPdf };
}
