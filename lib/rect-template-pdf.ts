// Fills a calibrated rectangular-structure template PDF (AcroForm) and draws
// the app-generated line work.
//
// The calibrated template (scripts/calibrate-rect-templates.ts) carries the
// static artwork plus text fields; three marker fields tell the app where to
// draw (see lib/rect-template-pdf-fields.ts):
//   - rect_exploded_view / rect_exploded_center: the unfolded box cross on
//     the right. Flaps = walls (Up, Right, Down, Left). Openings,
//     their size/location annotations, and section joint lines draw here.
//   - rect_top_slab_box: the slab square in the TOP SLAB detail box; the
//     access opening and its size draw inside it.
//
// The main section elevation stays static — only its text fields change.
// Geometry fractions come from lib/rect-structure-diagram.ts — the same
// helpers the on-screen SVG preview uses.

import {
  AnnotationFlags,
  PDFDocument,
  PDFFont,
  PDFPage,
  PDFTextField,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { RectSheetPreviewMeta } from "@/components/drill-sheets/rect-sheet-preview";
import {
  planOpeningSpanFraction,
  sectionJointHeightsFeet,
  topSlabOpeningRect,
} from "@/lib/rect-structure-diagram";
import {
  formatPounds,
  type ComputedRectOpening,
  type RectStructureResult,
  type RectWall,
} from "@/lib/rect-structure";
import {
  RECT_ELEVATION_WALL_MARKER_FIELD,
  RECT_EXPLODED_CENTER_MARKER_FIELD,
  RECT_EXPLODED_MARKER_FIELD,
  RECT_OPENING_ROWS,
  RECT_TOP_SLAB_MARKER_FIELD,
  RECT_WEIGHT_PIECE_LINES,
} from "@/lib/rect-template-pdf-fields";

const LINE_WIDTH_PT = 0.8;
const OPENING_LINE_WIDTH_PT = 1;
const LABEL_FONT_SIZE_PT = 8;
const SMALL_FONT_SIZE_PT = 6.5;
const BLACK = rgb(0, 0, 0);
const EPSILON = 1e-6;

type RectTemplatePdfRow = {
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  filePath: string;
  originalName: string;
};

/** Picks the uploaded PDF variant matching the sheet's slab configuration. */
export function selectRectTemplateVariant<T extends RectTemplatePdfRow>(
  templatePdfs: T[],
  result: RectStructureResult,
): T | null {
  return (
    templatePdfs.find(
      (row) =>
        row.hasTopSlab === result.hasTopSlab &&
        row.hasBaseSlab === result.hasBaseSlab,
    ) ?? null
  );
}

function feet2(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "" : value.toFixed(2);
}

function wholeInches(feet: number | null | undefined): string {
  if (feet == null || Number.isNaN(feet)) {
    return "";
  }
  return `${Math.round(feet * 12)}"`;
}

function weightLine(label: string, lbs: number | null): string {
  if (lbs == null || lbs <= 0) {
    return "";
  }
  // Printed weights round UP to the nearest 100 lbs (crane-planning margin).
  const rounded = Math.ceil(lbs / 100) * 100;
  return `${label}: ${formatPounds(rounded)}`;
}

/** Field name → printed value for every text field on the rect template. */
export function buildRectSheetFieldMap(
  meta: RectSheetPreviewMeta,
  result: RectStructureResult,
  extras: { date?: string } = {},
): Record<string, string> {
  const rim = result.rimElevation;
  const bottomCasting = rim != null ? rim - result.castingHeightFeet : null;
  const topSlabTop = bottomCasting != null ? bottomCasting - result.brickFeet : null;
  const topSlabBottom =
    topSlabTop != null ? topSlabTop - result.topSlabThicknessFeet : null;

  const baseNote = result.hasBaseSlab
    ? `${wholeInches(result.baseSlabThicknessFeet)} ${result.baseAttached ? "Attached" : "Separate"}`
    : "No";

  const map: Record<string, string> = {
    // Header
    contractor: meta.contractor,
    project: meta.project,
    date: extras.date ?? "",
    box_no: meta.structureNumber,
    wall_thickness: wholeInches(result.wallThicknessFeet),
    base_note: baseNote,
    casting: meta.castingName ?? "",
    // Exploded view dims
    inside_length_inches: wholeInches(result.insideLengthFeet),
    inside_width_inches: wholeInches(result.insideWidthFeet),
    wall_height_inches: wholeInches(result.wallHeightFeet),
    // Elevation thickness stack
    casting_thickness_inches: wholeInches(result.castingHeightFeet),
    brick_thickness_inches: wholeInches(result.brickFeet),
    top_slab_thickness_inches: result.hasTopSlab
      ? wholeInches(result.topSlabThicknessFeet)
      : "",
    base_slab_thickness_inches: result.hasBaseSlab
      ? wholeInches(result.baseSlabThicknessFeet)
      : "",
    // Elevation ladder
    rim_elevation: feet2(rim),
    rim_elevation_drawing: feet2(rim),
    wall_height_stack_inches: wholeInches(result.wallHeightFeet),
    bottom_casting_elevation: feet2(bottomCasting),
    top_of_top_slab_elevation: result.hasTopSlab ? feet2(topSlabTop) : "",
    bottom_of_top_slab_elevation: result.hasTopSlab ? feet2(topSlabBottom) : "",
    top_of_wall_elevation: !result.hasTopSlab ? feet2(topSlabTop) : "",
    top_of_bottom_slab_elevation: feet2(result.floorElevation),
    bottom_of_bottom_slab_elevation:
      result.hasBaseSlab && result.floorElevation != null
        ? feet2(result.floorElevation - result.baseSlabThicknessFeet)
        : "",
    // Height-math ladder (decimal feet)
    low_invert: feet2(result.lowInvertElevation),
    invert_to_top: feet2(result.invertToTopFeet),
    casting_minus: feet2(result.castingHeightFeet),
    brick_minus: feet2(result.brickFeet),
    top_slab_minus: feet2(result.topSlabThicknessFeet),
    sump_plus: feet2(result.sumpFeet),
    wall_height: feet2(result.wallHeightFeet),
    // Top slab detail box (outside dims; slab is flush with the walls)
    top_slab_length: result.hasTopSlab
      ? wholeInches(result.outsideLengthFeet)
      : "",
    top_slab_width: result.hasTopSlab
      ? wholeInches(result.outsideWidthFeet)
      : "",
    // Piece weights (upper right)
    weight_top_slab: weightLine("Top Slab", result.weights.topSlabLbs),
    weight_base: weightLine("Base", result.weights.baseSlabLbs),
  };

  for (let i = 0; i < RECT_WEIGHT_PIECE_LINES; i += 1) {
    const section = result.sections[i];
    const label =
      result.sections.length === 1
        ? "Box"
        : `Piece ${i + 1}${section?.includesBaseSlab ? " (w/ base)" : ""}`;
    map[`weight_piece_${i + 1}`] = section
      ? weightLine(label, section.pickWeightLbs)
      : "";
  }
  if (
    result.sections.length === 1 &&
    result.sections[0]?.includesBaseSlab &&
    map.weight_piece_1
  ) {
    map.weight_piece_1 = weightLine(
      "Box (w/ base)",
      result.sections[0].pickWeightLbs,
    );
  }

  // Openings table rows (INVERT | DIA | TYPE)
  RECT_OPENING_ROWS.forEach((row, index) => {
    const opening = result.openings[index];
    map[`invert_${row}`] = opening ? feet2(opening.invertElevation) : "";
    map[`dia_${row}`] =
      opening?.pipeSizeInches != null ? `${opening.pipeSizeInches}"` : "";
    map[`type_${row}`] = opening?.pipeMaterial ?? "";
  });

  return map;
}

type MarkerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  page: PDFPage;
};

function getWidgetPage(
  doc: PDFDocument,
  widget: { P(): unknown },
): PDFPage | null {
  const ref = widget.P();
  for (const page of doc.getPages()) {
    if (page.ref === ref) {
      return page;
    }
  }
  return null;
}

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

// ---------------------------------------------------------------------------
// Exploded view (unfolded box cross)
//
// Flap = wall face folded flat, hinged at the center square: the edge shared
// with the center is the BOTTOM of the wall; the outer edge is the TOP. The
// along-wall axis follows the plan: the Up wall is viewed from inside the
// box looking north (its left end meets the Left wall), so the cross keeps
// neighboring wall ends adjacent at the shared corners.
// ---------------------------------------------------------------------------

type Flap = {
  wall: RectWall;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Places an (alongFrac, upFrac) wall point into page coords. */
  point: (alongFrac: number, upFrac: number) => { x: number; y: number };
  /** True when the wall's height axis runs along page Y. */
  verticalWall: boolean;
};

function buildFlaps(exploded: MarkerRect, center: MarkerRect): Flap[] {
  const flaps: Flap[] = [];
  const cx0 = center.x;
  const cx1 = center.x + center.width;
  const cy0 = center.y;
  const cy1 = center.y + center.height;

  // Up wall: top flap. Bottom edge = wall bottom; along-wall left→right = +x.
  flaps.push({
    wall: "UP",
    x: cx0,
    y: cy1,
    width: center.width,
    height: exploded.y + exploded.height - cy1,
    point(along, up) {
      return { x: cx0 + along * center.width, y: cy1 + up * this.height };
    },
    verticalWall: true,
  });
  // Down wall: bottom flap. Top edge = wall bottom; along-wall mirrored so
  // the viewer's left stays consistent when folded up.
  flaps.push({
    wall: "DOWN",
    x: cx0,
    y: exploded.y,
    width: center.width,
    height: cy0 - exploded.y,
    point(along, up) {
      return {
        x: cx0 + (1 - along) * center.width,
        y: cy0 - up * this.height,
      };
    },
    verticalWall: true,
  });
  // Right wall: right flap. Left edge = wall bottom; along-wall runs from
  // the corner shared with the Up wall downward.
  flaps.push({
    wall: "RIGHT",
    x: cx1,
    y: cy0,
    width: exploded.x + exploded.width - cx1,
    height: center.height,
    point(along, up) {
      return { x: cx1 + up * this.width, y: cy1 - along * center.height };
    },
    verticalWall: false,
  });
  // Left wall: left flap. Right edge = wall bottom; along-wall from the
  // corner shared with the Up wall downward, mirrored to keep ends adjacent.
  flaps.push({
    wall: "LEFT",
    x: exploded.x,
    y: cy0,
    width: cx0 - exploded.x,
    height: center.height,
    point(along, up) {
      return { x: cx0 - up * this.width, y: cy0 + along * center.height };
    },
    verticalWall: false,
  });
  return flaps;
}

/** Callout text sizes measured from the CAD example sheets (cb1-cb7). */
const CALLOUT_FONT_SIZE_PT = 13;
const CALLOUT_LINE_GAP_PT = 15.5;
const CALLOUT_LOCATION_FONT_SIZE_PT = 8.5;
const BADGE_RADIUS_PT = 8.5;
const BADGE_FONT_SIZE_PT = 11.5;
/** Vertical room one callout block occupies in its quadrant. */
const CALLOUT_SLOT_PT = 56;
/** Half of Helvetica's cap height, used to vertically center badge letters. */
const HALF_CAP_HEIGHT_RATIO = 0.36;

type PageRect = { x: number; y: number; width: number; height: number };

/** Opening rectangle on its flap in page coordinates. */
function openingRectOnFlap(
  flap: Flap,
  opening: ComputedRectOpening,
  result: RectStructureResult,
): PageRect | null {
  if (
    opening.bottomOfOpeningFeet == null ||
    opening.topOfOpeningFeet == null ||
    result.floorElevation == null ||
    result.wallHeightFeet <= EPSILON
  ) {
    return null;
  }
  const span = planOpeningSpanFraction(opening, result);
  if (!span) {
    return null;
  }
  const upLo = Math.max(
    (opening.bottomOfOpeningFeet - result.floorElevation) /
      result.wallHeightFeet,
    0,
  );
  const upHi = Math.min(
    (opening.topOfOpeningFeet - result.floorElevation) / result.wallHeightFeet,
    1,
  );

  const p1 = flap.point(span.startFraction, upLo);
  const p2 = flap.point(span.endFraction, upHi);
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.max(Math.abs(p2.x - p1.x), 5),
    height: Math.max(Math.abs(p2.y - p1.y), 5),
  };
}

/** Knockout symbol: the opening rectangle with an X through it. */
function drawOpeningKnockout(page: PDFPage, rect: PageRect): void {
  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderColor: BLACK,
    borderWidth: OPENING_LINE_WIDTH_PT,
  });
  page.drawLine({
    start: { x: rect.x, y: rect.y },
    end: { x: rect.x + rect.width, y: rect.y + rect.height },
    thickness: LINE_WIDTH_PT,
    color: BLACK,
  });
  page.drawLine({
    start: { x: rect.x, y: rect.y + rect.height },
    end: { x: rect.x + rect.width, y: rect.y },
    thickness: LINE_WIDTH_PT,
    color: BLACK,
  });
}

/** CAD-style filled arrowhead with its apex at (tipX, tipY). */
const ARROW_LENGTH_PT = 7;
const ARROW_HALF_WIDTH_PT = 2.6;

function drawArrowhead(
  page: PDFPage,
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
): void {
  const dx = tipX - fromX;
  const dy = tipY - fromY;
  const length = Math.hypot(dx, dy);
  if (length < EPSILON) {
    return;
  }
  const ux = dx / length;
  const uy = dy / length;
  const baseX = tipX - ux * ARROW_LENGTH_PT;
  const baseY = tipY - uy * ARROW_LENGTH_PT;
  const leftX = baseX - uy * ARROW_HALF_WIDTH_PT;
  const leftY = baseY + ux * ARROW_HALF_WIDTH_PT;
  const rightX = baseX + uy * ARROW_HALF_WIDTH_PT;
  const rightY = baseY - ux * ARROW_HALF_WIDTH_PT;
  // drawSvgPath flips the y-axis (SVG is y-down); negate y so the head lands
  // at the intended page coordinates.
  page.drawSvgPath(
    `M ${tipX} ${-tipY} L ${leftX} ${-leftY} L ${rightX} ${-rightY} Z`,
    { x: 0, y: 0, color: BLACK, borderColor: BLACK, borderWidth: 0.3 },
  );
}

/**
 * Vertical/horizontal dimension from the fold line (top of base slab) to the
 * opening's bottom edge, with arrowheads and the `+N"` value beside it, run
 * on the opening's centerline. When another opening on the same wall blocks
 * that run there is no clean place for the line or its text (it tangles with
 * the section chain and the neighbor's callout leader), so the dimension is
 * omitted — the callout's `@ +N"` line already states the value.
 */
function drawFoldDimension(
  page: PDFPage,
  font: PDFFont,
  flap: Flap,
  rect: PageRect,
  offsetInches: number,
  otherRects: PageRect[],
  hasSectionChain: boolean,
): void {
  const text = `+${offsetInches}"`;
  const textWidth = font.widthOfTextAtSize(text, CALLOUT_FONT_SIZE_PT);

  if (flap.wall === "UP" || flap.wall === "DOWN") {
    const foldY = flap.wall === "UP" ? flap.y : flap.y + flap.height;
    const openY = flap.wall === "UP" ? rect.y : rect.y + rect.height;
    const yLo = Math.min(foldY, openY);
    const yHi = Math.max(foldY, openY);

    const dimX = rect.x + rect.width / 2;
    const blocked = otherRects.some(
      (other) =>
        dimX >= other.x - 3 &&
        dimX <= other.x + other.width + 3 &&
        other.y < yHi &&
        other.y + other.height > yLo,
    );
    if (blocked) {
      return;
    }

    page.drawLine({
      start: { x: dimX, y: foldY },
      end: { x: dimX, y: openY },
      thickness: 0.7,
      color: BLACK,
    });
    if (Math.abs(openY - foldY) > ARROW_LENGTH_PT * 2 + 2) {
      drawArrowhead(page, dimX, foldY, dimX, openY);
      drawArrowhead(page, dimX, openY, dimX, foldY);
    }
    // Text sits left of the line unless that would leave the flap or hit
    // the section-dimension chain along the Up flap's left edge.
    const chainZone =
      hasSectionChain && flap.wall === "UP" ? flap.x + 44 : flap.x + 2;
    const textX =
      dimX - textWidth - 4 >= chainZone ? dimX - textWidth - 4 : dimX + 4;
    page.drawText(text, {
      x: textX,
      y: (foldY + openY) / 2 - CALLOUT_FONT_SIZE_PT * 0.36,
      size: CALLOUT_FONT_SIZE_PT,
      font,
      color: BLACK,
    });
    return;
  }

  // Left/Right walls: height runs along page X.
  const foldX = flap.wall === "RIGHT" ? flap.x : flap.x + flap.width;
  const openX = flap.wall === "RIGHT" ? rect.x : rect.x + rect.width;
  const xLo = Math.min(foldX, openX);
  const xHi = Math.max(foldX, openX);

  const dimY = rect.y + rect.height / 2;
  const blocked = otherRects.some(
    (other) =>
      dimY >= other.y - 3 &&
      dimY <= other.y + other.height + 3 &&
      other.x < xHi &&
      other.x + other.width > xLo,
  );
  if (blocked) {
    return;
  }

  page.drawLine({
    start: { x: foldX, y: dimY },
    end: { x: openX, y: dimY },
    thickness: 0.7,
    color: BLACK,
  });
  if (Math.abs(openX - foldX) > ARROW_LENGTH_PT * 2 + 2) {
    drawArrowhead(page, foldX, dimY, openX, dimY);
    drawArrowhead(page, openX, dimY, foldX, dimY);
  }
  page.drawText(text, {
    x: (foldX + openX) / 2 - textWidth / 2,
    y: dimY + 4,
    size: CALLOUT_FONT_SIZE_PT,
    font,
    color: BLACK,
  });
}

/** `@ +22"` line, or `@ Bottom` when the opening sits on the base slab. */
function baseOffsetText(opening: ComputedRectOpening): string | null {
  const inches = opening.floorToOpeningBottomInches;
  if (inches == null) {
    return null;
  }
  return inches <= 0 ? "@ Bottom" : `@ +${inches}"`;
}

function locationText(opening: ComputedRectOpening): string | null {
  if (opening.placement === "TOUCH_LEFT") {
    return "TO LEFT END";
  }
  if (opening.placement === "TOUCH_RIGHT") {
    return "TO RIGHT END";
  }
  if (
    (opening.placement === "FROM_LEFT" || opening.placement === "FROM_RIGHT") &&
    opening.offsetInches != null
  ) {
    return `${opening.offsetInches}" FROM ${opening.placement === "FROM_LEFT" ? "LEFT" : "RIGHT"}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Callout layout planner
//
// Annotations used to place themselves independently, which let leaders
// cross and dimensions run through neighboring openings. This pass collects
// every opening first, then:
//   - callouts on each side of the cross form ONE column of fixed slots;
//     openings are sorted by height and take slots in the same order, so
//     leaders on a side can never cross each other;
//   - each callout takes the free slot nearest its opening, keeping leaders
//     short;
//   - fold dimensions dodge other openings on the same wall;
//   - joint labels sit inside the flap, away from the callout lane.
// ---------------------------------------------------------------------------

type PlannedOpening = {
  opening: ComputedRectOpening;
  flap: Flap;
  rect: PageRect;
  index: number;
};

/** Top edges of the callout slots beside the cross, top to bottom. The gap
 * between the two upper and three lower slots is the side flap band, which
 * callout blocks must not cover. */
function calloutSlotTops(exploded: MarkerRect, center: MarkerRect): number[] {
  const ey1 = exploded.y + exploded.height;
  const cy0 = center.y;
  return [
    ey1 - 4,
    ey1 - 4 - CALLOUT_SLOT_PT,
    cy0 - 4,
    cy0 - 4 - CALLOUT_SLOT_PT,
    cy0 - 4 - CALLOUT_SLOT_PT * 2,
  ];
}

function drawOpeningsOnFlaps(
  flaps: Flap[],
  exploded: MarkerRect,
  center: MarkerRect,
  result: RectStructureResult,
  page: PDFPage,
  font: PDFFont,
): void {
  const planned: PlannedOpening[] = [];
  const rectsByWall = new Map<RectWall, PageRect[]>();

  result.openings.forEach((opening, index) => {
    const flap = flaps.find((entry) => entry.wall === opening.wall);
    if (!flap) {
      return;
    }
    const rect = openingRectOnFlap(flap, opening, result);
    if (!rect) {
      return;
    }
    planned.push({ opening, flap, rect, index });
    const list = rectsByWall.get(flap.wall) ?? [];
    list.push(rect);
    rectsByWall.set(flap.wall, list);
  });

  const hasSectionChain = result.sections.length > 1;

  // Knockouts + fold dimensions (with same-wall avoidance).
  for (const entry of planned) {
    drawOpeningKnockout(page, entry.rect);
    const offsetInches = entry.opening.floorToOpeningBottomInches;
    if (offsetInches != null && offsetInches > 0) {
      const others = (rectsByWall.get(entry.flap.wall) ?? []).filter(
        (rect) => rect !== entry.rect,
      );
      drawFoldDimension(
        page,
        font,
        entry.flap,
        entry.rect,
        offsetInches,
        others,
        hasSectionChain,
      );
    }
  }

  // Callout columns: Left-wall openings hang on the west side, everything
  // else on the east side.
  const slotTops = calloutSlotTops(exploded, center);
  const eastLaneCx =
    center.x + center.width + (exploded.x + exploded.width - center.x - center.width) / 2;
  // The west quadrants keep the static size dimensions near their inner
  // edge, so the west lane sits toward the outer page edge.
  const westLaneCx = exploded.x + (center.x - exploded.x) * 0.32;

  const sides: { list: PlannedOpening[]; laneCx: number }[] = [
    { list: planned.filter((entry) => entry.flap.wall !== "LEFT"), laneCx: eastLaneCx },
    { list: planned.filter((entry) => entry.flap.wall === "LEFT"), laneCx: westLaneCx },
  ];

  for (const side of sides) {
    if (side.list.length === 0) {
      continue;
    }
    // Top-most opening gets the top-most slot, preserving vertical order so
    // leaders never cross; among order-preserving choices, each callout
    // takes the slot nearest its opening.
    const ordered = [...side.list].sort(
      (a, b) => b.rect.y + b.rect.height / 2 - (a.rect.y + a.rect.height / 2),
    );
    let nextSlot = 0;
    ordered.forEach((entry, position) => {
      const remaining = ordered.length - position;
      const lastUsable = Math.max(slotTops.length - remaining, nextSlot);
      let bestIdx = Math.min(nextSlot, slotTops.length - 1);
      let bestDist = Number.POSITIVE_INFINITY;
      for (
        let idx = nextSlot;
        idx <= Math.min(lastUsable, slotTops.length - 1);
        idx += 1
      ) {
        const blockMidY = slotTops[idx] - 26;
        const dist = Math.abs(blockMidY - (entry.rect.y + entry.rect.height / 2));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      }
      nextSlot = bestIdx + 1;
      drawCalloutBlock(page, font, entry, side.laneCx, slotTops[bestIdx]);
    });
  }
}

/** One callout block (size / offset / location / circled letter) + leader. */
function drawCalloutBlock(
  page: PDFPage,
  font: PDFFont,
  entry: PlannedOpening,
  blockCx: number,
  blockTopY: number,
): void {
  const { opening, rect, index } = entry;
  const letter = opening.label?.trim() || String.fromCharCode(65 + index);
  const sizeText =
    opening.openingWidthInches != null && opening.openingHeightInches != null
      ? `${opening.openingWidthInches}"x${opening.openingHeightInches}"`
      : letter;
  const offsetText = baseOffsetText(opening);
  const location = locationText(opening);

  let cursorY = blockTopY;
  // Trailing inch marks read as overhang, so center on the text without
  // them — this lines the digit blocks up under each other like the CAD
  // sheets.
  const drawCentered = (text: string, size: number) => {
    cursorY -= size;
    const opticalWidth = font.widthOfTextAtSize(text.replace(/"+$/, ""), size);
    page.drawText(text, {
      x: blockCx - opticalWidth / 2,
      y: cursorY,
      size,
      font,
      color: BLACK,
    });
  };

  drawCentered(sizeText, CALLOUT_FONT_SIZE_PT);
  if (offsetText) {
    cursorY -= CALLOUT_LINE_GAP_PT - CALLOUT_FONT_SIZE_PT;
    drawCentered(offsetText, CALLOUT_FONT_SIZE_PT);
  }
  if (location) {
    cursorY -= 3;
    drawCentered(location, CALLOUT_LOCATION_FONT_SIZE_PT);
  }

  const badgeCy = cursorY - 6 - BADGE_RADIUS_PT;
  page.drawCircle({
    x: blockCx,
    y: badgeCy,
    size: BADGE_RADIUS_PT,
    borderColor: BLACK,
    borderWidth: 0.9,
  });
  page.drawText(letter, {
    x: blockCx - font.widthOfTextAtSize(letter, BADGE_FONT_SIZE_PT) / 2,
    y: badgeCy - BADGE_FONT_SIZE_PT * HALF_CAP_HEIGHT_RATIO,
    size: BADGE_FONT_SIZE_PT,
    font,
    color: BLACK,
  });

  // Leader from the block's near side to the opening's nearest point, tipped
  // with an arrowhead.
  const blockCyMid = (blockTopY + badgeCy - BADGE_RADIUS_PT) / 2;
  const targetX =
    blockCx < rect.x
      ? rect.x
      : blockCx > rect.x + rect.width
        ? rect.x + rect.width
        : blockCx;
  const targetY =
    blockCyMid < rect.y
      ? rect.y
      : blockCyMid > rect.y + rect.height
        ? rect.y + rect.height
        : blockCyMid;
  const blockHalfWidth =
    Math.max(
      font.widthOfTextAtSize(sizeText, CALLOUT_FONT_SIZE_PT),
      offsetText ? font.widthOfTextAtSize(offsetText, CALLOUT_FONT_SIZE_PT) : 0,
    ) / 2;
  const startX =
    targetX < blockCx
      ? blockCx - blockHalfWidth - 3
      : targetX > blockCx
        ? blockCx + blockHalfWidth + 3
        : blockCx;
  page.drawLine({
    start: { x: startX, y: blockCyMid },
    end: { x: targetX, y: targetY },
    thickness: 0.7,
    color: BLACK,
  });
  drawArrowhead(page, targetX, targetY, startX, blockCyMid);
}

/** Section joint lines across every flap, labeled on the Up wall's flap. */
function drawJointsOnFlaps(
  flaps: Flap[],
  result: RectStructureResult,
  page: PDFPage,
  font: PDFFont,
): void {
  if (result.wallHeightFeet <= EPSILON) {
    return;
  }
  const upFlap = flaps.find((flap) => flap.wall === "UP");
  const upRects = upFlap
    ? result.openings
        .filter((opening) => opening.wall === "UP")
        .map((opening) => openingRectOnFlap(upFlap, opening, result))
        .filter((rect): rect is PageRect => rect != null)
    : [];
  const hasSectionChain = result.sections.length > 1;

  for (const joint of sectionJointHeightsFeet(result)) {
    const upFrac = joint.heightFromFloorFeet / result.wallHeightFeet;
    if (upFrac <= EPSILON || upFrac >= 1 - EPSILON) {
      continue;
    }
    for (const flap of flaps) {
      const start = flap.point(0, upFrac);
      const end = flap.point(1, upFrac);
      page.drawLine({
        start,
        end,
        thickness: LINE_WIDTH_PT,
        color: BLACK,
        dashArray: [4, 2],
      });
      if (flap.wall === "UP") {
        // Label INSIDE the flap (the outside lane belongs to callout
        // leaders), right-aligned above the dashed line; fall back to the
        // left side when an opening sits under it.
        const label = joint.keyed ? "KEYED JOINT" : "JOINT";
        const labelWidth = font.widthOfTextAtSize(label, SMALL_FONT_SIZE_PT);
        const labelY = Math.min(start.y, end.y) + 2;
        let labelX = flap.x + flap.width - labelWidth - 4;
        const collides = upRects.some(
          (rect) =>
            labelX < rect.x + rect.width &&
            labelX + labelWidth > rect.x &&
            labelY < rect.y + rect.height &&
            labelY + SMALL_FONT_SIZE_PT > rect.y,
        );
        if (collides) {
          labelX = flap.x + (hasSectionChain ? 44 : 4);
        }
        page.drawText(label, {
          x: labelX,
          y: labelY,
          size: SMALL_FONT_SIZE_PT,
          font,
          color: BLACK,
        });
      }
    }
  }
}

/**
 * Section joint lines across the elevation view's wall band when the
 * structure is split into pieces.
 */
function drawElevationJoints(
  marker: MarkerRect,
  result: RectStructureResult,
): void {
  if (result.wallHeightFeet <= EPSILON) {
    return;
  }
  for (const joint of sectionJointHeightsFeet(result)) {
    const frac = joint.heightFromFloorFeet / result.wallHeightFeet;
    if (frac <= EPSILON || frac >= 1 - EPSILON) {
      continue;
    }
    const y = marker.y + frac * marker.height;
    marker.page.drawLine({
      start: { x: marker.x, y },
      end: { x: marker.x + marker.width, y },
      thickness: OPENING_LINE_WIDTH_PT,
      color: BLACK,
    });
  }
}

/**
 * Per-section height dimensions inside the Up wall's flap when the
 * structure is split: a chained dimension along the flap's left edge with
 * arrowheads at every joint and the section height beside each segment.
 */
function drawSectionDimsOnUpFlap(
  flaps: Flap[],
  result: RectStructureResult,
  page: PDFPage,
  font: PDFFont,
): void {
  if (result.sections.length < 2 || result.wallHeightFeet <= EPSILON) {
    return;
  }
  const flap = flaps.find((entry) => entry.wall === "UP");
  if (!flap) {
    return;
  }
  const dimX = flap.x + 14;
  const upRects = result.openings
    .filter((opening) => opening.wall === "UP")
    .map((opening) => openingRectOnFlap(flap, opening, result))
    .filter((rect): rect is PageRect => rect != null);

  let cursorFeet = 0;
  for (const section of result.sections) {
    const y0 = flap.y + (cursorFeet / result.wallHeightFeet) * flap.height;
    cursorFeet += section.heightFeet;
    const y1 = flap.y + (cursorFeet / result.wallHeightFeet) * flap.height;

    page.drawLine({
      start: { x: dimX, y: y0 },
      end: { x: dimX, y: y1 },
      thickness: 0.7,
      color: BLACK,
    });
    if (y1 - y0 > ARROW_LENGTH_PT * 2 + 2) {
      drawArrowhead(page, dimX, y0, dimX, y1);
      drawArrowhead(page, dimX, y1, dimX, y0);
    }
    const text = `${Math.round(section.heightFeet * 12)}"`;
    const textX = dimX + 4;
    const textWidth = font.widthOfTextAtSize(text, CALLOUT_FONT_SIZE_PT);
    // A wide opening can cover the section's midpoint; slide the label up or
    // down within its section to the first spot clear of every knockout.
    const midY = (y0 + y1) / 2 - CALLOUT_FONT_SIZE_PT * 0.36;
    const candidates = [midY];
    for (const rect of upRects) {
      candidates.push(rect.y - CALLOUT_FONT_SIZE_PT - 3);
      candidates.push(rect.y + rect.height + 3);
    }
    const clearY = candidates.find(
      (candidate) =>
        candidate >= y0 + 2 &&
        candidate + CALLOUT_FONT_SIZE_PT <= y1 - 2 &&
        !upRects.some(
          (rect) =>
            textX < rect.x + rect.width &&
            textX + textWidth > rect.x &&
            candidate < rect.y + rect.height &&
            candidate + CALLOUT_FONT_SIZE_PT > rect.y,
        ),
    );
    page.drawText(text, {
      x: textX,
      y: clearY ?? midY,
      size: CALLOUT_FONT_SIZE_PT,
      font,
      color: BLACK,
    });
  }
}

/** Access opening inside the top-slab square marker. */
function drawTopSlabOpening(
  marker: MarkerRect,
  result: RectStructureResult,
  font: PDFFont,
): void {
  const rect = topSlabOpeningRect(result);
  if (!rect) {
    return;
  }
  const { page } = marker;
  const x = marker.x + rect.x * marker.width;
  const y = marker.y + marker.height - (rect.y + rect.height) * marker.height;
  const width = rect.width * marker.width;
  const height = rect.height * marker.height;

  drawOpeningKnockout(page, { x, y, width, height });

  const label = `${result.topSlabOpening?.lengthInches ?? ""}"x${result.topSlabOpening?.widthInches ?? ""}"`;
  page.drawText(label, {
    x: x + width / 2 - font.widthOfTextAtSize(label, LABEL_FONT_SIZE_PT) / 2,
    y: y - LABEL_FONT_SIZE_PT - 2,
    size: LABEL_FONT_SIZE_PT,
    font,
    color: BLACK,
  });
}

/**
 * Fills the template's text fields and draws the dynamic line work on the
 * marker fields. Returns the modified PDF bytes (fields still interactive;
 * run flattenPdfForms afterwards to bake them in).
 */
export async function fillRectSheetTemplatePdf(
  templateBytes: Uint8Array,
  fieldMap: Record<string, string>,
  result: RectStructureResult,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const [name, value] of Object.entries(fieldMap)) {
    try {
      const field = form.getTextField(name);
      field.setText(value);
    } catch {
      // Field not present in this template variant — skip.
    }
  }

  const exploded = await consumeMarkerField(
    form,
    doc,
    RECT_EXPLODED_MARKER_FIELD,
  );
  const center = await consumeMarkerField(
    form,
    doc,
    RECT_EXPLODED_CENTER_MARKER_FIELD,
  );
  if (exploded && center) {
    const flaps = buildFlaps(exploded, center);
    drawOpeningsOnFlaps(flaps, exploded, center, result, exploded.page, font);
    drawJointsOnFlaps(flaps, result, exploded.page, font);
    drawSectionDimsOnUpFlap(flaps, result, exploded.page, font);
  }

  const elevationWalls = await consumeMarkerField(
    form,
    doc,
    RECT_ELEVATION_WALL_MARKER_FIELD,
  );
  if (elevationWalls) {
    drawElevationJoints(elevationWalls, result);
  }

  if (result.hasTopSlab) {
    const topSlabBox = await consumeMarkerField(
      form,
      doc,
      RECT_TOP_SLAB_MARKER_FIELD,
    );
    if (topSlabBox) {
      drawTopSlabOpening(topSlabBox, result, font);
    }
  }

  return doc.save();
}
