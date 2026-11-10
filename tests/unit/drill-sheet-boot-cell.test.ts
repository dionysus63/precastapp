import { describe, expect, it } from "vitest";
import { formatBootCell } from "@/lib/drill-sheet";
import { buildDrillSheetFieldMap } from "@/lib/drill-sheet-template-pdf";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import {
  buildRowsFromSetup,
  computeCircularOneOffRow,
  createEmptySetup,
  type OneOffCircularOptions,
} from "@/lib/quotes/one-off-drill-sheets";

const circularOptions: OneOffCircularOptions = {
  templates: [
    {
      id: "tpl-storm",
      name: "Storm 4'Ø MH",
      agencyStandard: null,
      wallThicknessInches: 5,
      baseSlabThicknessInches: 8,
      topSlabThicknessInches: 8,
      minimumBrickInches: 4,
      connectionType: "KOR_N_SEAL",
      sumpMode: "DEFAULT",
      sumpFixedInches: null,
      openingToJointMinTopInches: 4,
      openingToJointMinBottomInches: 4,
      topSlabOpeningInches: null,
      defaultCastingProductId: "cast-frame",
      defaultCastingHeightFeet: 0.5,
      diameters: [{ id: "d4", insideDiameterFeet: 4 }],
    },
  ],
  castings: [{ id: "cast-frame", name: "Frame & Cover", heightFeet: 0.5 }],
  pipeOpeningSizes: [
    {
      pipeMaterial: "PVC SDR35",
      pipeSizeInches: 8,
      pipeType: "",
      hasBoot: true,
      holeDiameterInches: 14,
      pipeWallThicknessInches: 0.25,
      bootModel: "KNS-14",
      pricePerBoot: 50,
    },
    {
      pipeMaterial: "RCP",
      pipeSizeInches: 12,
      pipeType: "",
      hasBoot: false,
      holeDiameterInches: 18,
      pipeWallThicknessInches: 2,
      bootModel: null,
      pricePerBoot: null,
    },
  ],
  diameterConfigs: [
    {
      label: null,
      insideDiameterFeet: 4,
      wallThicknessInches: 5,
      maxBaseHeightFeet: 4,
      maxRiserHeightFeet: 4,
      keyHeightFeet: 0.33,
      wallPricePerFoot: 135,
      basePrice: 530,
    },
  ],
};

const meta: DrillSheetPreviewMeta = {
  templateName: "Storm 4'Ø MH",
  manholeNumber: "MH-1",
  contractor: "",
  project: "",
  date: "",
  castingName: "Frame & Cover",
  insideDiameterFeet: 4,
  hasSteps: false,
  inspection: "",
  approvedBy: "",
  useBase: "",
  useRiser: "",
  brickAdjustment: "",
  topSlabOpeningInches: null,
};

describe("formatBootCell", () => {
  it("prints the boot model for a booted hole", () => {
    expect(formatBootCell({ hasBoot: true, bootModel: "KNS-14" })).toBe("KNS-14");
  });

  it("leaves a booted hole blank when the catalog has no model", () => {
    expect(formatBootCell({ hasBoot: true, bootModel: null })).toBe("");
    expect(formatBootCell({ hasBoot: true, bootModel: "  " })).toBe("");
  });

  it("prints No when the hole has no boot", () => {
    expect(formatBootCell({ hasBoot: false, bootModel: null })).toBe("No");
    // A stray model on a no-boot catalog row never shows as a boot.
    expect(formatBootCell({ hasBoot: false, bootModel: "KNS-14" })).toBe("No");
  });
});

describe("circular sheet BOOT column", () => {
  it("prints No for a no-boot opening and the model for a booted one", () => {
    const [row] = buildRowsFromSetup(
      {
        ...createEmptySetup("CIRCULAR"),
        templateId: "tpl-storm",
        diameterFeet: "4",
        castingProductId: "cast-frame",
        pipeType: "PVC SDR35",
        pipeSize: "8",
        quantity: "1",
      },
      2,
    );
    row.rimElevation = "100";
    row.openings[0] = { ...row.openings[0], invert: "92", angle: "" };
    row.openings[1] = {
      ...row.openings[1],
      invert: "92.5",
      angle: "90",
      // Only a no-boot catalog row exists for this pipe, so the lookup
      // falls back to it even though the template wants Kor-N-Seal boots.
      pipeType: "RCP",
      pipeSize: "12",
    };

    const result = computeCircularOneOffRow(row, circularOptions);
    expect(result.ready).toBe(true);
    const sheet = result.circularSheet;
    expect(sheet).toBeTruthy();
    if (!sheet) return;

    expect(sheet.openings.map((opening) => opening.hasBoot)).toEqual([true, false]);

    const map = buildDrillSheetFieldMap(meta, sheet);
    expect(map.boot_a).toBe("KNS-14");
    expect(map.boot_b).toBe("No");
  });
});
