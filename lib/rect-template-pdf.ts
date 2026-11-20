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
  degrees,
  rgb,
} from "pdf-lib";
import { PDF_SAVE_OPTIONS } from "@/lib/pdf-save-options";
import type { RectSheetPreviewMeta } from "@/components/drill-sheets/rect-sheet-preview";
import {
  planOpeningSpanFraction,
  sectionJointHeightsFeet,
  topSlabOpeningRect,
} from "@/lib/rect-structure-diagram";
import {
  formatPounds,
  wallInsideRunFeet,
  type ComputedRectOpening,
  type ComputedRectSteps,
  type RectStructureResult,
  type RectWall,
} from "@/lib/rect-structure";
import { RECT_STEP_SPACING_INCHES } from "@/lib/rect-steps";
import {
  RECT_ELEVATION_WALL_MARKER_FIELD,
  RECT_EXPLODED_CENTER_MARKER_FIELD,
  RECT_EXPLODED_MARKER_FIELD,
  RECT_OPENING_ROWS,
  RECT_TOP_SLAB_MARKER_FIELD,
  RECT_WEIGHT_PIECE_LINES,
} from "@/lib/rect-template-pdf-fields";
import { toWinAnsiText } from "@/lib/pdf-text";
import { PIN_CONTRACT_FIELD } from "@/lib/sheet-pin-contract";

const LINE_WIDTH_PT = 0.8;
const OPENING_LINE_WIDTH_PT = 1;
const LABEL_FONT_SIZE_PT = 8;
const SMALL_FONT_SIZE_PT = 6.5;
const BLACK = rgb(0, 0, 0);
const EPSILON = 1e-6;

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
  // Round to whole pounds first: stored thicknesses carry rounding dust
  // (8" -> 0.6667') that would bump an exact 3,500.00 up to 3,600.
  const rounded = Math.ceil(Math.round(lbs) / 100) * 100;
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
    // NYSDOT jobs only; drawings without the blank skip it.
    [PIN_CONTRACT_FIELD]: meta.pinContractNumber ?? "",
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
/** Clearance between a callout block's edge and the start of its leader. */
const LEADER_BLOCK_GAP_PT = 3;
/**
 * Knockouts draw at this fraction of their to-scale along-wall span (the
 * height follows from the opening's aspect ratio). Full-scale boxes crowded
 * the top of the wall band — a 24"x24" opening 20" up a 48" wall drew to
 * within a hair of the flap's outer edge — and left no room for the
 * leaders and dimensions around them. The bottom edge stays to scale so
 * fold dimensions remain honest, and touch-end openings keep touching. An
 * opening that spans the whole wall is not reduced, so it meets both ends.
 */
const OPENING_DRAW_SCALE = 0.7;

type PageRect = { x: number; y: number; width: number; height: number };

/**
 * Opening rectangle on its flap in page coordinates. The along-wall span and
 * the bottom edge are to scale (placement and fold dimensions stay honest);
 * the drawn height comes from the opening's true width:height ratio so a
 * square opening prints square and the long side is obvious — the flap's two
 * axes use different scales, so projecting both to scale would distort every
 * opening.
 */
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
  const upPtPerFrac = Math.max(
    flap.verticalWall ? flap.height : flap.width,
    EPSILON,
  );
  // Reduced along-wall span: shrink about the opening's center, but an
  // opening placed against a wall end stays against it.
  const touchesStart = span.startFraction <= EPSILON;
  const touchesEnd = span.endFraction >= 1 - EPSILON;
  // An opening as wide as the wall touches both ends, so it draws at its
  // full span; shrinking it would pull it off one of them.
  const spanLength =
    touchesStart && touchesEnd
      ? 1
      : (span.endFraction - span.startFraction) * OPENING_DRAW_SCALE;
  let alongLo: number;
  if (touchesStart) {
    alongLo = 0;
  } else if (touchesEnd) {
    alongLo = 1 - spanLength;
  } else {
    alongLo = (span.startFraction + span.endFraction) / 2 - spanLength / 2;
  }
  alongLo = Math.min(Math.max(alongLo, 0), 1 - spanLength);
  const alongHi = alongLo + spanLength;
  let upLo = Math.max(
    (opening.bottomOfOpeningFeet - result.floorElevation) /
      result.wallHeightFeet,
    0,
  );
  // A tight but nonzero floor offset (e.g. +2") leaves no room for the fold
  // dimension's arrowheads. The exploded view is not to scale, so lift the
  // drawn bottom edge until the dimension has room to read; the printed
  // inches stay true.
  if (
    (opening.floorToOpeningBottomInches ?? 0) > 0 &&
    upLo > EPSILON &&
    upLo * upPtPerFrac < MIN_FOLD_DIM_PT
  ) {
    upLo = Math.min(MIN_FOLD_DIM_PT / upPtPerFrac, 0.35);
  }
  let upHi = Math.min(
    (opening.topOfOpeningFeet - result.floorElevation) / result.wallHeightFeet,
    1,
  );
  if (
    opening.openingWidthInches != null &&
    opening.openingWidthInches > EPSILON &&
    opening.openingHeightInches != null
  ) {
    const alongPtPerFrac = flap.verticalWall ? flap.width : flap.height;
    const alongPt = (alongHi - alongLo) * alongPtPerFrac;
    const heightPt =
      alongPt * (opening.openingHeightInches / opening.openingWidthInches);
    upHi = Math.min(upLo + heightPt / upPtPerFrac, 1);

    // The taller-than-scale box must not swallow a same-wall neighbor above:
    // two openings with real physical clearance would otherwise draw as
    // colliding knockouts. Neighbor bottoms are always drawn at their
    // physical height, so cap against those (with a small visual gap).
    const gapFrac = 2 / upPtPerFrac;
    for (const other of result.openings) {
      if (
        other === opening ||
        other.wall !== opening.wall ||
        other.bottomOfOpeningFeet == null ||
        other.bottomOfOpeningFeet <=
          opening.bottomOfOpeningFeet + EPSILON ||
        other.leftEdgeInches == null ||
        other.rightEdgeInches == null ||
        opening.leftEdgeInches == null ||
        opening.rightEdgeInches == null ||
        other.leftEdgeInches >= opening.rightEdgeInches - EPSILON ||
        opening.leftEdgeInches >= other.rightEdgeInches - EPSILON
      ) {
        continue;
      }
      const otherBottomFrac =
        (other.bottomOfOpeningFeet - result.floorElevation) /
        result.wallHeightFeet;
      upHi = Math.min(upHi, otherBottomFrac - gapFrac);
    }
    // Keep a visible box even when a neighbor sits physically tight above.
    upHi = Math.max(upHi, upLo + gapFrac);
  }

  // Open-top block-outs run to the top of the walls: the drawn box must
  // visibly TOUCH the flap's outer edge, aspect ratio notwithstanding.
  if (opening.extendsToTop) {
    upHi = 1;
  }

  const p1 = flap.point(alongLo, upLo);
  const p2 = flap.point(alongHi, upHi);
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.max(Math.abs(p2.x - p1.x), 5),
    height: Math.max(Math.abs(p2.y - p1.y), 5),
  };
}

/**
 * Knockout symbol: the opening rectangle with an X through it. An open-top
 * block-out (extends to the top of the walls) omits the edge on the wall's
 * top side — the notch is open there, and drawing it open is what makes the
 * condition legible on the sheet.
 */
type OpenEdge = "top" | "bottom" | "left" | "right" | null;

function drawOpeningKnockout(
  page: PDFPage,
  rect: PageRect,
  openEdge: OpenEdge = null,
): void {
  const x0 = rect.x;
  const x1 = rect.x + rect.width;
  const y0 = rect.y;
  const y1 = rect.y + rect.height;
  if (openEdge == null) {
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      borderColor: BLACK,
      borderWidth: OPENING_LINE_WIDTH_PT,
    });
  } else {
    const edges: Record<
      Exclude<OpenEdge, null>,
      [{ x: number; y: number }, { x: number; y: number }]
    > = {
      top: [
        { x: x0, y: y1 },
        { x: x1, y: y1 },
      ],
      bottom: [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
      ],
      left: [
        { x: x0, y: y0 },
        { x: x0, y: y1 },
      ],
      right: [
        { x: x1, y: y0 },
        { x: x1, y: y1 },
      ],
    };
    for (const [edge, [start, end]] of Object.entries(edges) as [
      Exclude<OpenEdge, null>,
      [{ x: number; y: number }, { x: number; y: number }],
    ][]) {
      if (edge === openEdge) {
        continue;
      }
      page.drawLine({
        start,
        end,
        thickness: OPENING_LINE_WIDTH_PT,
        color: BLACK,
      });
    }
  }
  page.drawLine({
    start: { x: x0, y: y0 },
    end: { x: x1, y: y1 },
    thickness: LINE_WIDTH_PT,
    color: BLACK,
  });
  page.drawLine({
    start: { x: x0, y: y1 },
    end: { x: x1, y: y0 },
    thickness: LINE_WIDTH_PT,
    color: BLACK,
  });
}

/** Page-side of the flap's OUTER edge (top of the wall) for open-top boxes. */
function flapOuterEdge(wall: RectWall): Exclude<OpenEdge, null> {
  switch (wall) {
    case "UP":
      return "top";
    case "DOWN":
      return "bottom";
    case "RIGHT":
      return "right";
    case "LEFT":
      return "left";
  }
}

/** CAD-style filled arrowhead with its apex at (tipX, tipY). */
const ARROW_LENGTH_PT = 7;
const ARROW_HALF_WIDTH_PT = 2.6;
/** Minimum drawn fold-dimension gap: room for both arrowheads plus a hair. */
const MIN_FOLD_DIM_PT = 22;

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
  textObstacles: PageRect[],
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
    // Text sits left of the line unless that would leave the flap, hit the
    // section-dimension chain along the Up flap's left edge, or land on a
    // neighboring knockout (the line dodges same-wall openings; the text
    // must too).
    const chainZone =
      chainX != null && flap.wall === "UP"
        ? chainX + SECTION_CHAIN_CLEARANCE_PT
        : flap.x + 2;
    const textY = (foldY + openY) / 2 - CALLOUT_FONT_SIZE_PT * 0.36;
    const textClearAt = (x: number) =>
      !textObstacles.some(
        (other) =>
          x < other.x + other.width + 2 &&
          x + textWidth > other.x - 2 &&
          textY < other.y + other.height + 2 &&
          textY + CALLOUT_FONT_SIZE_PT > other.y - 2,
      );
    const leftX = dimX - textWidth - 4;
    const rightX = dimX + 4;
    const textX =
      leftX >= chainZone && textClearAt(leftX)
        ? leftX
        : textClearAt(rightX)
          ? rightX
          : leftX >= chainZone
            ? leftX
            : rightX;
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
  // Text sits above the line, or below when a neighboring knockout covers
  // the spot above.
  const textX = (foldX + openX) / 2 - textWidth / 2;
  const sideClearAt = (y: number) =>
    !textObstacles.some(
      (other) =>
        textX < other.x + other.width + 2 &&
        textX + textWidth > other.x - 2 &&
        y < other.y + other.height + 2 &&
        y + CALLOUT_FONT_SIZE_PT > other.y - 2,
    );
  const aboveY = dimY + 4;
  const belowY = dimY - CALLOUT_FONT_SIZE_PT - 4;
  const textY = sideClearAt(aboveY)
    ? aboveY
    : sideClearAt(belowY)
      ? belowY
      : aboveY;
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
  /**
   * Which end of the Up flap the chain runs at. Left unless steps take the
   * left end of the Up wall; the chain's inch labels sit on its inner side.
   */
  chainSide: "left" | "right";
  /** Knockouts + fold-dimension extents on the Up flap. */
  upFlapObstacles: PageRect[];
  /** Knockouts + fold-dimension extents on the Down flap. */
  downFlapObstacles: PageRect[];
  /**
   * Display up-fraction per section joint (aligned with
   * sectionJointHeightsFeet). Aspect-true knockouts draw taller than scale,
   * so a box that physically sits inside one piece can poke past its
   * joint's true position; the drawn joint line slides clear (the chain and
   * rail carry the true inches — the exploded view is not to scale).
   */
  jointDisplayFracs: number[];
  /**
   * Callout leaders the section chain's labels must keep off. Only filled
   * on a sheet with steps (steps move leaders to slots they would not
   * otherwise take); a sheet without steps prints as it always has.
   */
  leaderSegs: LeaderSeg[];
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

/**
 * The leader a callout at (blockCx, blockTopY) would draw to its opening.
 * Every leader aims at the CENTER of its knockout and stops at the box edge,
 * so the arrowhead lands mid-edge rather than wherever the lane happens to
 * line up. A callout beside its knockout leaves from the block's near side
 * at mid-height. A callout above or below its knockout (the usual case for
 * the Left/Right walls, whose boxes sit in the side flaps' band) leaves from
 * the block's top or bottom edge instead: a leader through the middle of the
 * block ran straight through the size text and the circled letter.
 */
function leaderSegmentFor(
  entry: PlannedOpening,
  layout: CalloutLayout,
  blockCx: number,
  blockTopY: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const { rect } = entry;
  const badgeCy = blockTopY - layout.badgeDrop;
  const blockBottomY = badgeCy - BADGE_RADIUS_PT;
  const blockCyMid = (blockTopY + blockBottomY) / 2;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  // The knockout sits over the block's text column: a side exit would cross
  // the text, so leave vertically from whichever edge faces the knockout.
  const overlapsColumn =
    Math.abs(centerX - blockCx) <= layout.blockHalfWidth + 3;
  let startX: number;
  let startY: number;
  if (overlapsColumn && centerY >= blockTopY) {
    startX = blockCx;
    startY = blockTopY + LEADER_BLOCK_GAP_PT;
  } else if (overlapsColumn && centerY <= blockBottomY) {
    startX = blockCx;
    startY = blockBottomY - LEADER_BLOCK_GAP_PT;
  } else {
    startX =
      centerX < blockCx
        ? blockCx - layout.blockHalfWidth - LEADER_BLOCK_GAP_PT
        : blockCx + layout.blockHalfWidth + LEADER_BLOCK_GAP_PT;
    startY = blockCyMid;
  }

  const tip = clipToRectEdge(startX, startY, centerX, centerY, rect);
  return { x1: startX, y1: startY, x2: tip.x, y2: tip.y };
}

/**
 * Point where the segment from (x1, y1) to the rect's interior point
 * (x2, y2) first crosses the rect's edge. Falls back to the interior point
 * when the start is already inside the rect.
 */
function clipToRectEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: PageRect,
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tEnter = 0;
  if (Math.abs(dx) > EPSILON) {
    const tx = ((dx > 0 ? rect.x : rect.x + rect.width) - x1) / dx;
    tEnter = Math.max(tEnter, tx);
  }
  if (Math.abs(dy) > EPSILON) {
    const ty = ((dy > 0 ? rect.y : rect.y + rect.height) - y1) / dy;
    tEnter = Math.max(tEnter, ty);
  }
  tEnter = Math.min(tEnter, 1);
  return { x: x1 + dx * tEnter, y: y1 + dy * tEnter };
}

/**
 * X for the section chain line on the Up flap: the leftmost vertical strip
 * clear of every knockout (the chain spans the full flap height).
 */
function sectionChainX(
  flap: Flap,
  knockouts: PageRect[],
  side: "left" | "right" = "left",
): number {
  const blockedAt = (x: number) =>
    knockouts.some(
      (rect) =>
        x + ARROW_HALF_WIDTH_PT + 2 > rect.x &&
        x - ARROW_HALF_WIDTH_PT - 2 < rect.x + rect.width,
    );
  if (side === "right") {
    // Steps hold the left end of the wall: the same scan, mirrored.
    const rightBase = flap.x + flap.width - 14;
    for (let x = rightBase; x >= flap.x + flap.width / 2; x -= 4) {
      if (!blockedAt(x)) {
        return x;
      }
    }
    return rightBase;
  }
  const base = flap.x + 14;
  const limit = flap.x + flap.width / 2;
  for (let x = base; x <= limit; x += 4) {
    if (!blockedAt(x)) {
      return x;
    }
  }
  return base;
}

/** The strip of the Up flap the section chain and its inch labels take. */
function sectionChainZone(
  flap: Flap,
  chainX: number,
  side: "left" | "right",
): { lo: number; hi: number } {
  return side === "right"
    ? { lo: chainX - SECTION_CHAIN_CLEARANCE_PT, hi: flap.x + flap.width }
    : { lo: flap.x, hi: chainX + SECTION_CHAIN_CLEARANCE_PT };
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

// ---------------------------------------------------------------------------
// Manhole steps on a wall flap.
//
// The structure picks one of twelve spots (lib/rect-steps.ts); the steps
// draw on that wall's flap as a column of rungs with a STEPS label at the
// floor end and, when they are off center, a dimension from the closer
// inside corner to their centerline (the template's "Steps From Corner").
//
// The steps and the pipe openings never move: both sit at their true place
// along the wall. Everything else gives way. Callout leaders prefer a slot
// that does not cross the steps, fold-dimension text, joint labels and the
// section chain keep off them, and a rung is left out wherever anything
// else already is (a leader, a joint line, a dimension, a pipe opening the
// steps really cross).
// ---------------------------------------------------------------------------

const STEP_DIM_FONT_SIZE_PT = CALLOUT_FONT_SIZE_PT;
const STEP_LABEL_FONT_SIZE_PT = 7;
const STEP_RUNG_THICKNESS_PT = 1.6;
/** Narrowest the rungs draw, so they still read on a long wall. */
const STEP_MIN_DRAWN_WIDTH_PT = 12;
/** Closest two drawn rungs sit; a tall wall draws every second or third. */
const STEP_MIN_RUNG_GAP_PT = 5;

type LeaderSeg = { x1: number; y1: number; x2: number; y2: number };

type StepsPlan = {
  steps: ComputedRectSteps;
  flap: Flap;
  /** Drawn length of the wall along its run / up its height, in points. */
  alongLen: number;
  upLen: number;
  /** Centerline, in points along the wall from its left inside face. */
  centerA: number;
  halfWidth: number;
  /** Along-coordinate of the closer wall end; null when centered. */
  endA: number | null;
  /** The column the rungs run in, floor to top of wall. */
  strip: PageRect;
  toPage: (a: number, h: number) => { x: number; y: number };
  rect: (a0: number, a1: number, h0: number, h1: number) => PageRect;
  /** Span of a page rect up the wall, in points from the floor. */
  upRange: (rect: PageRect) => { lo: number; hi: number };
};

function inchesText(value: number): string {
  return `${Number(value.toFixed(2))}"`;
}

function rectsOverlap(a: PageRect, b: PageRect, pad: number): boolean {
  return (
    a.x < b.x + b.width + pad &&
    a.x + a.width > b.x - pad &&
    a.y < b.y + b.height + pad &&
    a.y + a.height > b.y - pad
  );
}

function planSteps(flaps: Flap[], result: RectStructureResult): StepsPlan | null {
  const steps = result.steps;
  if (
    !steps ||
    steps.centerInches == null ||
    result.wallHeightFeet <= EPSILON
  ) {
    return null;
  }
  const flap = flaps.find((entry) => entry.wall === steps.wall);
  if (
    !flap ||
    result.insideLengthFeet == null ||
    result.insideWidthFeet == null
  ) {
    return null;
  }
  const runInches =
    wallInsideRunFeet(
      steps.wall,
      result.insideLengthFeet,
      result.insideWidthFeet,
    ) * 12;
  if (!(runInches > EPSILON)) {
    return null;
  }
  const alongLen = flap.verticalWall ? flap.width : flap.height;
  const upLen = flap.verticalWall ? flap.height : flap.width;
  if (alongLen <= EPSILON || upLen <= EPSILON) {
    return null;
  }
  const toPage = (a: number, h: number) => flap.point(a / alongLen, h / upLen);
  const rect = (a0: number, a1: number, h0: number, h1: number): PageRect => {
    const p = toPage(a0, h0);
    const q = toPage(a1, h1);
    return {
      x: Math.min(p.x, q.x),
      y: Math.min(p.y, q.y),
      width: Math.abs(q.x - p.x),
      height: Math.abs(q.y - p.y),
    };
  };
  const floor = toPage(0, 0);
  const upRange = (pageRect: PageRect) => {
    const a = flap.verticalWall
      ? Math.abs(pageRect.y - floor.y)
      : Math.abs(pageRect.x - floor.x);
    const b = flap.verticalWall
      ? Math.abs(pageRect.y + pageRect.height - floor.y)
      : Math.abs(pageRect.x + pageRect.width - floor.x);
    return { lo: Math.min(a, b), hi: Math.max(a, b) };
  };
  // True place along the wall, like the openings. Forcing a minimum drawn
  // distance would slide the steps onto a neighbor's centerline.
  const centerA =
    Math.min(Math.max(steps.centerInches / runInches, 0), 1) * alongLen;
  // Drawn at the openings' reduced width so the two stay in proportion.
  let halfWidth =
    Math.max(
      steps.widthInches * (alongLen / runInches) * OPENING_DRAW_SCALE,
      STEP_MIN_DRAWN_WIDTH_PT,
    ) / 2;
  halfWidth = Math.min(
    halfWidth,
    Math.max(Math.min(centerA, alongLen - centerA), 3),
  );
  const endA =
    steps.offsetInches == null ? null : centerA <= alongLen / 2 ? 0 : alongLen;
  return {
    steps,
    flap,
    alongLen,
    upLen,
    centerA,
    halfWidth,
    endA,
    strip: rect(centerA - halfWidth, centerA + halfWidth, 0, upLen),
    toPage,
    rect,
    upRange,
  };
}

/**
 * Draws one set of steps. `blockers` is everything already on the page that
 * nothing of the steps may touch; `rungBlockers` additionally keeps the
 * rungs and the label out (the height of an opening the steps cross).
 * Returns the extents of what was drawn besides the rungs, so the joint
 * labels and the section chain can keep off them.
 */
function drawSteps(
  page: PDFPage,
  font: PDFFont,
  plan: StepsPlan,
  result: RectStructureResult,
  blockers: PageRect[],
  rungBlockers: PageRect[],
  leaders: LeaderSeg[],
  jointFracs: number[],
): PageRect[] {
  const { steps, flap, upLen, centerA, halfWidth, endA, toPage } = plan;
  const own: PageRect[] = [];
  const inside = (rect: PageRect) =>
    rect.x >= flap.x - 0.5 &&
    rect.y >= flap.y - 0.5 &&
    rect.x + rect.width <= flap.x + flap.width + 0.5 &&
    rect.y + rect.height <= flap.y + flap.height + 0.5;
  // `own` holds the steps' own dimension and label, each already with the
  // room it needs around it, so those are tested without extra padding.
  const clear = (rect: PageRect, pad: number, extra: PageRect[] = []) =>
    ![...blockers, ...extra].some((other) => rectsOverlap(rect, other, pad)) &&
    !own.some((other) => rectsOverlap(rect, other, 0)) &&
    !leaders.some((seg) =>
      segmentIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, rect, pad + 1),
    );
  const jointHs = jointFracs.map((frac) => frac * upLen);
  const crossesJoint = (rect: PageRect, pad: number) => {
    const range = plan.upRange(rect);
    return jointHs.some(
      (jointH) => jointH > range.lo - pad && jointH < range.hi + pad,
    );
  };

  // Dimension from the closer inside corner to the centerline of the steps:
  // as near the top of the wall as it fits, then down to the first clear
  // spot.
  let dimensionDrawn = endA == null;
  if (endA != null && steps.offsetInches != null) {
    const text = inchesText(steps.offsetInches);
    const size = STEP_DIM_FONT_SIZE_PT;
    const textWidth = font.widthOfTextAtSize(text, size);
    const capHeight = size * 0.72;
    for (let h = upLen - 6; h >= 8; h -= 3) {
      const p0 = toPage(endA, h);
      const p1 = toPage(centerA, h);
      let textX: number;
      let textY: number;
      let lineLength: number;
      let dimRect: PageRect;
      if (flap.verticalWall) {
        // Line runs across the page, value above it.
        lineLength = Math.abs(p1.x - p0.x);
        textX =
          lineLength >= textWidth + 4
            ? (p0.x + p1.x) / 2 - textWidth / 2
            : p1.x > p0.x
              ? p0.x + 2
              : p0.x - 2 - textWidth;
        textY = p0.y + 4;
        const x0 = Math.min(p0.x, p1.x, textX);
        const x1 = Math.max(p0.x, p1.x, textX + textWidth);
        dimRect = {
          x: x0,
          y: p0.y - ARROW_HALF_WIDTH_PT,
          width: x1 - x0,
          height: textY + capHeight - (p0.y - ARROW_HALF_WIDTH_PT),
        };
      } else {
        // Line runs up the page, value beside it on the floor side.
        lineLength = Math.abs(p1.y - p0.y);
        textY =
          lineLength >= capHeight + 4
            ? (p0.y + p1.y) / 2 - capHeight / 2
            : p1.y > p0.y
              ? p0.y + 2
              : p0.y - 2 - capHeight;
        textX = flap.wall === "RIGHT" ? p0.x - 4 - textWidth : p0.x + 4;
        const x0 = Math.min(p0.x - ARROW_HALF_WIDTH_PT, textX);
        const x1 = Math.max(p0.x + ARROW_HALF_WIDTH_PT, textX + textWidth);
        const y0 = Math.min(p0.y, p1.y, textY);
        const y1 = Math.max(p0.y, p1.y, textY + capHeight);
        dimRect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      }
      if (!inside(dimRect) || !clear(dimRect, 2) || crossesJoint(dimRect, 2)) {
        continue;
      }
      page.drawLine({ start: p0, end: p1, thickness: 0.7, color: BLACK });
      if (lineLength > ARROW_LENGTH_PT * 2 + 2) {
        drawArrowhead(page, p0.x, p0.y, p1.x, p1.y);
        drawArrowhead(page, p1.x, p1.y, p0.x, p0.y);
      }
      // Tick marking the centerline of the steps. It reaches away from the
      // value so a value wider than the dimension does not sit on it.
      const tickFrom = flap.verticalWall
        ? { x: p1.x, y: p1.y - 8 }
        : { x: flap.wall === "RIGHT" ? p1.x + 8 : p1.x - 8, y: p1.y };
      const tickTo = flap.verticalWall
        ? { x: p1.x, y: p1.y + 2 }
        : { x: flap.wall === "RIGHT" ? p1.x - 2 : p1.x + 2, y: p1.y };
      page.drawLine({
        start: tickFrom,
        end: tickTo,
        thickness: 0.5,
        color: BLACK,
      });
      page.drawText(text, {
        x: textX,
        y: textY,
        size,
        font,
        color: BLACK,
      });
      // The rungs stay out of the whole band the dimension sits in.
      const tickRect: PageRect = {
        x: Math.min(tickFrom.x, tickTo.x) - 1,
        y: Math.min(tickFrom.y, tickTo.y) - 1,
        width: Math.abs(tickTo.x - tickFrom.x) + 2,
        height: Math.abs(tickTo.y - tickFrom.y) + 2,
      };
      const dimRange = plan.upRange(dimRect);
      const tickRange = plan.upRange(tickRect);
      own.push(
        dimRect,
        plan.rect(
          centerA - halfWidth,
          centerA + halfWidth,
          Math.min(dimRange.lo, tickRange.lo),
          Math.max(dimRange.hi, tickRange.hi),
        ),
      );
      dimensionDrawn = true;
      break;
    }
  }

  // Rung heights, to scale up the wall. They are a symbol, not a count: a
  // tall wall draws every second or third so they do not run together.
  const wallInches = result.wallHeightFeet * 12;
  const rungHs: number[] = [];
  if (wallInches > EPSILON) {
    const ptPerInch = upLen / wallInches;
    const every = Math.max(
      1,
      Math.ceil(STEP_MIN_RUNG_GAP_PT / (RECT_STEP_SPACING_INCHES * ptPerInch)),
    );
    const spacing = RECT_STEP_SPACING_INCHES * every;
    for (
      let inches = RECT_STEP_SPACING_INCHES;
      inches <= wallInches - RECT_STEP_SPACING_INCHES / 2;
      inches += spacing
    ) {
      rungHs.push(inches * ptPerInch);
    }
  }

  // STEPS label at the floor end, or the first clear spot up the column. It
  // reads across the page on the Up and Down walls and up the column on the
  // side walls. With no clear spot for the dimension, the label carries the
  // distance in words instead.
  const label =
    dimensionDrawn || steps.offsetInches == null
      ? "STEPS"
      : `STEPS ${inchesText(steps.offsetInches)} FROM CORNER`;
  const labelSizes =
    label === "STEPS" ? [STEP_LABEL_FONT_SIZE_PT] : [6, 5.5, 5];
  // Spots tried in order: in the column, between two rungs (the floor end
  // first) so the label costs no rung; anywhere up the column; then just
  // beside the column, for steps that share their centerline with an
  // opening's dimension.
  const rungBounds = [0, ...rungHs, upLen];
  const gapCenters = rungBounds
    .slice(0, -1)
    .map((low, index) => (low + rungBounds[index + 1]) / 2);
  labelLoop: for (const labelSize of labelSizes) {
    const labelWidth = font.widthOfTextAtSize(label, labelSize);
    const capHeight = labelSize * 0.72;
    // Half of the label's reach up the wall and along it.
    const halfUp = (flap.verticalWall ? capHeight : labelWidth) / 2;
    const halfAlong = (flap.verticalWall ? labelWidth : capHeight) / 2;
    const scan: number[] = [];
    for (let hc = halfUp + 3; hc <= upLen - halfUp - 3; hc += 3) {
      scan.push(hc);
    }
    const beside = halfWidth + halfAlong + 3;
    const spots = [
      // A label running up the column covers a rung wherever it goes, so
      // only one reading across the page looks for a gap.
      ...(flap.verticalWall ? gapCenters : []).map((hc) => ({ hc, shift: 0 })),
      ...scan.map((hc) => ({ hc, shift: 0 })),
      ...scan.flatMap((hc) => [
        { hc, shift: beside },
        { hc, shift: -beside },
      ]),
    ];
    for (const { hc, shift } of spots) {
      if (hc < halfUp + 1 || hc > upLen - halfUp - 1) {
        continue;
      }
      const center = toPage(centerA + shift, hc);
      let labelRect: PageRect;
      if (flap.verticalWall) {
        const x = Math.min(
          Math.max(center.x - labelWidth / 2, flap.x + 2),
          flap.x + flap.width - labelWidth - 2,
        );
        labelRect = {
          x,
          y: center.y - capHeight / 2,
          width: labelWidth,
          height: capHeight,
        };
      } else {
        labelRect = {
          x: center.x - capHeight / 2,
          y: center.y - labelWidth / 2,
          width: capHeight,
          height: labelWidth,
        };
      }
      if (
        !inside(labelRect) ||
        !clear(labelRect, 1.5, rungBlockers) ||
        // Well off a joint line, where it would read as the joint's name.
        crossesJoint(labelRect, 6)
      ) {
        continue;
      }
      if (flap.verticalWall) {
        page.drawText(label, {
          x: labelRect.x,
          y: labelRect.y,
          size: labelSize,
          font,
          color: BLACK,
        });
      } else {
        page.drawText(label, {
          x: labelRect.x + capHeight,
          y: labelRect.y,
          size: labelSize,
          font,
          color: BLACK,
          rotate: degrees(90),
        });
      }
      const range = plan.upRange(labelRect);
      own.push(
        labelRect,
        plan.rect(
          centerA - halfWidth,
          centerA + halfWidth,
          range.lo - 2,
          range.hi + 2,
        ),
      );
      break labelLoop;
    }
  }

  // Rungs: one is left out wherever something else already is.
  for (const h of rungHs) {
    if (jointHs.some((jointH) => Math.abs(jointH - h) < 4)) {
      continue;
    }
    const rungRect = plan.rect(
      centerA - halfWidth,
      centerA + halfWidth,
      h - STEP_RUNG_THICKNESS_PT / 2,
      h + STEP_RUNG_THICKNESS_PT / 2,
    );
    // Kept well off text beside the column: a rung next to a dimension's
    // value would read as part of it.
    if (!clear(rungRect, 4, rungBlockers)) {
      continue;
    }
    page.drawLine({
      start: toPage(centerA - halfWidth, h),
      end: toPage(centerA + halfWidth, h),
      thickness: STEP_RUNG_THICKNESS_PT,
      color: BLACK,
    });
  }
  return own;
}

function drawOpeningsOnFlaps(
  flaps: Flap[],
  exploded: MarkerRect,
  center: MarkerRect,
  result: RectStructureResult,
  page: PDFPage,
  font: PDFFont,
): ExplodedDrawInfo {
  const stepsPlan = planSteps(flaps, result);
  const stepStrips = stepsPlan ? [stepsPlan.strip] : [];
  const leaderSegs: LeaderSeg[] = [];
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
  // Steps at the left end of the Up wall take the chain's usual place, so
  // the chain moves to the right end of the flap.
  const chainSide: "left" | "right" =
    stepsPlan && stepsPlan.flap.wall === "UP" && stepsPlan.endA === 0
      ? "right"
      : "left";
  // The chain X is settled first so fold dimensions can keep clear of it.
  const chainX =
    hasSectionChain && upFlap
      ? sectionChainX(upFlap, upKnockouts, chainSide)
      : null;
  const chainZone =
    chainX != null && upFlap
      ? sectionChainZone(upFlap, chainX, chainSide)
      : null;
  const chainZoneRect: PageRect | null =
    chainZone && upFlap
      ? {
          x: chainZone.lo,
          y: upFlap.y,
          width: chainZone.hi - chainZone.lo,
          height: upFlap.height,
        }
      : null;

  // Knockouts + fold dimensions (with same-wall avoidance). Fold dims report
  // their drawn extents so leader routing can dodge them too. Text placement
  // additionally avoids the centerline strips where same-wall neighbors'
  // dimension lines run (drawn later in this loop) and already-drawn dims.
  const foldDimRects: PageRect[] = [];
  const dimStripFor = (entry: PlannedOpening): PageRect | null => {
    const offsetInches = entry.opening.floorToOpeningBottomInches;
    if (offsetInches == null || offsetInches <= 0) {
      return null;
    }
    const { flap, rect } = entry;
    if (flap.wall === "UP" || flap.wall === "DOWN") {
      const foldY = flap.wall === "UP" ? flap.y : flap.y + flap.height;
      const openY = flap.wall === "UP" ? rect.y : rect.y + rect.height;
      const cx = rect.x + rect.width / 2;
      return {
        x: cx - 2.5,
        y: Math.min(foldY, openY),
        width: 5,
        height: Math.abs(openY - foldY),
      };
    }
    const foldX = flap.wall === "RIGHT" ? flap.x : flap.x + flap.width;
    const openX = flap.wall === "RIGHT" ? rect.x : rect.x + rect.width;
    const cy = rect.y + rect.height / 2;
    return {
      x: Math.min(foldX, openX),
      y: cy - 2.5,
      width: Math.abs(openX - foldX),
      height: 5,
    };
  };
  for (const entry of planned) {
    drawOpeningKnockout(
      page,
      entry.rect,
      entry.opening.extendsToTop ? flapOuterEdge(entry.flap.wall) : null,
    );
    const offsetInches = entry.opening.floorToOpeningBottomInches;
    if (offsetInches != null && offsetInches > 0) {
      const others = (rectsByWall.get(entry.flap.wall) ?? []).filter(
        (rect) => rect !== entry.rect,
      );
      const neighborStrips = planned
        .filter((other) => other !== entry && other.flap === entry.flap)
        .map(dimStripFor)
        .filter((strip): strip is PageRect => strip != null);
      const drawn = drawFoldDimension(
        page,
        font,
        entry.flap,
        entry.rect,
        offsetInches,
        others,
        [
          ...others,
          ...neighborStrips,
          ...foldDimRects,
          ...stepStrips,
          // A chain at the right end is one more thing the text keeps off;
          // at the left end drawFoldDimension handles it from chainX.
          ...(chainSide === "right" &&
          chainZoneRect &&
          entry.flap.wall === "UP"
            ? [chainZoneRect]
            : []),
        ],
        chainSide === "left" ? chainX : null,
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

  // Gap kept between one callout's badge and the next callout's first line.
  const CALLOUT_STACK_GAP_PT = 6;

  // Places one side's callouts. Top-most opening gets the top-most slot,
  // preserving vertical order so leaders on a side never cross each other;
  // among order-preserving choices, prefer slots whose leader clears every
  // knockout and fold dimension, then the slot nearest the opening. Slot
  // tops are clamped below the previous callout's actual bottom (blocks
  // with a location line are taller than the anchor pitch). Entries whose
  // leader cannot route cleanly are handed to `deferTo` when given.
  // Blocks already drawn on either lane: later leaders must not cross them.
  const placedBlocks: PageRect[] = [];

  const placeSide = (
    side: { list: PlannedOpening[]; laneCx: number; slots: number[] },
    deferTo?: PlannedOpening[],
  ): void => {
    if (side.list.length === 0) {
      return;
    }
    // Ties (same-height openings on one wall) fan out: on the east lane the
    // upper slot serves the knockout nearer the lane, so the leaders never
    // scissor; mirrored for the west lane.
    const nearLane = (entry: PlannedOpening) =>
      Math.abs(side.laneCx - (entry.rect.x + entry.rect.width / 2));
    const ordered = [...side.list].sort((a, b) => {
      const midDelta =
        b.rect.y + b.rect.height / 2 - (a.rect.y + a.rect.height / 2);
      if (Math.abs(midDelta) > 1) {
        return midDelta;
      }
      return nearLane(a) - nearLane(b);
    });
    let nextSlot = 0;
    let prevBottom = Number.POSITIVE_INFINITY;
    ordered.forEach((entry, position) => {
      const layout = calloutLayout(entry, font);
      const remaining = ordered.length - position;
      const lastUsable = Math.max(side.slots.length - remaining, nextSlot);
      const topAt = (idx: number) =>
        Math.min(side.slots[idx], prevBottom - CALLOUT_STACK_GAP_PT);
      let bestIdx = Math.min(nextSlot, side.slots.length - 1);
      let bestDist = Number.POSITIVE_INFINITY;
      let bestClearIdx = -1;
      let bestClearDist = Number.POSITIVE_INFINITY;
      let bestFreeIdx = -1;
      let bestFreeDist = Number.POSITIVE_INFINITY;
      for (
        let idx = nextSlot;
        idx <= Math.min(lastUsable, side.slots.length - 1);
        idx += 1
      ) {
        const top = topAt(idx);
        const blockMidY = top - 26;
        const dist = Math.abs(blockMidY - (entry.rect.y + entry.rect.height / 2));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
        const seg = leaderSegmentFor(entry, layout, side.laneCx, top);
        // Reject slots whose leader passes through an obstacle (knockouts,
        // fold dims, already-placed callout blocks) OR whose arrowhead tip
        // lands inside one (the tip sits on the entry's own knockout edge,
        // which can fall in a neighbor's fold-dim text).
        const crosses = [...obstacles, ...placedBlocks].some(
          (rect) =>
            rect !== entry.rect &&
            (segmentIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, rect, 2) ||
              (seg.x2 >= rect.x - 2 &&
                seg.x2 <= rect.x + rect.width + 2 &&
                seg.y2 >= rect.y - 2 &&
                seg.y2 <= rect.y + rect.height + 2)),
        );
        if (!crosses && dist < bestClearDist) {
          bestClearDist = dist;
          bestClearIdx = idx;
        }
        // Steps are a soft obstacle: a leader may cross them (the rungs give
        // way), but a slot that keeps clear of them wins.
        if (
          !crosses &&
          stepStrips.length > 0 &&
          dist < bestFreeDist &&
          !stepStrips.some((strip) =>
            segmentIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, strip, 1),
          )
        ) {
          bestFreeDist = dist;
          bestFreeIdx = idx;
        }
      }
      if (bestFreeIdx >= 0) {
        bestClearIdx = bestFreeIdx;
      }
      if (bestClearIdx < 0 && deferTo) {
        deferTo.push(entry);
        return;
      }
      const chosen = bestClearIdx >= 0 ? bestClearIdx : bestIdx;
      const chosenTop = topAt(chosen);
      nextSlot = chosen + 1;
      drawCalloutBlock(page, font, entry, layout, side.laneCx, chosenTop);
      leaderSegs.push(leaderSegmentFor(entry, layout, side.laneCx, chosenTop));
      prevBottom = chosenTop - (layout.badgeDrop + BADGE_RADIUS_PT);
      placedBlocks.push({
        x: side.laneCx - layout.blockHalfWidth,
        y: prevBottom,
        width: layout.blockHalfWidth * 2,
        height: chosenTop - prevBottom,
      });
    });
  };

  // West lane first: it only has the below-cross slots (the upper-west
  // quadrant holds the TOP SLAB detail box), so stacked left-wall openings
  // that cannot route cleanly there overflow to the east column instead.
  const overflow: PlannedOpening[] = [];
  placeSide(
    {
      list: planned.filter((entry) => entry.flap.wall === "LEFT"),
      laneCx: westLaneCx,
      slots: slotTops.slice(2),
    },
    overflow,
  );
  placeSide({
    list: [
      ...planned.filter((entry) => entry.flap.wall !== "LEFT"),
      ...overflow,
    ],
    laneCx: eastLaneCx,
    slots: slotTops,
  });

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

  // Joint display positions: keep each joint's line clear of knockouts that
  // physically belong to one piece but draw taller than scale. A joint only
  // moves within the corridor left between the drawn boxes below and above
  // it; when the corridor is empty (a box really crosses, already warned)
  // it stays at the true position.
  const jointDisplayFracs = sectionJointHeightsFeet(result).map((joint) => {
    const trueFrac =
      result.wallHeightFeet > EPSILON
        ? joint.heightFromFloorFeet / result.wallHeightFeet
        : 0;
    if (result.floorElevation == null || result.wallHeightFeet <= EPSILON) {
      return trueFrac;
    }
    let lo = 0.02;
    let hi = 0.98;
    for (const entry of planned) {
      const opening = entry.opening;
      if (
        opening.bottomOfOpeningFeet == null ||
        opening.topOfOpeningFeet == null
      ) {
        continue;
      }
      const upPtPerFrac = Math.max(
        entry.flap.verticalWall ? entry.flap.height : entry.flap.width,
        EPSILON,
      );
      const gapFrac = 3 / upPtPerFrac;
      const bottomFrac =
        (opening.bottomOfOpeningFeet - result.floorElevation) /
        result.wallHeightFeet;
      const drawnHeightFrac =
        (entry.flap.verticalWall ? entry.rect.height : entry.rect.width) /
        upPtPerFrac;
      const physicalTop = opening.topOfOpeningFeet - result.floorElevation;
      if (physicalTop <= joint.heightFromFloorFeet + EPSILON) {
        // Physically below the joint: the drawn line must clear the box top.
        lo = Math.max(lo, bottomFrac + drawnHeightFrac + gapFrac);
      } else if (
        opening.bottomOfOpeningFeet - result.floorElevation >=
        joint.heightFromFloorFeet - EPSILON
      ) {
        // Physically above: bottoms are always drawn to scale.
        hi = Math.min(hi, bottomFrac - gapFrac);
      }
    }
    return lo <= hi ? Math.min(Math.max(trueFrac, lo), hi) : trueFrac;
  });
  // Preserve joint order when neighboring adjustments collide.
  for (let i = 1; i < jointDisplayFracs.length; i += 1) {
    jointDisplayFracs[i] = Math.max(
      jointDisplayFracs[i],
      jointDisplayFracs[i - 1] + 0.03,
    );
  }

  // Steps go on last, around everything already placed.
  const stepExtents: PageRect[] = [];
  if (stepsPlan) {
    // An opening the steps really cross keeps the rungs out over its whole
    // height, even where the reduced boxes leave a sliver between the two.
    const crossed = new Set(stepsPlan.steps.crossesOpenings);
    const rungBlockers = planned
      .filter(
        (entry) =>
          entry.flap === stepsPlan.flap &&
          crossed.has(
            entry.opening.label?.trim() ||
              String.fromCharCode(65 + entry.index),
          ),
      )
      .map((entry) => {
        const range = stepsPlan.upRange(entry.rect);
        return stepsPlan.rect(
          stepsPlan.centerA - stepsPlan.halfWidth,
          stepsPlan.centerA + stepsPlan.halfWidth,
          range.lo,
          range.hi,
        );
      });
    stepExtents.push(
      stepsPlan.strip,
      ...drawSteps(
        page,
        font,
        stepsPlan,
        result,
        [
          ...obstacles,
          // The chain line and the reach of its inch labels (a little
          // less than the zone other text is kept out of, so steps in
          // the middle of a short wall keep their label).
          ...(chainZoneRect && stepsPlan.flap.wall === "UP"
            ? [
                {
                  ...chainZoneRect,
                  x: chainZoneRect.x + (chainSide === "right" ? 5 : 0),
                  width: chainZoneRect.width - 5,
                },
              ]
            : []),
        ],
        rungBlockers,
        leaderSegs,
        jointDisplayFracs,
      ),
    );
  }
  const stepExtentsOn = (flap: Flap | null) =>
    flap && stepsPlan?.flap === flap ? stepExtents : [];

  return {
    chainX,
    chainSide,
    upFlapObstacles: [
      ...obstaclesOn(upFlap, upKnockouts),
      ...stepExtentsOn(upFlap),
    ],
    downFlapObstacles: [
      ...obstaclesOn(downFlap, rectsByWall.get("DOWN") ?? []),
      ...stepExtentsOn(downFlap),
    ],
    jointDisplayFracs,
    leaderSegs: stepsPlan ? leaderSegs : [],
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
  // Labels already drawn for earlier joints: two blocked joints can both
  // reach the same fallback spot and overprint, leaving a joint unlabeled.
  const placedLabels: PageRect[] = [];

  // Rightmost spot along the flap's joint line clear of knockouts, fold
  // dimensions, and (on the Up flap) the section chain; null when the whole
  // line is covered.
  const clearLabelX = (
    flap: Flap,
    obstacles: PageRect[],
    chainZone: { lo: number; hi: number } | null,
    labelY: number,
    labelWidth: number,
  ): number | null => {
    const blocked = obstacles
      .filter(
        (rect) =>
          labelY < rect.y + rect.height + 2 &&
          labelY + SMALL_FONT_SIZE_PT > rect.y - 2,
      )
      .map((rect) => ({ lo: rect.x - 2, hi: rect.x + rect.width + 2 }));
    if (chainZone != null) {
      blocked.push(chainZone);
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

  const joints = sectionJointHeightsFeet(result);
  for (let jointIndex = 0; jointIndex < joints.length; jointIndex += 1) {
    const joint = joints[jointIndex];
    const trueFrac = joint.heightFromFloorFeet / result.wallHeightFeet;
    if (trueFrac <= EPSILON || trueFrac >= 1 - EPSILON) {
      continue;
    }
    // Lines draw at the display position (slid clear of taller-than-scale
    // knockouts); the chain and rail carry the true inches.
    const upFrac = drawInfo.jointDisplayFracs[jointIndex] ?? trueFrac;
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
    // Down flap's when a wide knockout covers the Up line entirely —
    // shrinking the font a step at a time when the gaps are tight — and
    // right-aligned on the Up flap as the all-blocked fallback.
    const label = joint.keyed ? "KEYED JOINT" : "JOINT";
    let labelSize = SMALL_FONT_SIZE_PT;
    let labelWidth = font.widthOfTextAtSize(label, labelSize);
    let spot: { x: number; y: number } | null = null;
    sizes: for (const size of [SMALL_FONT_SIZE_PT, 5.5, 5, 4.5]) {
      const width = font.widthOfTextAtSize(label, size);
      const flapsToTry: {
        flap: Flap | null;
        obstacles: PageRect[];
        chainZone: { lo: number; hi: number } | null;
      }[] = [
        {
          flap: upFlap,
          obstacles: drawInfo.upFlapObstacles,
          chainZone:
            upFlap && drawInfo.chainX != null
              ? sectionChainZone(upFlap, drawInfo.chainX, drawInfo.chainSide)
              : null,
        },
        { flap: downFlap, obstacles: drawInfo.downFlapObstacles, chainZone: null },
      ];
      for (const attempt of flapsToTry) {
        if (!attempt.flap) {
          continue;
        }
        const labelY =
          Math.min(
            attempt.flap.point(0, upFrac).y,
            attempt.flap.point(1, upFrac).y,
          ) + 2;
        const x = clearLabelX(
          attempt.flap,
          attempt.obstacles,
          attempt.chainZone,
          labelY,
          width,
        );
        if (x != null) {
          spot = { x, y: labelY };
          labelSize = size;
          labelWidth = width;
          break sizes;
        }
      }
    }
    if (!spot && upFlap) {
      // No in-flap gap at any size: sit just OUTSIDE the Up flap's right
      // edge on the line's extension (drafting style), in the corridor
      // before the callout lane.
      const outsideSize = 5.5;
      const outsideWidth = font.widthOfTextAtSize(label, outsideSize);
      spot = {
        x: upFlap.x + upFlap.width + 3,
        y:
          Math.min(upFlap.point(0, upFrac).y, upFlap.point(1, upFrac).y) + 2,
      };
      labelSize = outsideSize;
      labelWidth = outsideWidth;
    }
    if (spot) {
      const overlapsPlaced = (x: number, y: number) =>
        placedLabels.some(
          (rect) =>
            x < rect.x + rect.width + 2 &&
            x + labelWidth > rect.x - 2 &&
            y < rect.y + rect.height + 2 &&
            y + labelSize > rect.y - 2,
        );
      if (overlapsPlaced(spot.x, spot.y)) {
        // Slide below the dashed line, else stack above the colliding label.
        const belowY = spot.y - labelSize - 4;
        if (!overlapsPlaced(spot.x, belowY)) {
          spot = { x: spot.x, y: belowY };
        } else {
          const highest = Math.max(
            ...placedLabels
              .filter(
                (rect) =>
                  spot!.x < rect.x + rect.width && spot!.x + labelWidth > rect.x,
              )
              .map((rect) => rect.y + rect.height),
          );
          spot = { x: spot.x, y: highest + 2 };
        }
      }
      placedLabels.push({
        x: spot.x,
        y: spot.y,
        width: labelWidth,
        height: labelSize,
      });
      page.drawText(label, {
        x: spot.x,
        y: spot.y,
        size: labelSize,
        font,
        color: BLACK,
      });
    }
  }
}

// Left dimension-rail geometry on the elevation view, measured from the
// sheet artwork relative to the rect_elevation_walls marker: the rail runs
// 19.3pt left of the wall band, artwork ticks span [x-25.1, x-5.8] with a
// 6.4 x 5.2pt slash centered on the rail.
const ELEV_RAIL_OFFSET_PT = 19.3;
const ELEV_TICK_LEFT_PT = 25.1;
const ELEV_TICK_RIGHT_PT = 5.8;
const ELEV_SLASH_HALF_X_PT = 3.2;
const ELEV_SLASH_HALF_Y_PT = 2.6;
const ELEV_HEIGHT_FONT_SIZE_PT = 10;

/**
 * Wall height(s) in inches beside the elevation view's left dimension rail:
 * one value per piece, with an artwork-style tick (horizontal line + slash)
 * at each section joint so the rail reads like the rest of the ladder.
 */
function drawElevationWallHeights(
  marker: MarkerRect,
  result: RectStructureResult,
  font: PDFFont,
): void {
  if (result.wallHeightFeet <= EPSILON) {
    return;
  }
  const { page } = marker;
  const railX = marker.x - ELEV_RAIL_OFFSET_PT;
  const boundariesFeet = [
    0,
    ...sectionJointHeightsFeet(result)
      .map((joint) => joint.heightFromFloorFeet)
      .filter(
        (feet) => feet > EPSILON && feet < result.wallHeightFeet - EPSILON,
      ),
    result.wallHeightFeet,
  ];
  const yOf = (feet: number) =>
    marker.y + (feet / result.wallHeightFeet) * marker.height;

  // Joint ticks (the band's ends already have artwork ticks): a thin
  // extension line with a bold down-right slash, matching the artwork's
  // stroke weights and slash direction.
  for (let i = 1; i < boundariesFeet.length - 1; i += 1) {
    const y = yOf(boundariesFeet[i]);
    page.drawLine({
      start: { x: marker.x - ELEV_TICK_LEFT_PT, y },
      end: { x: marker.x - ELEV_TICK_RIGHT_PT, y },
      thickness: 0.3,
      color: BLACK,
    });
    page.drawLine({
      start: { x: railX - ELEV_SLASH_HALF_X_PT, y: y + ELEV_SLASH_HALF_Y_PT },
      end: { x: railX + ELEV_SLASH_HALF_X_PT, y: y - ELEV_SLASH_HALF_Y_PT },
      thickness: 1.3,
      color: BLACK,
    });
  }

  // One height per rail segment, right-aligned just left of the rail.
  for (let i = 0; i < boundariesFeet.length - 1; i += 1) {
    const segmentFeet = boundariesFeet[i + 1] - boundariesFeet[i];
    const text = `${Math.round(segmentFeet * 12)}"`;
    const width = font.widthOfTextAtSize(text, ELEV_HEIGHT_FONT_SIZE_PT);
    const midY = (yOf(boundariesFeet[i]) + yOf(boundariesFeet[i + 1])) / 2;
    page.drawText(text, {
      x: railX - 4 - width,
      y: midY - ELEV_HEIGHT_FONT_SIZE_PT * 0.36,
      size: ELEV_HEIGHT_FONT_SIZE_PT,
      font,
      color: BLACK,
    });
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

  // Segment boundaries follow the DISPLAY joint positions so the chain
  // arrows meet the dashed joint lines; the printed inches stay true.
  const boundaryFracs = [
    0,
    ...drawInfo.jointDisplayFracs.slice(0, result.sections.length - 1),
    1,
  ];
  for (const [index, section] of result.sections.entries()) {
    const y0 = flap.y + (boundaryFracs[index] ?? 0) * flap.height;
    const y1 = flap.y + (boundaryFracs[index + 1] ?? 1) * flap.height;

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
    const textWidth = font.widthOfTextAtSize(text, CALLOUT_FONT_SIZE_PT);
    // A wide opening can cover the section's midpoint; slide the label up or
    // down within its section — and to the left of the line when the right
    // side is covered — to the first spot clear of every knockout.
    const midY = (y0 + y1) / 2 - CALLOUT_FONT_SIZE_PT * 0.36;
    const yCandidates = [midY];
    for (const rect of upRects) {
      yCandidates.push(rect.y - CALLOUT_FONT_SIZE_PT - 3);
      yCandidates.push(rect.y + rect.height + 3);
    }
    // Labels sit on the chain's inner side first: right of a chain at the
    // left end of the flap, left of one at the right end.
    const onRight = drawInfo.chainSide === "right";
    const xCandidates = onRight
      ? [dimX - textWidth - 4, dimX + 4]
      : [dimX + 4, dimX - textWidth - 4];
    let spot: { x: number; y: number } | null = null;
    outer: for (const y of yCandidates) {
      if (y < y0 + 2 || y + CALLOUT_FONT_SIZE_PT > y1 - 2) {
        continue;
      }
      for (const x of xCandidates) {
        if (
          x < flap.x + 2 ||
          (onRight && x + textWidth > flap.x + flap.width - 2)
        ) {
          continue;
        }
        const clear =
          !upRects.some(
            (rect) =>
              x < rect.x + rect.width &&
              x + textWidth > rect.x &&
              y < rect.y + rect.height &&
              y + CALLOUT_FONT_SIZE_PT > rect.y,
          ) &&
          !drawInfo.leaderSegs.some((seg) =>
            segmentIntersectsRect(
              seg.x1,
              seg.y1,
              seg.x2,
              seg.y2,
              { x, y, width: textWidth, height: CALLOUT_FONT_SIZE_PT * 0.8 },
              2,
            ),
          );
        if (clear) {
          spot = { x, y };
          break outer;
        }
      }
    }
    // A knockout can cover the whole section at every candidate; rather than
    // print inside its X, step just outside the flap's left edge (blank page
    // between the total-height dim and the cross).
    // A chain at the right end steps outside the right edge instead.
    if (!spot) {
      spot = {
        x: onRight ? flap.x + flap.width + 3 : flap.x - textWidth - 3,
        y: midY,
      };
    }
    page.drawText(text, {
      x: spot.x,
      y: spot.y,
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
  let x = marker.x + rect.x * marker.width;
  let y = marker.y + marker.height - (rect.y + rect.height) * marker.height;
  let width = rect.width * marker.width;
  let height = rect.height * marker.height;

  // The slab box artwork is square while the slab usually isn't, so the
  // per-axis fractions distort the opening. Rescale uniformly to the true
  // length:width ratio (never growing past the original footprint), keeping
  // the wall-touching edge in place and centering on the other axis.
  const lengthInches = result.topSlabOpening?.lengthInches;
  const widthInches = result.topSlabOpening?.widthInches;
  if (
    lengthInches != null &&
    lengthInches > EPSILON &&
    widthInches != null &&
    widthInches > EPSILON
  ) {
    const scale = Math.min(width / lengthInches, height / widthInches);
    const newWidth = lengthInches * scale;
    const newHeight = widthInches * scale;
    switch (result.topSlabOpening?.side ?? "UP") {
      case "DOWN": // bottom edge stays on the wall
        x += (width - newWidth) / 2;
        break;
      case "LEFT": // left edge stays
        y += (height - newHeight) / 2;
        break;
      case "RIGHT": // right edge stays
        x += width - newWidth;
        y += (height - newHeight) / 2;
        break;
      default: // UP: top edge stays on the wall
        x += (width - newWidth) / 2;
        y += height - newHeight;
        break;
    }
    width = newWidth;
    height = newHeight;
  }

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
 * Height-calculation block, drawn (not a template field — the rect template
 * PDFs never carried calc fields) in the blank strip between the openings
 * table and the customer-approval line. Mirrors the circular sheets' calc
 * ladder: rim down to wall height in decimal feet.
 */
const CALC_BLOCK_X_PT = 300;
const CALC_BLOCK_TOP_PT = 158;
/** Values print centered on a shared axis just right of the labels. */
const CALC_BLOCK_VALUE_CENTER_PT = 368;
const CALC_LINE_STEP_PT = 11.5;
const CALC_FONT_SIZE_PT = 8;
const CALC_TITLE_FONT_SIZE_PT = 9;
/** Half-width of the sum lines drawn under Low Invert and Brick (-). */
const CALC_SUM_LINE_HALF_PT = 17;

function drawHeightCalcBlock(
  page: PDFPage,
  result: RectStructureResult,
  font: PDFFont,
): number {
  // The third element marks the worksheet-style sum line drawn under the
  // value: Rim - Low Invert => Invert to Top, and the run down through
  // Brick (-) => Wall Height.
  const rows: [string, number | null, boolean?][] = [
    ["Rim Elevation", result.rimElevation],
    ["Low Invert", result.lowInvertElevation, true],
    ["Invert to Top", result.invertToTopFeet],
    ["Casting (-)", result.castingHeightFeet],
    ...(result.hasTopSlab
      ? ([["Top Slab (-)", result.topSlabThicknessFeet]] as [
          string,
          number | null,
        ][])
      : []),
    ["Sump (+)", result.sumpFeet],
    ["Brick (-)", result.brickFeet, true],
    ["Wall Height", result.wallHeightFeet],
  ];

  let y = CALC_BLOCK_TOP_PT;
  const title = "HEIGHT CALCULATION";
  page.drawText(title, {
    x: CALC_BLOCK_X_PT,
    y,
    size: CALC_TITLE_FONT_SIZE_PT,
    font,
    color: BLACK,
  });
  page.drawLine({
    start: { x: CALC_BLOCK_X_PT, y: y - 2 },
    end: {
      x:
        CALC_BLOCK_X_PT + font.widthOfTextAtSize(title, CALC_TITLE_FONT_SIZE_PT),
      y: y - 2,
    },
    thickness: 0.6,
    color: BLACK,
  });
  y -= CALC_LINE_STEP_PT + 2;

  for (const [label, value, sumLine] of rows) {
    if (value == null) {
      continue;
    }
    page.drawText(label, {
      x: CALC_BLOCK_X_PT,
      y,
      size: CALC_FONT_SIZE_PT,
      font,
      color: BLACK,
    });
    const text = value.toFixed(2);
    page.drawText(text, {
      x:
        CALC_BLOCK_VALUE_CENTER_PT -
        font.widthOfTextAtSize(text, CALC_FONT_SIZE_PT) / 2,
      y,
      size: CALC_FONT_SIZE_PT,
      font,
      color: BLACK,
    });
    if (sumLine) {
      page.drawLine({
        start: { x: CALC_BLOCK_VALUE_CENTER_PT - CALC_SUM_LINE_HALF_PT, y: y - 2.5 },
        end: { x: CALC_BLOCK_VALUE_CENTER_PT + CALC_SUM_LINE_HALF_PT, y: y - 2.5 },
        thickness: 0.6,
        color: BLACK,
      });
    }
    y -= CALC_LINE_STEP_PT;
  }
  return y;
}

/**
 * Pipe-fit errors printed IN RED under the height-calculation block: the
 * pipe physically tops out above the walls, so the sheet cannot be built as
 * drawn. Wrapped to the same blank strip the calc block lives in.
 */
const ERROR_COLOR = rgb(0.8, 0, 0);
const ERROR_FONT_SIZE_PT = 7.5;
const ERROR_LINE_STEP_PT = 9.5;
const ERROR_WRAP_WIDTH_PT = 190;

function drawPipeErrors(
  page: PDFPage,
  errors: string[],
  font: PDFFont,
  startY: number,
): void {
  if (errors.length === 0) {
    return;
  }
  let y = startY - 3;
  for (const error of errors) {
    const words = `ERROR: ${error}`.split(/\s+/);
    let line = "";
    const flush = () => {
      if (!line) {
        return;
      }
      page.drawText(line, {
        x: CALC_BLOCK_X_PT,
        y,
        size: ERROR_FONT_SIZE_PT,
        font,
        color: ERROR_COLOR,
      });
      y -= ERROR_LINE_STEP_PT;
      line = "";
    };
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (
        font.widthOfTextAtSize(candidate, ERROR_FONT_SIZE_PT) >
        ERROR_WRAP_WIDTH_PT
      ) {
        flush();
        line = word;
      } else {
        line = candidate;
      }
    }
    flush();
  }
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

  for (const [name, rawValue] of Object.entries(fieldMap)) {
    // WinAnsi-safe first: measuring a value with ″ or ⅝ threw, and the
    // catch below then left the field silently blank.
    const value = toWinAnsiText(rawValue);
    try {
      const field = form.getTextField(name);
      // Acrobat-authored fields often use auto-size ("0 Tf"); pdf-lib then
      // scales short values to fill the widget height, so pin a sane size.
      // Any field (pinned or authored-size) shrinks further when a long
      // value (e.g. a casting name) would clip at the widget edge.
      const da = field.acroField.getDefaultAppearance() ?? "";
      const autoSize = /\b0(?:\.0+)?\s+Tf\b/.test(da);
      const daSize = /\/\S+\s+(\d+(?:\.\d+)?)\s+Tf/.exec(da);
      let size = autoSize
        ? fixedFontSizeFor(name)
        : daSize
          ? Number(daSize[1])
          : null;
      if (size != null) {
        const original = size;
        const widgetWidth =
          field.acroField.getWidgets()[0]?.getRectangle().width ?? 0;
        if (widgetWidth > 0 && value) {
          while (
            size > 6 &&
            font.widthOfTextAtSize(value, size) > widgetWidth - 4
          ) {
            size -= 0.5;
          }
        }
        if (autoSize || size !== original) {
          field.setFontSize(size);
        }
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
    drawElevationWallHeights(elevationWalls, result, font);
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

  const calcEndY = drawHeightCalcBlock(doc.getPage(0), result, font);
  if (result.pipeErrors.length > 0) {
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    drawPipeErrors(doc.getPage(0), result.pipeErrors, boldFont, calcEndY);
  }

  return doc.save(PDF_SAVE_OPTIONS);
}
