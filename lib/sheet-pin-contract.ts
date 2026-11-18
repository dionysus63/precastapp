// The NYSDOT PIN / contract number on drill sheets. Constants and a pure
// helper only (no pdf-lib, no Prisma import) so client screens can use them.
//
// The number is kept on the job (Job.nysdotContractNumber, entered on the job
// page) and read when a sheet's PDF is made, so typing it once fills every
// drill sheet of that job, old and new.

/**
 * Form field a Sheet PDF carries for the number, beside its "Pin/Contract #:"
 * label. The name is the one on the NYSDOT catch basin drawings.
 */
export const PIN_CONTRACT_FIELD = "pin/project";

/**
 * Fields a Sheet PDF may carry but does not have to: filled when the drawing
 * has them, never reported as missing when it does not.
 */
export const SHEET_OPTIONAL_FIELD_NAMES: readonly string[] = [
  PIN_CONTRACT_FIELD,
];

export const NYSDOT_CONTRACT_NUMBER_MAX_LENGTH = 60;

type JobContractNumber = { nysdotContractNumber: string | null };

/**
 * The contract number a drill sheet prints: its job's, or, for a sheet that
 * only hangs off a quote, that quote's job's. Blank when there is none.
 */
export function sheetPinContractNumber(sheet: {
  job?: JobContractNumber | null;
  quote?: { job?: JobContractNumber | null } | null;
}): string {
  return (
    sheet.job?.nysdotContractNumber?.trim() ||
    sheet.quote?.job?.nysdotContractNumber?.trim() ||
    ""
  );
}
