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
  const upLo = Math.max(
    (opening.bottomOfOpeningFeet - result.floorElevation) /
      result.wallHeightFeet,
    0,
  );
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
    const upPtPerFrac = Math.max(
      flap.verticalWall ? flap.height : flap.width,
      EPSILON,
    );
    const alongPt =
      (span.endFraction - span.startFraction) * alongPtPerFrac;
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

  const p1 = flap.point(span.startFraction, upLo);
  const p2 = flap.point(span.endFraction, upHi);
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
  const location = [
    locationText(opening),
    opening.extendsToTop ? "OPEN TO TOP" : null,
  ]
    .filter(Boolean)
    .join(" — ");
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
        [...others, ...neighborStrips, ...foldDimRects],
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
      }
      if (bestClearIdx < 0 && deferTo) {
        deferTo.push(entry);
        return;
      }
      const chosen = bestClearIdx >= 0 ? bestClearIdx : bestIdx;
      const chosenTop = topAt(chosen);
      nextSlot = chosen + 1;
      drawCalloutBlock(page, font, entry, layout, side.laneCx, chosenTop);
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

  return {
    chainX,
    upFlapObstacles: obstaclesOn(upFlap, upKnockouts),
    downFlapObstacles: obstaclesOn(downFlap, rectsByWall.get("DOWN") ?? []),
    jointDisplayFracs,
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
      .map((rect) => ({ lo: rect.x - 2, hi: rect.x + rect.width + 2 }));
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
        chainZoneX: number | null;
      }[] = [
        {
          flap: upFlap,
          obstacles: drawInfo.upFlapObstacles,
          chainZoneX: drawInfo.chainX,
        },
        { flap: downFlap, obstacles: drawInfo.downFlapObstacles, chainZoneX: null },
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
          attempt.chainZoneX,
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
    const xCandidates = [dimX + 4, dimX - textWidth - 4];
    let spot: { x: number; y: number } | null = null;
    outer: for (const y of yCandidates) {
      if (y < y0 + 2 || y + CALLOUT_FONT_SIZE_PT > y1 - 2) {
        continue;
      }
      for (const x of xCandidates) {
        if (x < flap.x + 2) {
          continue;
        }
        const clear = !upRects.some(
          (rect) =>
            x < rect.x + rect.width &&
            x + textWidth > rect.x &&
            y < rect.y + rect.height &&
            y + CALLOUT_FONT_SIZE_PT > rect.y,
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
    if (!spot) {
      spot = { x: flap.x - textWidth - 3, y: midY };
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
const CALC_BLOCK_TOP_PT = 148;
const CALC_BLOCK_VALUE_RIGHT_PT = 377;
const CALC_LINE_STEP_PT = 10.5;

function drawHeightCalcBlock(
  page: PDFPage,
  result: RectStructureResult,
  font: PDFFont,
): number {
  const rows: [string, number | null][] = [
    ["Rim Elevation", result.rimElevation],
    ["Low Invert", result.lowInvertElevation],
    ["Invert to Top", result.invertToTopFeet],
    ["Casting (-)", result.castingHeightFeet],
    ...(result.hasTopSlab
      ? ([["Top Slab (-)", result.topSlabThicknessFeet]] as [
          string,
          number | null,
        ][])
      : []),
    ["Sump (+)", result.sumpFeet],
    ["Brick (-)", result.brickFeet],
    ["Wall Height", result.wallHeightFeet],
  ];

  let y = CALC_BLOCK_TOP_PT;
  const title = "HEIGHT CALCULATION";
  page.drawText(title, {
    x: CALC_BLOCK_X_PT,
    y,
    size: LABEL_FONT_SIZE_PT,
    font,
    color: BLACK,
  });
  page.drawLine({
    start: { x: CALC_BLOCK_X_PT, y: y - 2 },
    end: {
      x: CALC_BLOCK_X_PT + font.widthOfTextAtSize(title, LABEL_FONT_SIZE_PT),
      y: y - 2,
    },
    thickness: 0.6,
    color: BLACK,
  });
  y -= CALC_LINE_STEP_PT + 2;

  for (const [label, value] of rows) {
    if (value == null) {
      continue;
    }
    page.drawText(label, {
      x: CALC_BLOCK_X_PT,
      y,
      size: 7,
      font,
      color: BLACK,
    });
    const text = value.toFixed(2);
    page.drawText(text, {
      x: CALC_BLOCK_VALUE_RIGHT_PT - font.widthOfTextAtSize(text, 7),
      y,
      size: 7,
      font,
      color: BLACK,
    });
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

  for (const [name, value] of Object.entries(fieldMap)) {
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

  return doc.save();
}
