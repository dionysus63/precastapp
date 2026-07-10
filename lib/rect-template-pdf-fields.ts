// AcroForm field-name conventions for rectangular structure template PDFs.
// Constants only (no pdf-lib import) so client components can list them.
//
// Rectangular templates upload FOUR variant PDFs (top slab x base slab).
// Nick authors them with fillable fields (Word/Acrobat); the one-time
// scripts/import-rect-sheet-pdfs.ts run injects the invisible marker fields
// and the piece-weights block, producing "enriched masters" that upload via
// Structures -> Rect PDF Sets. The app fills the text fields and draws
// openings, joints, and the top-slab opening onto the marker fields.
//
// Sheet layout (landscape letter): header block upper-left; section elevation
// left with a thickness stack (inches) and elevation ladder; openings table
// (rows A-E: INVERT | DIA | TYPE) lower-left; TOP SLAB detail box top-center
// ("NO TOP SLAB" artwork on no-top variants); unfolded "exploded view" cross
// on the right (flaps = walls: Up, Right, Down, Left; the CENTER square is
// the base slab, X'd out on no-base variants); piece-weights block injected
// into blank space.

/**
 * Marker over the full exploded-view cross (all four flaps). Combined with
 * the center marker below, the app derives each wall flap's rectangle and
 * draws openings (with size/location annotations) and section joint lines.
 */
export const RECT_EXPLODED_MARKER_FIELD = "rect_exploded_view";

/** Marker over the exploded view's center square (the base-slab plan). */
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

/** Piece-weight lines available in the weights block. */
export const RECT_WEIGHT_PIECE_LINES = 4;

/** AcroForm field names expected in rectangular template PDFs. */
export const RECT_SHEET_TEMPLATE_FIELD_NAMES = [
  // Header block
  "contractor",
  "project",
  "date",
  "catch_basin_name",
  "wall_thickness",
  "base",
  "casting",
  // Exploded-view dimensions (inches text, e.g. 48")
  "length",
  "width",
  "height",
  // Elevation thickness stack (inches text)
  "casting_thickness_inches",
  "brick_thickness_inches",
  "top_slab_thickness_inches",
  "base_slab_thickness_inches",
  // Elevation ladder (decimal elevations; variants carry the rows they show)
  "rim_elevation",
  "bottom_casting_elevation",
  "top_of_top_slab_elevation",
  "top_of_wall_elevation",
  "bottom_of_wall_elevation",
  "bottom_of_bottom_slab_elevation",
  // Top slab detail box dims (top-slab variants only)
  "top_slab_length",
  "top_slab_width",
  // Piece weights (injected by the import script)
  "weight_top_slab",
  "weight_base",
  ...Array.from(
    { length: RECT_WEIGHT_PIECE_LINES },
    (_, i) => `weight_piece_${i + 1}`,
  ),
  // Markers the app draws on (injected by the import script)
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

/** Field names only present on top-slab variants. */
const TOP_SLAB_ONLY_FIELDS = new Set<string>([
  "top_of_top_slab_elevation",
  "top_slab_thickness_inches",
  "top_slab_length",
  "top_slab_width",
  "weight_top_slab",
  RECT_TOP_SLAB_MARKER_FIELD,
]);

/** Field names only present on base-slab variants. */
const BASE_SLAB_ONLY_FIELDS = new Set<string>([
  "bottom_of_bottom_slab_elevation",
  "base_slab_thickness_inches",
  "weight_base",
]);

/**
 * Expected field names for one variant slot: the master list minus the
 * slab-specific fields the variant's layout does not carry.
 */
export function rectVariantExpectedFieldNames(
  hasTopSlab: boolean,
  hasBaseSlab: boolean,
): string[] {
  return RECT_SHEET_TEMPLATE_FIELD_NAMES.filter(
    (name) =>
      (hasTopSlab || !TOP_SLAB_ONLY_FIELDS.has(name)) &&
      (hasBaseSlab || !BASE_SLAB_ONLY_FIELDS.has(name)),
  );
}
