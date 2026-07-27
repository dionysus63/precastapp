/**
 * Every pdf-lib save() in the app must pass these options.
 *
 * pdf-lib's default output packs objects into object streams; Acrobat opens
 * those files fine but its writer refuses to re-save them — "The document
 * could not be saved. There was a problem reading this document (14)".
 * Classic cross-reference output round-trips cleanly, and costs nothing
 * here: the bulk of these files is font/image streams, which stay
 * compressed either way.
 */
export const PDF_SAVE_OPTIONS = { useObjectStreams: false } as const;
