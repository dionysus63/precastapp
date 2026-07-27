import { describe, expect, it } from "vitest";
import {
  circularPayloadFromValues,
  rectPayloadFromValues,
} from "@/components/jobs/bulk-edit/bulk-edit-payloads";
import { parseDrillSheetPayloadData } from "@/lib/drill-sheet-persistence";
import { parseRectSheetPayloadData } from "@/lib/rect-sheet-persistence";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";
import type { RectSheetFormValues } from "@/components/drill-sheets/rect-sheet-form";

const circularValues: DrillSheetFormValues = {
  templateId: "tpl-1",
  diameterId: "dia-1",
  castingProductId: "cast-1",
  jobId: "job-1",
  manholeNumber: "MH-2",
  contractor: "Acme Sitework",
  project: "Holbrook Sewer",
  date: "2026-07-26",
  hasSteps: true,
  inspection: "SCDPW",
  approvedBy: "NB",
  useBase: "4",
  useRiser: "4",
  brickAdjustment: "0.33",
  rimElevation: "142.35",
  openings: [
    {
      label: "A",
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: "12",
      invertElevation: "134.10",
      angle: "90",
      connectionType: "KOR_N_SEAL",
    },
    {
      label: "B",
      pipeMaterial: "",
      pipeSizeInches: "",
      invertElevation: "",
      angle: "",
      connectionType: "",
    },
  ],
};

const rectValues: RectSheetFormValues = {
  templateId: "tpl-rect",
  castingProductId: "",
  jobId: "job-1",
  structureNumber: "CB-3",
  contractor: "",
  project: "",
  date: "",
  inspection: "",
  approvedBy: "",
  rimElevation: "101.5",
  brickTargetInches: "8",
  insideLengthFeet: "6",
  insideWidthFeet: "4",
  hasTopSlab: true,
  hasBaseSlab: true,
  baseAttached: false,
  topSlabOpeningLengthInches: "30",
  topSlabOpeningWidthInches: "30",
  topSlabOpeningSide: "UP",
  maxPickWeightLbs: "",
  sections: [
    { id: "s1", heightFeet: "4", topKey: true },
    { id: "s2", heightFeet: "3.5", topKey: false },
  ],
  openings: [
    {
      id: "o1",
      label: "A",
      wall: "LEFT",
      pipeMaterial: "RCP",
      pipeSizeInches: "15",
      invertElevation: "97.25",
      angle: "",
      placement: "FROM_LEFT",
      offsetInches: "12",
      widthOverrideInches: "",
    },
  ],
};

describe("bulk edit payload round-trips", () => {
  it("circular grid payload survives the server parser", () => {
    const parsed = parseDrillSheetPayloadData(
      JSON.parse(JSON.stringify(circularPayloadFromValues(circularValues))),
    );
    expect(parsed.templateId).toBe("tpl-1");
    expect(parsed.diameterId).toBe("dia-1");
    expect(parsed.castingProductId).toBe("cast-1");
    expect(parsed.jobId).toBe("job-1");
    expect(parsed.manholeNumber).toBe("MH-2");
    expect(parsed.hasSteps).toBe(true);
    expect(parsed.brickAdjustment).toBe("0.33");
    expect(parsed.rimElevation).toBe("142.35");
    expect(parsed.openings).toHaveLength(2);
    expect(parsed.openings[0]).toMatchObject({
      label: "A",
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: "12",
      invertElevation: "134.10",
      angle: "90",
      connectionType: "KOR_N_SEAL",
    });
  });

  it("circular parser rejects a payload missing template/diameter", () => {
    expect(() =>
      parseDrillSheetPayloadData({ templateId: "", diameterId: "" }),
    ).toThrow(/template and diameter/i);
  });

  it("rect grid payload survives the server parser", () => {
    const parsed = parseRectSheetPayloadData(
      JSON.parse(JSON.stringify(rectPayloadFromValues(rectValues))),
    );
    expect(parsed.templateId).toBe("tpl-rect");
    expect(parsed.castingProductId).toBeNull();
    expect(parsed.structureNumber).toBe("CB-3");
    expect(parsed.rimElevation).toBe("101.5");
    expect(parsed.brickTargetInches).toBe("8");
    expect(parsed.insideLengthFeet).toBe("6");
    expect(parsed.hasTopSlab).toBe(true);
    expect(parsed.baseAttached).toBe(false);
    expect(parsed.topSlabOpeningSide).toBe("UP");
    expect(parsed.sectionHeightsFeet).toEqual(["4", "3.5"]);
    // One joint key per split between pours.
    expect(parsed.jointKeys).toEqual([true]);
    expect(parsed.openings[0]).toMatchObject({
      wall: "LEFT",
      placement: "FROM_LEFT",
      offsetInches: "12",
    });
  });
});
