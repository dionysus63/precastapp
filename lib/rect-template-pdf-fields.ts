// AcroForm field-name conventions for rectangular structure template PDFs.
// Constants only (no pdf-lib import) so client components can list them.
//
// Rectangular templates upload FOUR variant PDFs (top slab x base slab),
// generated from Nick's AutoCAD master by scripts/calibrate-rect-templates.ts.
// The app fills the text fields and draws openings, joints, and the top-slab
// opening onto the marker fields.
//
// Sheet layout (landscape letter): header block top-left; section elevation
// left with a thickness stack (inches) and elevation ladder; openings table
// (rows A-E: INVERT | DIA | TYPE) bottom-left; height-math ladder in decimal
// feet bottom-center; TOP SLAB detail box top-center; unfolded "exploded
// view" cross on the right (flaps = walls: Up, Right, Down, Left);
// piece-weights block upper right.

/**
 * Marker over the full exploded-view cross (all four flaps). Combined with
 * the center marker below, the app derives each wall flap's rectangle and
 * draws openings (with size/location annotations) and section joint lines.
 */
export const RECT_EXPLODED_MARKER_FIELD = "rect_exploded_view";

/** Marker over the exploded view's center square (the floor plan). */
export const RECT_EXPLODED_CENTER_MARKER_FIELD = "rect_exploded_center";

/**
 * Marker over the section elevation's wall band (outer wall faces, from the
 * top of the base slab / bottom of walls up to the top of the walls). The
 * app draws section joint lines across it when a structure is split.
 */
export const RECT_ELEVATION_WALL_MARKER_FIELD = "rect_elevation_walls";

/**
 * Marker over the top-slab drawing square in the TOP SLAB detail box.
 * Only present on top-slab variants; the app draws the access opening and
 * its size inside it.
 */
export const RECT_TOP_SLAB_MARKER_FIELD = "rect_top_slab_box";

/** Opening table rows on the sheet (A-E). */
export const RECT_OPENING_ROWS = ["a", "b", "c", "d", "e"] as const;

/** Piece-weight lines available in the upper-right weights block. */
export const RECT_WEIGHT_PIECE_LINES = 4;

/** AcroForm field names expected in calibrated rectangular template PDFs. */
export const RECT_SHEET_TEMPLATE_FIELD_NAMES = [
  // Header block
  "contractor",
  "project",
  "date",
  "box_no",
  "wall_thickness",
  "base_note",
  "casting",
  // Exploded-view dimensions (inches text, e.g. 48")
  "inside_length_inches",
  "inside_width_inches",
  "wall_height_inches",
  // Elevation thickness stack (inches text)
  "casting_thickness_inches",
  "brick_thickness_inches",
  "top_slab_thickness_inches",
  "base_slab_thickness_inches",
  // Elevation ladder (decimal elevations; variants carry the rows they show)
  "rim_elevation",
  "rim_elevation_drawing",
  "wall_height_stack_inches",
  "bottom_casting_elevation",
  "top_of_top_slab_elevation",
  "bottom_of_top_slab_elevation",
  "top_of_wall_elevation",
  "top_of_bottom_slab_elevation",
  "bottom_of_bottom_slab_elevation",
  // Height-math ladder (decimal feet)
  "low_invert",
  "invert_to_top",
  "casting_minus",
  "brick_minus",
  "top_slab_minus",
  "sump_plus",
  "wall_height",
  // Top slab detail box dims (top-slab variants only)
  "top_slab_length",
  "top_slab_width",
  // Piece weights (upper right)
  "weight_top_slab",
  "weight_base",
  ...Array.from(
    { length: RECT_WEIGHT_PIECE_LINES },
    (_, i) => `weight_piece_${i + 1}`,
  ),
  // Markers the app draws on
  RECT_EXPLODED_MARKER_FIELD,
  RECT_EXPLODED_CENTER_MARKER_FIELD,
  RECT_ELEVATION_WALL_MARKER_FIELD,
  RECT_TOP_SLAB_MARKER_FIELD,
  // Openings table rows (INVERT | DIA | TYPE)
  ...RECT_OPENING_ROWS.flatMap((row) =>
    (["invert", "dia", "type"] as const).map(
      (suffix) => `${suffix}_${row}`,
    ),
  ),
] as const;
