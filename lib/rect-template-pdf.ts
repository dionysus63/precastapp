// Fills a rectangular-structure template PDF (AcroForm) and draws the
// app-generated line work.
//
// The template (Nick's fillable PDFs, enriched with markers by
// scripts/import-rect-sheet-pdfs.ts) carries the static artwork plus text
// fields; marker fields tell the app where to draw (see
// lib/rect-template-pdf-fields.ts):
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
    catch_basin_name: meta.structureNumber,
    wall_thickness: wholeInches(result.wallThicknessFeet),
    base: baseNote,
    casting: meta.castingName ?? "",
    // Exploded view dims
    length: wholeInches(result.insideLengthFeet),
    width: wholeInches(result.insideWidthFeet),
    height: wholeInches(result.wallHeightFeet),
    // Elevation thickness stack
    casting_thickness_inches: wholeInches(result.castingHeightFeet),
    brick_thickness_inches: wholeInches(result.brickFeet),
    top_slab_thickness_inches: result.hasTopSlab
      ? wholeInches(result.topSlabThicknessFeet)
      : "",
    base_slab_thickness_inches: result.hasBaseSlab
      ? wholeInches(result.baseSlabThicknessFeet)
      : "",
    // Elevation ladder. Walls end at the bottom of the top slab (when there
    // is one) and start at the floor (top of base slab, or grade).
    rim_elevation: feet2(rim),
    bottom_casting_elevation: feet2(bottomCasting),
    top_of_top_slab_elevation: result.hasTopSlab ? feet2(topSlabTop) : "",
    top_of_wall_elevation: result.hasTopSlab
      ? feet2(topSlabBottom)
      : feet2(topSlabTop),
    bottom_of_wall_elevation: feet2(result.floorElevation),
    bottom_of_bottom_slab_elevation:
      result.hasBaseSlab && result.floorElevation != null
        ? feet2(result.floorElevation - result.baseSlabThicknessFeet)
        : "",
    // Top slab detail box (outside dims; slab is flush with the walls)
    top_slab_length: result.hasTopSlab
      ? wholeInches(result.outsideLengthFeet)
      : "",
    top_slab_width: result.hasTopSlab
      ? wholeInches(result.outsideWidthFeet)
      : "",
    // Piece weights
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

/** Width reserved right of the section chain line for its inch labels. */
const SECTION_CHAIN_CLEARANCE_PT = 36;

/**
 * Vertical/horizontal dimension from the fold line (top of base slab) to the
 * opening's bottom edge, with arrowheads and the `+N"` value beside it, run
 * on the opening's centerline. When another opening on the same wall blocks
 * that run there is no clean place for the line or its text (it tangles with
 * the section chain and the neighbor's callout leader), so the dimension is
 * omitted — the callout's `@ +N"` line already states the value.
 *
 * Returns the drawn extent (line + text) so later passes can treat it as an
 * obstacle, or null when the dimension was omitted.
 */
function drawFoldDimension(
  page: PDFPage,
  font: PDFFont,
  flap: Flap,
  rect: PageRect,
  offsetInches: number,
  otherRects: PageRect[],
  chainX: number | null,
): PageRect | null {
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
      return null;
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
      chainX != null && flap.wall === "UP"
        ? chainX + SECTION_CHAIN_CLEARANCE_PT
        : flap.x + 2;
    const textX =
      dimX - textWidth - 4 >= chainZone ? dimX - textWidth - 4 : dimX + 4;
    const textY = (foldY + openY) / 2 - CALLOUT_FONT_SIZE_PT * 0.36;
    page.drawText(text, {
      x: textX,
      y: textY,
      size: CALLOUT_FONT_SIZE_PT,
      font,
      color: BLACK,
    });
    const x0 = Math.min(dimX - ARROW_HALF_WIDTH_PT, textX);
    const y0 = Math.min(yLo, textY);
    return {
      x: x0,
      y: y0,
      width: Math.max(dimX + ARROW_HALF_WIDTH_PT, textX + textWidth) - x0,
      height: Math.max(yHi, textY + CALLOUT_FONT_SIZE_PT) - y0,
    };
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
    return null;
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
  const textX = (foldX + openX) / 2 - textWidth / 2;
  const textY = dimY + 4;
  page.drawText(text, {
    x: textX,
    y: textY,
    size: CALLOUT_FONT_SIZE_PT,
    font,
    color: BLACK,
  });
  const x0 = Math.min(xLo, textX);
  const y0 = dimY - ARROW_HALF_WIDTH_PT;
  return {
    x: x0,
    y: y0,
    width: Math.max(xHi, textX + textWidth) - x0,
    height: textY + CALLOUT_FONT_SIZE_PT - y0,
  };
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
//   - each callout prefers a slot whose leader clears every knockout and
//     fold dimension; among clear slots it takes the one nearest its
//     opening, keeping leaders short;
//   - fold dimensions dodge other openings on the same wall;
//   - the section chain slides right when a knockout covers the flap's left
//     edge, and joint labels take the widest clear gap along their line.
// ---------------------------------------------------------------------------

type PlannedOpening = {
  opening: ComputedRectOpening;
  flap: Flap;
  rect: PageRect;
  index: number;
};

/** What the exploded-view opening pass produced, for the joint/chain passes. */
type ExplodedDrawInfo = {
  /** X of the section chain line on the Up flap (null when no split). */
  chainX: number | null;
  /** Knockouts + fold-dimension extents on the Up flap. */
  upFlapObstacles: PageRect[];
  /** Knockouts + fold-dimension extents on the Down flap. */
  downFlapObstacles: PageRect[];
};

/** True when the segment passes through the rect (inflated by pad). */
function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: PageRect,
  pad: number,
): boolean {
  // Liang-Barsky clip of the parametric segment against the inflated box.
  const loX = rect.x - pad;
  const hiX = rect.x + rect.width + pad;
  const loY = rect.y - pad;
  const hiY = rect.y + rect.height + pad;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const clips: [number, number][] = [
    [-dx, x1 - loX],
    [dx, hiX - x1],
    [-dy, y1 - loY],
    [dy, hiY - y1],
  ];
  for (const [p, q] of clips) {
    if (Math.abs(p) < EPSILON) {
      if (q < 0) {
        return false;
      }
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) {
        return false;
      }
      if (r > t0) {
        t0 = r;
      }
    } else {
      if (r < t0) {
        return false;
      }
      if (r < t1) {
        t1 = r;
      }
    }
  }
  // Ignore endpoint grazes (the leader's tip touches its own target edge).
  return t1 - t0 > 0.02;
}

/** Text/geometry shared by a callout block and its leader prediction. */
type CalloutLayout = {
  letter: string;
  sizeText: string;
  offsetText: string | null;
  location: string | null;
  blockHalfWidth: number;
  /** Badge center's drop below the block's top edge. */
  badgeDrop: number;
};

function calloutLayout(entry: PlannedOpening, font: PDFFont): CalloutLayout {
  const { opening, index } = entry;
  const letter = opening.label?.trim() || String.fromCharCode(65 + index);
  const sizeText =
    opening.openingWidthInches != null && opening.openingHeightInches != null
      ? `${opening.openingWidthInches}"x${opening.openingHeightInches}"`
      : letter;
  const offsetText = baseOffsetText(opening);
  const location = locationText(opening);
  const textDrop =
    CALLOUT_FONT_SIZE_PT +
    (offsetText ? CALLOUT_LINE_GAP_PT : 0) +
    (location ? 3 + CALLOUT_LOCATION_FONT_SIZE_PT : 0);
  const blockHalfWidth =
    Math.max(
      font.widthOfTextAtSize(sizeText, CALLOUT_FONT_SIZE_PT),
      offsetText ? font.widthOfTextAtSize(offsetText, CALLOUT_FONT_SIZE_PT) : 0,
    ) / 2;
  return {
    letter,
    sizeText,
    offsetText,
    location,
    blockHalfWidth,
    badgeDrop: textDrop + 6 + BADGE_RADIUS_PT,
  };
}

/** The leader a callout at (blockCx, blockTopY) would draw to its opening. */
function leaderSegmentFor(
  entry: PlannedOpening,
  layout: CalloutLayout,
  blockCx: number,
  blockTopY: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const { rect } = entry;
  const badgeCy = blockTopY - layout.badgeDrop;
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
  const startX =
    targetX < blockCx
      ? blockCx - layout.blockHalfWidth - 3
      : targetX > blockCx
        ? blockCx + layout.blockHalfWidth + 3
        : blockCx;
  return { x1: startX, y1: blockCyMid, x2: targetX, y2: targetY };
}

/**
 * X for the section chain line on the Up flap: the leftmost vertical strip
 * clear of every knockout (the chain spans the full flap height).
 */
function sectionChainX(flap: Flap, knockouts: PageRect[]): number {
  const base = flap.x + 14;
  const limit = flap.x + flap.width / 2;
  for (let x = base; x <= limit; x += 4) {
    const blocked = knockouts.some(
      (rect) =>
        x + ARROW_HALF_WIDTH_PT + 2 > rect.x &&
        x - ARROW_HALF_WIDTH_PT - 2 < rect.x + rect.width,
    );
    if (!blocked) {
      return x;
    }
  }
  return base;
}

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
): ExplodedDrawInfo {
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
  const upFlap = flaps.find((entry) => entry.wall === "UP") ?? null;
  const upKnockouts = rectsByWall.get("UP") ?? [];
  // The chain X is settled first so fold dimensions can keep clear of it.
  const chainX =
    hasSectionChain && upFlap ? sectionChainX(upFlap, upKnockouts) : null;

  // Knockouts + fold dimensions (with same-wall avoidance). Fold dims report
  // their drawn extents so leader routing can dodge them too.
  const foldDimRects: PageRect[] = [];
  for (const entry of planned) {
    drawOpeningKnockout(page, entry.rect);
    const offsetInches = entry.opening.floorToOpeningBottomInches;
    if (offsetInches != null && offsetInches > 0) {
      const others = (rectsByWall.get(entry.flap.wall) ?? []).filter(
        (rect) => rect !== entry.rect,
      );
      const drawn = drawFoldDimension(
        page,
        font,
        entry.flap,
        entry.rect,
        offsetInches,
        others,
        chainX,
      );
      if (drawn) {
        foldDimRects.push(drawn);
      }
    }
  }

  const obstacles = [...planned.map((entry) => entry.rect), ...foldDimRects];

  // Callout columns: Left-wall openings hang on the west side, everything
  // else on the east side.
  const slotTops = calloutSlotTops(exploded, center);
  const eastLaneCx =
    center.x + center.width + (exploded.x + exploded.width - center.x - center.width) / 2;
  // The west quadrants keep the static size dimensions near their inner
  // edge, so the west lane sits toward the outer page edge.
  const westLaneCx = exploded.x + (center.x - exploded.x) * 0.32;

  const sides: { list: PlannedOpening[]; laneCx: number; slots: number[] }[] = [
    {
      list: planned.filter((entry) => entry.flap.wall !== "LEFT"),
      laneCx: eastLaneCx,
      slots: slotTops,
    },
    {
      // The upper-west quadrant holds the TOP SLAB detail box on the sheet
      // artwork (all variants), so west callouts only use the below-cross
      // slots.
      list: planned.filter((entry) => entry.flap.wall === "LEFT"),
      laneCx: westLaneCx,
      slots: slotTops.slice(2),
    },
  ];

  for (const side of sides) {
    if (side.list.length === 0) {
      continue;
    }
    // Top-most opening gets the top-most slot, preserving vertical order so
    // leaders on a side never cross each other. Among order-preserving
    // choices, prefer slots whose leader clears every knockout and fold
    // dimension; among those, take the slot nearest the opening.
    const ordered = [...side.list].sort(
      (a, b) => b.rect.y + b.rect.height / 2 - (a.rect.y + a.rect.height / 2),
    );
    let nextSlot = 0;
    ordered.forEach((entry, position) => {
      const layout = calloutLayout(entry, font);
      const remaining = ordered.length - position;
      const lastUsable = Math.max(side.slots.length - remaining, nextSlot);
      let bestIdx = Math.min(nextSlot, side.slots.length - 1);
      let bestDist = Number.POSITIVE_INFINITY;
      let bestClearIdx = -1;
      let bestClearDist = Number.POSITIVE_INFINITY;
      for (
        let idx = nextSlot;
        idx <= Math.min(lastUsable, side.slots.length - 1);
        idx += 1
      ) {
        const blockMidY = side.slots[idx] - 26;
        const dist = Math.abs(blockMidY - (entry.rect.y + entry.rect.height / 2));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
        const seg = leaderSegmentFor(entry, layout, side.laneCx, side.slots[idx]);
        const crosses = obstacles.some(
          (rect) =>
            rect !== entry.rect &&
            segmentIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, rect, 2),
        );
        if (!crosses && dist < bestClearDist) {
          bestClearDist = dist;
          bestClearIdx = idx;
        }
      }
      const chosen = bestClearIdx >= 0 ? bestClearIdx : bestIdx;
      nextSlot = chosen + 1;
      drawCalloutBlock(page, font, entry, layout, side.laneCx, side.slots[chosen]);
    });
  }

  const obstaclesOn = (flap: Flap | null, knockouts: PageRect[]) =>
    flap
      ? [
          ...knockouts,
          ...foldDimRects.filter(
            (rect) =>
              rect.x < flap.x + flap.width &&
              rect.x + rect.width > flap.x &&
              rect.y < flap.y + flap.height &&
              rect.y + rect.height > flap.y,
          ),
        ]
      : [];
  const downFlap = flaps.find((entry) => entry.wall === "DOWN") ?? null;
  return {
    chainX,
    upFlapObstacles: obstaclesOn(upFlap, upKnockouts),
    downFlapObstacles: obstaclesOn(downFlap, rectsByWall.get("DOWN") ?? []),
  };
}

/** One callout block (size / offset / location / circled letter) + leader. */
function drawCalloutBlock(
  page: PDFPage,
  font: PDFFont,
  entry: PlannedOpening,
  layout: CalloutLayout,
  blockCx: number,
  blockTopY: number,
): void {
  const { letter, sizeText, offsetText, location } = layout;

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
  // with an arrowhead. Same geometry the slot planner predicted.
  const seg = leaderSegmentFor(entry, layout, blockCx, blockTopY);
  page.drawLine({
    start: { x: seg.x1, y: seg.y1 },
    end: { x: seg.x2, y: seg.y2 },
    thickness: 0.7,
    color: BLACK,
  });
  drawArrowhead(page, seg.x2, seg.y2, seg.x1, seg.y1);
}

/** Section joint lines across every flap, labeled on the Up wall's flap. */
function drawJointsOnFlaps(
  flaps: Flap[],
  result: RectStructureResult,
  page: PDFPage,
  font: PDFFont,
  drawInfo: ExplodedDrawInfo,
): void {
  if (result.wallHeightFeet <= EPSILON) {
    return;
  }

  const upFlap = flaps.find((flap) => flap.wall === "UP") ?? null;
  const downFlap = flaps.find((flap) => flap.wall === "DOWN") ?? null;

  // Rightmost spot along the flap's joint line clear of knockouts, fold
  // dimensions, and (on the Up flap) the section chain; null when the whole
  // line is covered.
  const clearLabelX = (
    flap: Flap,
    obstacles: PageRect[],
    chainX: number | null,
    labelY: number,
    labelWidth: number,
  ): number | null => {
    const blocked = obstacles
      .filter(
        (rect) =>
          labelY < rect.y + rect.height + 2 &&
          labelY + SMALL_FONT_SIZE_PT > rect.y - 2,
      )
      .map((rect) => ({ lo: rect.x - 3, hi: rect.x + rect.width + 3 }));
    if (chainX != null) {
      blocked.push({ lo: flap.x, hi: chainX + SECTION_CHAIN_CLEARANCE_PT });
    }
    blocked.sort((a, b) => a.lo - b.lo);

    const gaps: { lo: number; hi: number }[] = [];
    let cursor = flap.x + 4;
    const rightEdge = flap.x + flap.width - 4;
    for (const zone of blocked) {
      if (zone.lo > cursor) {
        gaps.push({ lo: cursor, hi: Math.min(zone.lo, rightEdge) });
      }
      cursor = Math.max(cursor, zone.hi);
    }
    if (cursor < rightEdge) {
      gaps.push({ lo: cursor, hi: rightEdge });
    }
    const fit = [...gaps]
      .reverse()
      .find((gap) => gap.hi - gap.lo >= labelWidth + 2);
    return fit ? Math.max(fit.lo + 1, fit.hi - labelWidth - 1) : null;
  };

  for (const joint of sectionJointHeightsFeet(result)) {
    const upFrac = joint.heightFromFloorFeet / result.wallHeightFeet;
    if (upFrac <= EPSILON || upFrac >= 1 - EPSILON) {
      continue;
    }
    for (const flap of flaps) {
      page.drawLine({
        start: flap.point(0, upFrac),
        end: flap.point(1, upFrac),
        thickness: LINE_WIDTH_PT,
        color: BLACK,
        dashArray: [4, 2],
      });
    }

    // Label INSIDE a flap (the outside lane belongs to callout leaders),
    // just above the dashed line: the Up flap's rightmost clear gap, the
    // Down flap's when a wide knockout covers the Up line entirely, and
    // right-aligned on the Up flap as the all-blocked fallback.
    const label = joint.keyed ? "KEYED JOINT" : "JOINT";
    const labelWidth = font.widthOfTextAtSize(label, SMALL_FONT_SIZE_PT);
    let spot: { x: number; y: number } | null = null;
    if (upFlap) {
      const labelY = Math.min(upFlap.point(0, upFrac).y, upFlap.point(1, upFrac).y) + 2;
      const x = clearLabelX(
        upFlap,
        drawInfo.upFlapObstacles,
        drawInfo.chainX,
        labelY,
        labelWidth,
      );
      if (x != null) {
        spot = { x, y: labelY };
      }
    }
    if (!spot && downFlap) {
      const labelY =
        Math.min(downFlap.point(0, upFrac).y, downFlap.point(1, upFrac).y) + 2;
      const x = clearLabelX(
        downFlap,
        drawInfo.downFlapObstacles,
        null,
        labelY,
        labelWidth,
      );
      if (x != null) {
        spot = { x, y: labelY };
      }
    }
    if (!spot && upFlap) {
      // Every flap's line is covered (only possible when an opening crosses
      // the joint, which computeRectStructure already warns about): sit
      // right-aligned above whatever covers that corner instead of printing
      // through the knockout's X.
      const x = upFlap.x + upFlap.width - labelWidth - 4;
      let y = Math.min(upFlap.point(0, upFrac).y, upFlap.point(1, upFrac).y) + 2;
      for (const rect of drawInfo.upFlapObstacles) {
        if (
          x < rect.x + rect.width &&
          x + labelWidth > rect.x &&
          y < rect.y + rect.height &&
          y + SMALL_FONT_SIZE_PT > rect.y
        ) {
          y = Math.max(y, rect.y + rect.height + 2);
        }
      }
      spot = { x, y };
    }
    if (spot) {
      page.drawText(label, {
        x: spot.x,
        y: spot.y,
        size: SMALL_FONT_SIZE_PT,
        font,
        color: BLACK,
      });
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
  drawInfo: ExplodedDrawInfo,
): void {
  if (result.sections.length < 2 || result.wallHeightFeet <= EPSILON) {
    return;
  }
  const flap = flaps.find((entry) => entry.wall === "UP");
  if (!flap) {
    return;
  }
  const dimX = drawInfo.chainX ?? flap.x + 14;
  const upRects = drawInfo.upFlapObstacles;

  // Knockouts the chain's strip still crosses (when the whole scan range was
  // blocked): the line breaks around them instead of running through.
  const strip = upRects.filter(
    (rect) =>
      dimX + ARROW_HALF_WIDTH_PT > rect.x &&
      dimX - ARROW_HALF_WIDTH_PT < rect.x + rect.width,
  );
  const insideStrip = (y: number) =>
    strip.some((rect) => y > rect.y - 2 && y < rect.y + rect.height + 2);

  let cursorFeet = 0;
  for (const section of result.sections) {
    const y0 = flap.y + (cursorFeet / result.wallHeightFeet) * flap.height;
    cursorFeet += section.heightFeet;
    const y1 = flap.y + (cursorFeet / result.wallHeightFeet) * flap.height;

    // Split the segment at knockout edges and draw only the clear runs.
    const cuts = [y0, y1];
    for (const rect of strip) {
      if (rect.y > y0 && rect.y < y1) {
        cuts.push(rect.y);
      }
      if (rect.y + rect.height > y0 && rect.y + rect.height < y1) {
        cuts.push(rect.y + rect.height);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const mid = (cuts[i] + cuts[i + 1]) / 2;
      if (!insideStrip(mid)) {
        page.drawLine({
          start: { x: dimX, y: cuts[i] },
          end: { x: dimX, y: cuts[i + 1] },
          thickness: 0.7,
          color: BLACK,
        });
      }
    }
    if (y1 - y0 > ARROW_LENGTH_PT * 2 + 2) {
      if (!insideStrip(y0 + 1)) {
        drawArrowhead(page, dimX, y0, dimX, y1);
      }
      if (!insideStrip(y1 - 1)) {
        drawArrowhead(page, dimX, y1, dimX, y0);
      }
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

function fixedFontSizeFor(fieldName: string): number {
  if (fieldName.startsWith("weight_")) {
    return 7;
  }
  if (fieldName.startsWith("type_")) {
    return 8;
  }
  return 10;
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
      // Acrobat-authored fields often use auto-size ("0 Tf"); pdf-lib then
      // scales short values to fill the widget height, so pin a sane size.
      const da = field.acroField.getDefaultAppearance() ?? "";
      if (/\b0(?:\.0+)?\s+Tf\b/.test(da)) {
        field.setFontSize(fixedFontSizeFor(name));
      }
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
    const drawInfo = drawOpeningsOnFlaps(
      flaps,
      exploded,
      center,
      result,
      exploded.page,
      font,
    );
    drawJointsOnFlaps(flaps, result, exploded.page, font, drawInfo);
    drawSectionDimsOnUpFlap(flaps, result, exploded.page, font, drawInfo);
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
