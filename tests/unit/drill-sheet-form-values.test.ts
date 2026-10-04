import { describe, expect, it } from "vitest";
import {
  buildDrillSheetFormValues,
  type DrillSheetWithDetail,
} from "@/lib/drill-sheet-detail";

function sheetAt(insideDiameterFeet: number | null): DrillSheetWithDetail {
  return {
    structureTemplateId: "tpl-1",
    jobId: null,
    structureNumber: "MH-1",
    castings: [],
    openings: [],
    calc:
      insideDiameterFeet == null
        ? null
        : { insideDiameterFeet, sheetDate: null, rimElevation: null },
  } as unknown as DrillSheetWithDetail;
}

const offered = [
  { id: "d4", insideDiameterFeet: 4 },
  { id: "d5", insideDiameterFeet: 5 },
];

describe("buildDrillSheetFormValues diameter", () => {
  it("selects the sheet's own diameter when the template still offers it", () => {
    const values = buildDrillSheetFormValues(sheetAt(5), offered);
    expect(values.diameterId).toBe("d5");
    expect(values.unmatchedDiameterFeet).toBeNull();
  });

  it("never swaps in a different size when the sheet's is no longer offered", () => {
    const values = buildDrillSheetFormValues(sheetAt(6), offered);
    expect(values.diameterId).toBe("");
    expect(values.unmatchedDiameterFeet).toBe(6);
  });

  it("defaults to the first offered size for a sheet with no saved size", () => {
    const values = buildDrillSheetFormValues(sheetAt(null), offered);
    expect(values.diameterId).toBe("d4");
    expect(values.unmatchedDiameterFeet).toBeNull();
  });
});
