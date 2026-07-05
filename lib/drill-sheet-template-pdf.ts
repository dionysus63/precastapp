import {
  AnnotationFlags,
  LineCapStyle,
  PDFDict,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFPage,
  PDFString,
  PDFTextField,
  TextAlignment,
  defaultTextFieldAppearanceProvider,
  drawTextField,
  layoutSinglelineText,
  rgb,
  StandardFonts,
} from "pdf-lib";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import { angleToClockPosition } from "@/lib/drill-sheet-diagram";
import {
  type ComputedOpening,
  type DrillSheetResult,
  formatFeetInches,
  formatPipeDescription,
  getStructureElevations,
} from "@/lib/drill-sheet";

/** AcroForm marker field drawn over the base-section plan circle bounding box. */
export const PLAN_CIRCLE_MARKER_FIELD = "plan_circle";
/** AcroForm marker field drawn over the riser plan circle bounding box. */
export const RISER_CIRCLE_MARKER_FIELD = "riser_circle";
/**
 * AcroForm marker field over the cross-section wall cavity: left/right edges
 * on the inner wall faces, top at the bottom of the top slab, bottom at the
 * floor (top of bottom slab). The app draws section joints inside it.
 */
export const SECTION_STACK_MARKER_FIELD = "section_stack";

// Penetration-arrow geometry (PDF points), measured from the outlet arrow's
// vector line work in the AutoCAD template (drawn on a circle of radius
// 87 pt with a 13.5 pt wall band) so generated arrows are indistinguishable
// from it. The template outlet arrow points outward (up): a 0.3 pt shaft
// running from 27.9 pt past the inner circle to 27.9 pt past the outer
// circle, a solid triangular head 7.6 pt long by 10.6 pt wide with 0.3 pt
// stroked edges at the tip, and the opening letter (~15 pt) inside a
// stroked 8 pt-radius circle centered 13.5 pt outside the wall and 17.8 pt
// to the right of the shaft. Where the shaft crosses the wall, an X glyph
// spans the band: two lines parallel to the shaft offset +/-13.9 pt with
// diagonals joining opposite corners. Penetration arrows are that arrow
// rotated to point inward: tail 27.9 pt outside the outer circle, tip
// 27.9 pt inside the inner circle pointing at the center, letter badge
// outside beside the shaft. All lengths scale with the plan_circle marker
// radius.
const REFERENCE_RADIUS_PT = 87;
const WALL_BAND_PT = 13.5;
const ARROW_OVERSHOOT_PT = 27.9;
const ARROW_SHAFT_WIDTH_PT = 0.8;
const ARROW_HEAD_LENGTH_PT = 7.6;
const ARROW_HEAD_HALF_WIDTH_PT = 5.3;
const ARROW_HEAD_EDGE_WIDTH_PT = 0.3;
// X boot glyph, measured: side lines at +/-13.9 pt from the shaft, spanning
// radius offsets -15.2 to -1.1 from the outer circle, ~0.5 pt strokes.
const GLYPH_HALF_WIDTH_PT = 13.9;
const GLYPH_INNER_OFFSET_PT = 15.2;
const GLYPH_OUTER_OFFSET_PT = 1.1;
const GLYPH_STROKE_WIDTH_PT = 0.8;
const BADGE_RADIUS_PT = 8;
const BADGE_RADIAL_OUTSIDE_PT = 13.5;
const BADGE_TANGENT_OFFSET_PT = 17.8;
const BADGE_BORDER_WIDTH_PT = 0.3;
const BADGE_FONT_SIZE_PT = 15;

// Section-stack joint geometry, measured from the AutoCAD example sheets
// (cavity 105.8 pt wide, wall band 11 pt). A KEYED joint steps up through
// the wall band — horizontal from the outer face ~45% across, a diagonal
// rising ~10 pt, then horizontal to the inner face ("bottom piece sticks up
// on the inside") — plus a line across the cavity at the top of the key. An
// UNKEYED joint is a flat butt seam through the wall bands only. The bottom
// of the top slab is drawn the same way (flat full-width line when there is
// no top-slab key). Lengths scale with the marker width.
const STACK_REF_CAVITY_WIDTH_PT = 105.8;
const STACK_WALL_BAND_PT = 11;
const STACK_SEAM_RISE_PT = 10;
const STACK_SEAM_OUTER_RUN = 0.45;
const STACK_SEAM_DIAGONAL_RUN = 0.15;
const STACK_LINE_WIDTH_PT = 0.5;
/** Font size for all app-generated cross-section diagram text (labels + elevations). */
const DIAGRAM_TEXT_FONT_SIZE_PT = 8.5;
// Static dimension/elevation line work measured from the T3 template: the
// left dimension rail is a full-height line 25.7 pt left of the cavity with
// 45-degree slash ticks; right-side elevations are short horizontal leaders
// just right of the outer wall face with the value printed after them.
const STACK_RAIL_FROM_CAVITY_PT = 25.7;
const STACK_TICK_HALF_PT = 2.45;
/** Extension lines run from just left of the rail to near the outer wall. */
const STACK_EXT_HALF_PT = 4.3;
const STACK_EXT_WALL_GAP_PT = 3.5;
const STACK_LABEL_GAP_PT = 4.3;
/** Drawn top-slab band height in the static artwork (shell top - cavity top). */
const STACK_SLAB_BAND_PT = 17.6;
// Fallback rail-tick offsets above the cavity top when elevation marker fields
// are missing from a template variant.
const STACK_SHELL_TOP_TICK_PT = 16.6;
const STACK_CASTING_BOTTOM_TICK_PT = 26.1;
const STACK_CASTING_TOP_TICK_PT = 34.9;
/** All filled form fields inside the cross-section diagram print at this size. */
const DIAGRAM_FIELD_FONT_SIZE_PT = DIAGRAM_TEXT_FONT_SIZE_PT;
const ELEV_LEADER_GAP_PT = 1.8;
const ELEV_LEADER_LEN_PT = 7.2;
const ELEV_TEXT_GAP_PT = 1.7;
const ELEV_FONT_SIZE_PT = DIAGRAM_TEXT_FONT_SIZE_PT;
const NO_KEY_NOTE_FONT_SIZE_PT = 14;
/** Note sits high above the riser circle, level with the header block. */
const NO_KEY_NOTE_ABOVE_CIRCLE_PT = 130;
/** Half of Helvetica's cap height, used to vertically center badge letters. */
const HALF_CAP_HEIGHT_RATIO = 0.36;
// Hole-size callout next to each arrow: `12"Ø` over `@+5"`, center-aligned,
// placed on the opposite tangent side of the shaft from the letter badge so
// it never collides with it. The low-invert (outlet) callout is a single
// line centered above the template's up arrow instead.
const CALLOUT_FONT_SIZE_PT = 11;
const CALLOUT_LINE_GAP_PT = 3;
const CALLOUT_RADIAL_OUTSIDE_PT = 20;
const CALLOUT_TANGENT_OFFSET_PT = 27;
const CALLOUT_ABOVE_TIP_GAP_PT = 4;
// White background mask behind callout text (AutoCAD-style text mask) so the
// template's knockout spokes visually break behind the text.
const CALLOUT_MASK_PADDING_PT = 2;

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
  "brick_adjustment_inches",
  "top_slab_thickness_inches",
  "base_height_inches",
  "base_height_feet_and_inches",
  "total_riser_height_inches",
  "total_riser_height_feet_and_inches",
  "base_slab_thickness_inches",
  "diameter_feet_only",
  "top_slab_opening_inches",
  "bottom_casting_elevation",
  "top_of_top_slab_elevation",
  "bottom_of_top_slab_elevation",
  "top_of_bottom_slab_elevation",
  "bottom_of_bottom_slab_elevation",
  PLAN_CIRCLE_MARKER_FIELD,
  RISER_CIRCLE_MARKER_FIELD,
  SECTION_STACK_MARKER_FIELD,
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

/** formatFeetInches, but blank (not an em dash) for missing values. */
function feetInchesOrBlank(feet: number | null | undefined): string {
  if (feet == null || Number.isNaN(feet)) {
    return "";
  }
  return formatFeetInches(feet);
}

/** Inches rounded to the nearest whole number, e.g. 0.33 ft -> `4"`. */
function wholeInchesFromFeet(feet: number | null | undefined): string {
  if (feet == null || Number.isNaN(feet)) {
    return "";
  }
  return `${Math.round(feet * 12)}"`;
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

function totalRiserHeightFeet(result: DrillSheetResult): number | null {
  const risers = result.sections.filter(
    (section) => section.role === "RISER",
  );
  if (risers.length === 0) {
    return null;
  }
  return risers.reduce((sum, section) => sum + section.heightFeet, 0);
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
    brick_minus: decimalFeet(result.brickFeet) || meta.brickAdjustment,
    wall_height: decimalFeet(result.wallHeightFeet),
    total_height: decimalFeet(result.totalHeightFeet),
    key: result.hasKey ? "Yes" : "No",
    has_riser: hasRiser ? "Yes" : "No",
    use_base: meta.useBase,
    use_riser: meta.useRiser,
    // Diagram dimension column: whole inches to match the drawn artwork.
    casting_thickness_inches: wholeInchesFromFeet(result.castingHeightFeet),
    brick_thickness_inches: wholeInchesFromFeet(result.brickFeet),
    // Bare number; the template prints the inch mark after the box.
    brick_adjustment_inches: (
      meta.brickAdjustment || inchesFromFeet(result.brickFeet)
    ).replace(/"/g, ""),
    // Alias for the "Use: __'Ø" blank on templates that kept the old name.
    "Manhole Diameter":
      meta.insideDiameterFeet != null ? String(meta.insideDiameterFeet) : "",
    top_slab_thickness_inches: inchesFromFeet(result.topSlabThicknessFeet),
    base_height_inches: inchesFromFeet(baseSectionHeightFeet(result)),
    // Feet-and-inches variants for templates whose blanks print e.g. 4'-0".
    base_height_feet_and_inches: feetInchesOrBlank(baseSectionHeightFeet(result)),
    total_riser_height_inches: inchesFromFeet(totalRiserHeightFeet(result)),
    total_riser_height_feet_and_inches: feetInchesOrBlank(
      totalRiserHeightFeet(result),
    ),
    // Bare feet number for the "Use: __'Ø" blank (template prints the 'Ø).
    diameter_feet_only:
      meta.insideDiameterFeet != null ? String(meta.insideDiameterFeet) : "",
    // Clear opening of the casting frame, printed on the top slab band.
    top_slab_opening_inches:
      meta.castingClearOpeningInches != null
        ? `${Number(meta.castingClearOpeningInches)}"`
        : "",
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
    map[`type_${row}`] = formatPipeDescription(
      opening.pipeMaterial,
      opening.pipeType,
    );
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

type PlanCircleLayout = {
  center: { x: number; y: number };
  radius: number;
  page: PDFPage;
};

/** Outward radial unit vector for a clockwise-from-up angle in PDF coordinates. */
function outwardRadialUnit(angleDeg: number): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: Math.sin(radians), y: Math.cos(radians) };
}

function getWidgetPage(
  doc: PDFDocument,
  widget: { P: () => unknown },
): PDFPage | null {
  const pageRef = widget.P();
  if (!pageRef) {
    return null;
  }
  return doc.getPages().find((page) => page.ref === pageRef) ?? null;
}

type MarkerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  page: PDFPage;
};

/** Reads a marker field's rectangle, then removes/hides the field. */
async function consumeMarkerField(
  form: ReturnType<PDFDocument["getForm"]>,
  doc: PDFDocument,
  fieldName: string,
): Promise<MarkerRect | null> {
  let markerField: PDFTextField;
  try {
    markerField = form.getTextField(fieldName);
  } catch {
    return null;
  }

  const widgets = markerField.acroField.getWidgets();
  const widget = widgets[0] ?? null;
  const rect = widget?.getRectangle() ?? null;
  const page = widget ? (getWidgetPage(doc, widget) ?? doc.getPage(0)) : null;

  // Fields authored in AutoCAD/Bluebeam often lack appearance streams, and
  // pdf-lib's removeField throws ("Unexpected N type: undefined") resolving
  // them. Generate default appearances first so removal succeeds; if removal
  // still fails, hide the widgets so the marker never renders.
  try {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    markerField.defaultUpdateAppearances(font);
    form.removeField(markerField);
  } catch {
    markerField.enableReadOnly();
    for (const w of markerField.acroField.getWidgets()) {
      w.setFlagTo(AnnotationFlags.Hidden, true);
    }
  }

  if (!widget || !rect || !page || rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, page };
}

async function readCircleMarker(
  form: ReturnType<PDFDocument["getForm"]>,
  doc: PDFDocument,
  fieldName: string,
): Promise<PlanCircleLayout | null> {
  const rect = await consumeMarkerField(form, doc, fieldName);
  if (!rect) {
    return null;
  }
  return {
    center: {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    },
    radius: Math.min(rect.width, rect.height) / 2,
    page: rect.page,
  };
}

function drawInwardPenetrationArrow(
  page: PDFPage,
  layout: PlanCircleLayout,
  angleDeg: number,
  label: string,
  font: PDFFont,
): void {
  const radial = outwardRadialUnit(angleDeg);
  const { center, radius } = layout;
  const scale = radius / REFERENCE_RADIUS_PT;
  const black = rgb(0, 0, 0);

  const at = (radialDistance: number) => ({
    x: center.x + radial.x * radialDistance,
    y: center.y + radial.y * radialDistance,
  });
  // Tangent pointing to the same side of the shaft as the template badge
  // (to the right of the arrow when it points up).
  const tangent = { x: radial.y, y: -radial.x };

  // Tail overshoots the outer circle; tip overshoots the inner circle by
  // the same amount (mirror of the template's outward-pointing outlet).
  const tail = at(radius + ARROW_OVERSHOOT_PT * scale);
  const tipRadial = radius - (WALL_BAND_PT + ARROW_OVERSHOOT_PT) * scale;
  const tip = at(tipRadial);

  page.drawLine({
    start: tail,
    end: tip,
    thickness: ARROW_SHAFT_WIDTH_PT * scale,
    lineCap: LineCapStyle.Round,
    color: black,
  });

  // X boot glyph straddling the wall band: two side lines parallel to the
  // shaft plus diagonals joining opposite corners.
  const glyphHalf = GLYPH_HALF_WIDTH_PT * scale;
  const glyphInner = radius - GLYPH_INNER_OFFSET_PT * scale;
  const glyphOuter = radius - GLYPH_OUTER_OFFSET_PT * scale;
  const corner = (radialDistance: number, side: number) => {
    const base = at(radialDistance);
    return {
      x: base.x + tangent.x * glyphHalf * side,
      y: base.y + tangent.y * glyphHalf * side,
    };
  };
  const glyphLines: [{ x: number; y: number }, { x: number; y: number }][] = [
    [corner(glyphInner, -1), corner(glyphOuter, -1)],
    [corner(glyphInner, 1), corner(glyphOuter, 1)],
    [corner(glyphInner, -1), corner(glyphOuter, 1)],
    [corner(glyphInner, 1), corner(glyphOuter, -1)],
  ];
  for (const [start, end] of glyphLines) {
    page.drawLine({
      start,
      end,
      thickness: GLYPH_STROKE_WIDTH_PT * scale,
      lineCap: LineCapStyle.Round,
      color: black,
    });
  }

  // Solid triangular head with stroked edges, apex at the tip, pointing
  // inward. Base sits back toward the wall along the shaft.
  const headHalf = ARROW_HEAD_HALF_WIDTH_PT * scale;
  const headBase = at(tipRadial + ARROW_HEAD_LENGTH_PT * scale);
  const headLeft = {
    x: headBase.x + tangent.x * headHalf,
    y: headBase.y + tangent.y * headHalf,
  };
  const headRight = {
    x: headBase.x - tangent.x * headHalf,
    y: headBase.y - tangent.y * headHalf,
  };

  // drawSvgPath flips the y-axis (SVG is y-down); negate y so the head lands
  // at the intended page coordinates.
  page.drawSvgPath(
    `M ${tip.x} ${-tip.y} L ${headLeft.x} ${-headLeft.y} L ${headRight.x} ${-headRight.y} Z`,
    {
      x: 0,
      y: 0,
      color: black,
      borderColor: black,
      borderWidth: ARROW_HEAD_EDGE_WIDTH_PT * scale,
    },
  );

  // Lettered circle badge beside the shaft, outside the wall — same layout
  // as the template's outlet "A" badge.
  const badgeAnchor = at(radius + BADGE_RADIAL_OUTSIDE_PT * scale);
  const badge = {
    x: badgeAnchor.x + tangent.x * BADGE_TANGENT_OFFSET_PT * scale,
    y: badgeAnchor.y + tangent.y * BADGE_TANGENT_OFFSET_PT * scale,
  };

  page.drawCircle({
    x: badge.x,
    y: badge.y,
    size: BADGE_RADIUS_PT * scale,
    borderWidth: BADGE_BORDER_WIDTH_PT * scale,
    borderColor: black,
  });

  const fontSize = BADGE_FONT_SIZE_PT * scale;
  const labelWidth = font.widthOfTextAtSize(label, fontSize);
  page.drawText(label, {
    x: badge.x - labelWidth / 2,
    y: badge.y - fontSize * HALF_CAP_HEIGHT_RATIO,
    size: fontSize,
    font,
    color: black,
  });
}

function formatCalloutInches(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Builds the `12"Ø` and `@ +5"` callout lines for an opening. The rise is
 * measured from the bottom of the section the hole penetrates (the drilling
 * offset); a hole sitting on the section bottom reads `@ Bottom`.
 */
function getCalloutLines(opening: ComputedOpening): string[] {
  const lines: string[] = [];
  if (opening.holeDiameterInches != null) {
    lines.push(`${formatCalloutInches(opening.holeDiameterInches)}"\u00d8`);
  }
  const rise =
    opening.sectionBottomToOpeningBottomInches ??
    opening.baseTopToOpeningBottomInches;
  if (rise != null) {
    lines.push(
      rise <= 0 ? "@ Bottom" : `@ +${formatCalloutInches(rise)}"`,
    );
  }
  return lines;
}

/**
 * Hole-size callout beside a penetration arrow: two lines centered on each
 * other, on the opposite tangent side of the shaft from the letter badge.
 */
function drawPenetrationCallout(
  page: PDFPage,
  layout: PlanCircleLayout,
  angleDeg: number,
  lines: string[],
  font: PDFFont,
): void {
  if (lines.length === 0) {
    return;
  }
  const radial = outwardRadialUnit(angleDeg);
  const tangent = { x: radial.y, y: -radial.x };
  const { center, radius } = layout;
  const scale = radius / REFERENCE_RADIUS_PT;
  const fontSize = CALLOUT_FONT_SIZE_PT * scale;
  const lineHeight = fontSize * (2 * HALF_CAP_HEIGHT_RATIO) + CALLOUT_LINE_GAP_PT * scale;

  const anchorRadial = radius + CALLOUT_RADIAL_OUTSIDE_PT * scale;
  const blockCenter = {
    x:
      center.x +
      radial.x * anchorRadial -
      tangent.x * CALLOUT_TANGENT_OFFSET_PT * scale,
    y:
      center.y +
      radial.y * anchorRadial -
      tangent.y * CALLOUT_TANGENT_OFFSET_PT * scale,
  };

  const blockHeight = lineHeight * (lines.length - 1);
  const baselineY = (index: number) =>
    blockCenter.y +
    blockHeight / 2 -
    lineHeight * index -
    fontSize * HALF_CAP_HEIGHT_RATIO;

  const maxWidth = Math.max(
    ...lines.map((line) => font.widthOfTextAtSize(line, fontSize)),
  );
  drawCalloutMask(page, {
    left: blockCenter.x - maxWidth / 2,
    right: blockCenter.x + maxWidth / 2,
    top: baselineY(0) + fontSize * 0.75,
    bottom: baselineY(lines.length - 1) - fontSize * 0.25,
    padding: CALLOUT_MASK_PADDING_PT * scale,
  });

  lines.forEach((line, index) => {
    const width = font.widthOfTextAtSize(line, fontSize);
    page.drawText(line, {
      x: blockCenter.x - width / 2,
      y: baselineY(index),
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

/** Draws the white AutoCAD-style background mask behind callout text. */
function drawCalloutMask(
  page: PDFPage,
  box: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    padding: number;
  },
): void {
  page.drawRectangle({
    x: box.left - box.padding,
    y: box.bottom - box.padding,
    width: box.right - box.left + box.padding * 2,
    height: box.top - box.bottom + box.padding * 2,
    color: rgb(1, 1, 1),
  });
}

/**
 * Single-line callout for the low-invert outlet, centered on the circle's
 * vertical axis just above the template's up arrow.
 */
function drawOutletCallout(
  page: PDFPage,
  layout: PlanCircleLayout,
  lines: string[],
  font: PDFFont,
): void {
  if (lines.length === 0) {
    return;
  }
  const { center, radius } = layout;
  const scale = radius / REFERENCE_RADIUS_PT;
  const fontSize = CALLOUT_FONT_SIZE_PT * scale;
  const text = lines.join(" ");
  const width = font.widthOfTextAtSize(text, fontSize);
  const tipY = center.y + radius + ARROW_OVERSHOOT_PT * scale;
  const baselineY = tipY + CALLOUT_ABOVE_TIP_GAP_PT * scale;

  drawCalloutMask(page, {
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: baselineY + fontSize * 0.75,
    bottom: baselineY - fontSize * 0.25,
    padding: CALLOUT_MASK_PADDING_PT * scale,
  });

  page.drawText(text, {
    x: center.x - width / 2,
    y: baselineY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });
}

async function drawPenetrationArrows(
  doc: PDFDocument,
  planCircle: PlanCircleLayout | null,
  riserCircle: PlanCircleLayout | null,
  openings: ComputedOpening[],
): Promise<void> {
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const [index, opening] of openings.entries()) {
    // Each opening is drawn on the circle of the section its hole
    // penetrates; falls back to the base circle when unknown.
    const layout =
      (opening.containingSectionRole === "RISER" ? riserCircle : null) ??
      planCircle;
    if (!layout) {
      continue;
    }

    const lines = getCalloutLines(opening);

    if (opening.isLowInvert) {
      drawOutletCallout(layout.page, layout, lines, font);
      continue;
    }
    if (opening.angleDegrees == null) {
      continue;
    }

    const label = opening.label?.trim() || String.fromCharCode(65 + index);
    drawInwardPenetrationArrow(
      layout.page,
      layout,
      opening.angleDegrees,
      label,
      font,
    );
    drawPenetrationCallout(
      layout.page,
      layout,
      opening.angleDegrees,
      lines,
      font,
    );
  }
}

/**
 * Draws the section joints inside the cross-section wall cavity. The marker
 * rect maps the cavity: bottom = floor, top = bottom of top slab, sides on
 * the inner wall faces. Keyed joints get the stepped seam plus the
 * top-of-key line across the cavity; unkeyed joints are flat. Also draws
 * the bottom-of-top-slab line (left off the template artwork), the left
 * dimension rail with slash ticks and section-height labels, and the right
 * elevation rail connecting the static top/bottom elevation ticks.
 */
function drawSectionStack(
  marker: MarkerRect,
  result: DrillSheetResult,
  font: PDFFont,
): void {
  const sections = result.sections;
  if (sections.length === 0 || result.wallHeightFeet <= 0) {
    return;
  }

  const { page } = marker;
  const black = rgb(0, 0, 0);
  const scale = marker.width / STACK_REF_CAVITY_WIDTH_PT;
  const wallBand = STACK_WALL_BAND_PT * scale;
  const rise = STACK_SEAM_RISE_PT * scale;
  const thickness = STACK_LINE_WIDTH_PT * scale;

  const innerLeft = marker.x;
  const innerRight = marker.x + marker.width;
  const outerLeft = innerLeft - wallBand;
  const outerRight = innerRight + wallBand;
  const cavityTop = marker.y + marker.height;

  // The marker's top edge is the BOTTOM OF THE TOP SLAB, i.e. the top of the
  // key when the top joint is keyed. The outside-measured wall therefore
  // spans floor to one key-rise below it; scale section bands to that span
  // so the top section isn't shortchanged by the key.
  const topKeyed = sections[sections.length - 1]?.hasTopKey ?? false;
  const topJointY = topKeyed ? cavityTop - rise : cavityTop;
  const feetToPt = (topJointY - marker.y) / result.wallHeightFeet;

  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) =>
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color: black,
    });

  /**
   * Stepped key seam through one wall band. `jointY` is the outside joint
   * plane (bottom of key); the seam rises from it toward the inside.
   */
  const drawKeySeam = (jointY: number, mirror: boolean) => {
    const outerX = mirror ? outerRight : outerLeft;
    const innerX = mirror ? innerRight : innerLeft;
    const dir = mirror ? -1 : 1;
    const run = wallBand;
    const x1 = outerX + dir * run * STACK_SEAM_OUTER_RUN;
    const x2 = x1 + dir * run * STACK_SEAM_DIAGONAL_RUN;
    line(outerX, jointY, x1, jointY);
    line(x1, jointY, x2, jointY + rise);
    line(x2, jointY + rise, innerX, jointY + rise);
  };

  /**
   * One joint at its outside plane: keyed = stepped seams rising from the
   * plane + top-of-key line across the cavity; unkeyed = flat butt seam.
   */
  const drawJoint = (jointY: number, keyed: boolean) => {
    if (keyed) {
      drawKeySeam(jointY, false);
      drawKeySeam(jointY, true);
      line(innerLeft, jointY + rise, innerRight, jointY + rise);
    } else {
      line(outerLeft, jointY, innerLeft, jointY);
      line(innerRight, jointY, outerRight, jointY);
    }
  };

  // The vertical dimension rail (left) and the elevation labels' column
  // (right) are part of the static template artwork — the app only adds
  // slash ticks, height labels, joint seams, and joint elevation leaders.
  const railLeftX = innerLeft - STACK_RAIL_FROM_CAVITY_PT * scale;
  const tickHalf = STACK_TICK_HALF_PT * scale;
  const slashTick = (y: number) => {
    line(railLeftX - tickHalf, y - tickHalf, railLeftX + tickHalf, y + tickHalf);
    // Extension line from just left of the rail to near the outer wall,
    // matching the template's static band boundary lines.
    line(
      railLeftX - STACK_EXT_HALF_PT * scale,
      y,
      outerLeft - STACK_EXT_WALL_GAP_PT * scale,
      y,
    );
  };

  // Floor elevation drives the joint elevation callouts on the right.
  const floorElevation =
    getStructureElevations(result).find((entry) => entry.key === "floor")
      ?.elevation ?? null;

  const drawJointElevation = (y: number, cumulativeFeet: number) => {
    if (floorElevation == null) {
      return;
    }
    const leaderStart = outerRight + ELEV_LEADER_GAP_PT * scale;
    const leaderEnd = leaderStart + ELEV_LEADER_LEN_PT * scale;
    line(leaderStart, y, leaderEnd, y);
    const fontSize = ELEV_FONT_SIZE_PT * scale;
    page.drawText(
      (Math.round((floorElevation + cumulativeFeet) * 100) / 100).toFixed(2),
      {
        x: leaderEnd + ELEV_TEXT_GAP_PT * scale,
        y: y - fontSize * HALF_CAP_HEIGHT_RATIO,
        size: fontSize,
        font,
        color: black,
      },
    );
  };

  // Top-of-wall boundary: left tick and the top-of-top-riser elevation.
  slashTick(topJointY);
  drawJointElevation(topJointY, result.wallHeightFeet);

  // Top slab thickness label in the left dimension column, centered between
  // the slab's outside bottom plane and the drawn slab top.
  if (result.topSlabThicknessFeet > 0) {
    const slabLabel = `${Math.round(result.topSlabThicknessFeet * 12)}"`;
    const fontSize = ELEV_FONT_SIZE_PT * scale;
    const labelWidth = font.widthOfTextAtSize(slabLabel, fontSize);
    const slabTop = cavityTop + STACK_SLAB_BAND_PT * scale;
    page.drawText(slabLabel, {
      x: railLeftX - STACK_LABEL_GAP_PT * scale - labelWidth,
      y: (topJointY + slabTop) / 2 - fontSize * HALF_CAP_HEIGHT_RATIO,
      size: fontSize,
      font,
      color: black,
    });
  }

  let cumulativeFeet = 0;
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const bandLo = marker.y + cumulativeFeet * feetToPt;
    cumulativeFeet += section.heightFeet;
    const bandHi = Math.min(marker.y + cumulativeFeet * feetToPt, topJointY);
    const isTop = i === sections.length - 1;

    // Section height label left of the rail, matching the static dimension
    // labels' alignment (right-aligned toward the rail).
    const label = formatFeetInches(section.heightFeet);
    const fontSize = DIAGRAM_TEXT_FONT_SIZE_PT * scale;
    const labelWidth = font.widthOfTextAtSize(label, fontSize);
    page.drawText(label, {
      x: railLeftX - STACK_LABEL_GAP_PT * scale - labelWidth,
      y: (bandLo + bandHi) / 2 - fontSize * HALF_CAP_HEIGHT_RATIO,
      size: fontSize,
      font,
      color: black,
    });

    if (isTop) {
      // Bottom of the top slab (left off the template artwork): keyed slab
      // steps over the wall key, with the top of key at the marker top;
      // unkeyed slab sits flush — one flat line.
      if (section.hasTopKey) {
        drawJoint(topJointY, true);
      } else {
        line(outerLeft, cavityTop, outerRight, cavityTop);
      }
    } else {
      drawJoint(bandHi, section.hasTopKey);
      slashTick(bandHi);
      drawJointElevation(bandHi, cumulativeFeet);
    }
  }
}

/** Red annotation naming unkeyed joints, drawn above the riser circle. */
function drawNoKeyNote(
  riserCircle: PlanCircleLayout | null,
  planCircle: PlanCircleLayout | null,
  result: DrillSheetResult,
  font: PDFFont,
): void {
  const layout = riserCircle ?? planCircle;
  if (!layout) {
    return;
  }
  const missingSlabKey = !result.hasKey;
  const missingSectionKey = result.sections.some(
    (section, index) =>
      (index > 0 && !section.hasBottomKey) ||
      (index < result.sections.length - 1 && !section.hasTopKey),
  );
  if (!missingSlabKey && !missingSectionKey) {
    return;
  }

  const parts: string[] = [];
  if (missingSlabKey) {
    parts.push("TOP SLAB");
  }
  if (missingSectionKey) {
    parts.push(result.sections.length > 1 ? "RISER" : "BASE");
  }
  const text = `NO KEY IN ${parts.join(" OR ")}`;

  const scale = layout.radius / REFERENCE_RADIUS_PT;
  const fontSize = NO_KEY_NOTE_FONT_SIZE_PT * scale;
  const width = font.widthOfTextAtSize(text, fontSize);
  layout.page.drawText(text, {
    x: layout.center.x - width / 2,
    y: layout.center.y + layout.radius + NO_KEY_NOTE_ABOVE_CIRCLE_PT * scale,
    size: fontSize,
    font,
    color: rgb(0.85, 0, 0),
  });
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
  openings: ComputedOpening[] = [],
  result: DrillSheetResult | null = null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const planCircle = await readCircleMarker(
    form,
    doc,
    PLAN_CIRCLE_MARKER_FIELD,
  );
  const riserCircle = await readCircleMarker(
    form,
    doc,
    RISER_CIRCLE_MARKER_FIELD,
  );
  const sectionStack = await consumeMarkerField(
    form,
    doc,
    SECTION_STACK_MARKER_FIELD,
  );

  const filledFields: PDFTextField[] = [];

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) {
      continue;
    }

    const name = field.getName();
    const value = fieldMap[name];
    if (value == null || value === "") {
      continue;
    }

    try {
      field.setText(value);
      filledFields.push(field);
    } catch {
      // Field may carry a maxLength from the authoring tool; lift it rather
      // than truncating engineering values.
      try {
        field.removeMaxLength();
        field.setText(value);
        filledFields.push(field);
      } catch {
        // Leave the field blank rather than failing the whole sheet.
      }
    }
  }

  await applyTemplateFieldFonts(doc, form, filledFields, bytes, sectionStack);

  if ((planCircle || riserCircle) && openings.length > 0) {
    await drawPenetrationArrows(doc, planCircle, riserCircle, openings);
  }

  if (result) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    if (sectionStack) {
      drawSectionStack(sectionStack, result, font);
    }
    drawNoKeyNote(riserCircle, planCircle, result, font);
  }

  return doc.save();
}

type TemplateFontKey = "calibri" | "arial" | "helvetica";

/** Windows font files for the typefaces AutoCAD/Acrobat templates use. */
const TEMPLATE_FONT_FILES: Record<
  Exclude<TemplateFontKey, "helvetica">,
  string
> = {
  calibri: "calibri.ttf",
  arial: "arial.ttf",
};

function classifyDaFont(da: string | undefined): TemplateFontKey | null {
  const match = da?.match(/\/([^\s/]+)\s+[\d.]+\s+Tf/);
  if (!match) {
    return null;
  }
  const lower = match[1]!.toLowerCase();
  if (lower.includes("calibri")) {
    return "calibri";
  }
  if (lower.includes("arial")) {
    return "arial";
  }
  if (lower.includes("helv")) {
    return "helvetica";
  }
  return null;
}

/**
 * Picks the font for a field whose own DA is missing or the Acrobat default
 * (Helvetica): first match its opening-table column siblings (`type_a..d`
 * etc.), then fall back to the majority font across the whole template, so
 * the filled text looks like the text printed around it.
 */
function inferTemplateFieldFont(
  name: string,
  ownFont: TemplateFontKey | null,
  fontByField: Map<string, TemplateFontKey | null>,
): TemplateFontKey {
  if (ownFont && ownFont !== "helvetica") {
    return ownFont;
  }

  const majority = (
    filter: (otherName: string) => boolean,
  ): TemplateFontKey | null => {
    const counts = new Map<TemplateFontKey, number>();
    for (const [otherName, otherFont] of fontByField) {
      if (
        otherName === name ||
        !otherFont ||
        otherFont === "helvetica" ||
        !filter(otherName)
      ) {
        continue;
      }
      counts.set(otherFont, (counts.get(otherFont) ?? 0) + 1);
    }
    let best: TemplateFontKey | null = null;
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        best = key;
        bestCount = count;
      }
    }
    return best;
  };

  const rowMatch = name.match(/^(.+)_[a-d]$/);
  if (rowMatch) {
    const sibling = majority((otherName) =>
      otherName.startsWith(`${rowMatch[1]}_`),
    );
    if (sibling) {
      return sibling;
    }
  }

  return majority(() => true) ?? ownFont ?? "helvetica";
}

/**
 * Regenerates the appearance streams of just-filled fields using the typeface
 * each field's template DA names (Calibri/Arial from the Windows font folder,
 * embedded subset), instead of the Helvetica-everywhere default that
 * flattening would otherwise apply. The custom appearance also aligns each
 * value's baseline with the template text printed beside the field, so filled
 * values sit on the same line as their labels. Fields marked clean here are
 * skipped by the later flatten pass, so fonts and baselines survive into the
 * final PDF.
 */
async function applyTemplateFieldFonts(
  doc: PDFDocument,
  form: ReturnType<PDFDocument["getForm"]>,
  filledFields: PDFTextField[],
  originalBytes: Uint8Array,
  sectionStack: MarkerRect | null,
): Promise<void> {
  if (filledFields.length === 0) {
    return;
  }

  const fontByField = new Map<string, TemplateFontKey | null>();
  for (const field of form.getFields()) {
    if (field instanceof PDFTextField) {
      fontByField.set(
        field.getName(),
        classifyDaFont(field.acroField.getDefaultAppearance()),
      );
    }
  }

  const resolved = new Map<PDFTextField, TemplateFontKey>();
  const neededKeys = new Set<TemplateFontKey>();
  for (const field of filledFields) {
    const name = field.getName();
    const key = inferTemplateFieldFont(
      name,
      fontByField.get(name) ?? null,
      fontByField,
    );
    resolved.set(field, key);
    neededKeys.add(key);
  }

  const embedded = new Map<TemplateFontKey, PDFFont>();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  embedded.set("helvetica", helvetica);

  const wantsRealFonts = [...neededKeys].some((key) => key !== "helvetica");
  if (wantsRealFonts) {
    try {
      // Server-only deps loaded lazily: this module is also imported by
      // client components for its field-name constants.
      const [{ readFile }, path, fontkitModule] = await Promise.all([
        import("fs/promises"),
        import("path"),
        import("@pdf-lib/fontkit"),
      ]);
      doc.registerFontkit(fontkitModule.default);
      const fontsDir = path.join(
        process.env.WINDIR ?? "C:\\Windows",
        "Fonts",
      );
      for (const key of neededKeys) {
        if (key === "helvetica") {
          continue;
        }
        try {
          const fontBytes = await readFile(
            path.join(fontsDir, TEMPLATE_FONT_FILES[key]),
          );
          embedded.set(key, await doc.embedFont(fontBytes, { subset: true }));
        } catch {
          // Font file unavailable on this machine; Helvetica fallback below.
        }
      }
    } catch {
      // fontkit unavailable; Helvetica fallback below.
    }
  }

  const textItemsByPage = await extractTemplateTextBaselines(originalBytes);
  const diagram = buildDiagramLayout(sectionStack, form);

  // The casting/brick thickness values center between static rail ticks that
  // don't line up with the authored field rects; re-center each widget on its
  // band so the repositioned text stays inside the appearance clip area.
  if (diagram) {
    for (const field of filledFields) {
      const bandCenterY = diagram.bandCenterByField.get(field.getName());
      if (bandCenterY == null) {
        continue;
      }
      for (const widget of field.acroField.getWidgets()) {
        const rect = widget.getRectangle();
        widget.setRectangle({
          ...rect,
          y: bandCenterY - rect.height / 2,
        });
      }
    }
  }

  for (const [field, key] of resolved) {
    const font = embedded.get(key) ?? helvetica;
    try {
      field.updateAppearances(
        font,
        makeBaselineAlignedProvider(doc, textItemsByPage, diagram),
      );
    } catch {
      try {
        field.updateAppearances(font);
      } catch {
        // Leave the appearance to the flatten pass rather than failing.
      }
    }
  }
}

type TemplateTextItem = {
  x: number;
  width: number;
  baselineY: number;
};

/**
 * Baselines of the template's printed text per page (via pdfjs), used to line
 * filled values up with the labels next to them.
 */
async function extractTemplateTextBaselines(
  bytes: Uint8Array,
): Promise<TemplateTextItem[][]> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    const pages: TemplateTextItem[][] = [];
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const items: TemplateTextItem[] = [];
      for (const item of textContent.items) {
        if (!("str" in item) || !item.str.trim()) {
          continue;
        }
        items.push({
          x: item.transform[4],
          width: item.width ?? 0,
          baselineY: item.transform[5],
        });
      }
      pages.push(items);
    }
    void pdf.cleanup();
    return pages;
  } catch {
    return [];
  }
}

/**
 * Max horizontal gap between a field and a text item to count as "next to".
 * Wide enough that opening-table cells align to the row letter at the left
 * edge of the table; the same-line requirement keeps matches on one row.
 */
const NEIGHBOR_MAX_GAP_PT = 200;

function readDaFontSize(dict: PDFDict): number | undefined {
  try {
    const da = dict.lookupMaybe(PDFName.of("DA"), PDFString, PDFHexString);
    const text = da?.decodeText();
    const match = text?.match(/\/[^\s/]+\s+([\d.]+)\s+Tf/);
    if (!match) {
      return undefined;
    }
    const size = Number.parseFloat(match[1]!);
    return Number.isFinite(size) && size > 0 ? size : undefined;
  } catch {
    return undefined;
  }
}

function widgetCenterY(widget: { getRectangle(): { y: number; height: number } }): number {
  const rect = widget.getRectangle();
  return rect.y + rect.height / 2;
}

/** Vertical center of a template field widget, optionally filtered (e.g. right rail). */
function readFieldWidgetCenterY(
  form: ReturnType<PDFDocument["getForm"]>,
  fieldName: string,
  filter?: (rect: { x: number; y: number; width: number; height: number }) => boolean,
): number | null {
  try {
    const field = form.getTextField(fieldName);
    for (const widget of field.acroField.getWidgets()) {
      const rect = widget.getRectangle();
      if (filter && !filter(rect)) {
        continue;
      }
      return widgetCenterY(widget);
    }
  } catch {
    // Field absent on this template variant.
  }
  return null;
}

/**
 * Cross-section diagram geometry derived from the section_stack marker:
 * the region whose fields print at the diagram font size, and the static
 * rail-tick band centers for the casting/brick thickness values.
 */
type DiagramLayout = {
  page: PDFPage;
  region: { xLo: number; xHi: number; yLo: number; yHi: number };
  /** Static rail-tick band centers keyed by field name. */
  bandCenterByField: Map<string, number>;
};

function buildDiagramLayout(
  marker: MarkerRect | null,
  form: ReturnType<PDFDocument["getForm"]>,
): DiagramLayout | null {
  if (!marker) {
    return null;
  }
  const cavityTop = marker.y + marker.height;
  const bandCenterByField = new Map<string, number>();

  // The right-rail elevation fields share horizontal leader lines with the
  // left-rail slash ticks above the cavity; center thickness labels between
  // those pairs rather than using the authored widget rects.
  const rightRail = (rect: { x: number }) => rect.x > 400;
  const shellTopTick = readFieldWidgetCenterY(
    form,
    "top_of_top_slab_elevation",
    rightRail,
  );
  const castingBottomTick = readFieldWidgetCenterY(
    form,
    "bottom_casting_elevation",
    rightRail,
  );
  const rimTick = readFieldWidgetCenterY(form, "rim_elevation", rightRail);

  if (shellTopTick != null && castingBottomTick != null) {
    bandCenterByField.set(
      "brick_thickness_inches",
      (shellTopTick + castingBottomTick) / 2,
    );
  }
  if (castingBottomTick != null && rimTick != null) {
    bandCenterByField.set(
      "casting_thickness_inches",
      (castingBottomTick + rimTick) / 2,
    );
  }

  if (bandCenterByField.size === 0) {
    bandCenterByField.set(
      "brick_thickness_inches",
      cavityTop +
        (STACK_SHELL_TOP_TICK_PT + STACK_CASTING_BOTTOM_TICK_PT) / 2,
    );
    bandCenterByField.set(
      "casting_thickness_inches",
      cavityTop +
        (STACK_CASTING_BOTTOM_TICK_PT + STACK_CASTING_TOP_TICK_PT) / 2,
    );
  }

  return {
    page: marker.page,
    region: {
      xLo: marker.x - 90,
      xHi: marker.x + marker.width + 100,
      yLo: marker.y - 50,
      yHi: cavityTop + 45,
    },
    bandCenterByField,
  };
}

/**
 * Appearance provider matching pdf-lib's default single-line text field
 * appearance, except:
 * - the text baseline is moved onto the baseline of the closest template
 *   text beside the field, so values line up with their labels;
 * - fields inside the cross-section diagram print at the diagram font size,
 *   vertically centered (the casting/brick thickness widgets are re-centered
 *   between their rail ticks before this runs).
 * Falls back to the default provider for rotated/multiline/combed fields.
 */
function makeBaselineAlignedProvider(
  doc: PDFDocument,
  textItemsByPage: TemplateTextItem[][],
  diagram: DiagramLayout | null,
) {
  return (
    textField: PDFTextField,
    widget: Parameters<typeof defaultTextFieldAppearanceProvider>[1],
    font: PDFFont,
  ) => {
    const fallback = () =>
      defaultTextFieldAppearanceProvider(textField, widget, font);

    if (textField.isMultiline() || textField.isCombed()) {
      return fallback();
    }
    const rotation = widget.getAppearanceCharacteristics()?.getRotation() ?? 0;
    if (rotation % 360 !== 0) {
      return fallback();
    }

    const rect = widget.getRectangle();
    const pageIndex = doc
      .getPages()
      .findIndex((page) => page.ref === widget.P());
    const items = textItemsByPage[pageIndex === -1 ? 0 : pageIndex] ?? [];

    const widgetPage = doc.getPages()[pageIndex === -1 ? 0 : pageIndex];
    const inDiagram =
      diagram != null &&
      widgetPage === diagram.page &&
      rect.x + rect.width / 2 >= diagram.region.xLo &&
      rect.x + rect.width / 2 <= diagram.region.xHi &&
      rect.y + rect.height / 2 >= diagram.region.yLo &&
      rect.y + rect.height / 2 <= diagram.region.yHi;
    const bandCenterY = inDiagram
      ? diagram!.bandCenterByField.get(textField.getName())
      : undefined;

    // Closest printed text whose baseline falls inside the field's vertical
    // span, preferring the smallest horizontal gap (the label beside it).
    // Band-centered fields skip this: their position comes from the ticks.
    let target: TemplateTextItem | null = null;
    let targetGap = Number.POSITIVE_INFINITY;
    if (bandCenterY == null) {
      for (const item of items) {
        if (
          item.baselineY < rect.y - 0.5 ||
          item.baselineY > rect.y + rect.height + 0.5
        ) {
          continue;
        }
        const gap =
          item.x + item.width < rect.x
            ? rect.x - (item.x + item.width)
            : item.x > rect.x + rect.width
              ? item.x - (rect.x + rect.width)
              : 0;
        if (gap > NEIGHBOR_MAX_GAP_PT) {
          continue;
        }
        if (gap < targetGap) {
          target = item;
          targetGap = gap;
        }
      }
    }

    if (!target && !inDiagram) {
      return fallback();
    }

    const borderWidth = widget.getBorderStyle()?.getWidth() ?? 0;
    const padding = 1;
    const bounds = {
      x: borderWidth + padding,
      y: borderWidth + padding,
      width: rect.width - (borderWidth + padding) * 2,
      height: rect.height - (borderWidth + padding) * 2,
    };
    const daSize =
      readDaFontSize(widget.dict) ?? readDaFontSize(textField.acroField.dict);
    const fontSize = inDiagram ? DIAGRAM_FIELD_FONT_SIZE_PT : daSize;

    let layout: ReturnType<typeof layoutSinglelineText>;
    try {
      layout = layoutSinglelineText(textField.getText() ?? "", {
        alignment: textField.getAlignment() ?? TextAlignment.Left,
        fontSize,
        font,
        bounds,
      });
    } catch {
      return fallback();
    }

    if (target) {
      const baselineInRect = target.baselineY - rect.y;
      if (baselineInRect < 0 || baselineInRect > rect.height) {
        return fallback();
      }
      layout.line.y = baselineInRect;
    } else if (bandCenterY != null) {
      // Center the glyphs on the tick-band center (widget rect was already
      // re-centered onto the band, so this stays inside the clip area).
      layout.line.y =
        bandCenterY - rect.y - layout.fontSize * HALF_CAP_HEIGHT_RATIO;
    } else {
      // Diagram field with no printed text on its line: center the glyphs
      // vertically in the widget (same convention as the drawn stack labels).
      layout.line.y =
        rect.height / 2 - layout.fontSize * HALF_CAP_HEIGHT_RATIO;
    }

    return drawTextField({
      x: borderWidth / 2,
      y: borderWidth / 2,
      width: rect.width - borderWidth,
      height: rect.height - borderWidth,
      borderWidth,
      borderColor: undefined,
      textColor: rgb(0, 0, 0),
      font: font.name,
      fontSize: layout.fontSize,
      color: undefined,
      textLines: [layout.line],
      padding,
    });
  };
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
