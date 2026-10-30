import { describe, expect, it } from "vitest";
import {
  flattenPipeOpeningGroups,
  flattenRectOpeningGroups,
  groupPipeOpeningRows,
  groupRectOpeningRows,
  validatePipeOpeningGroups,
  validateRectOpeningGroups,
  type PipeOpeningCatalogRow,
} from "@/lib/opening-catalog-groups";

let counter = 0;
const key = () => `k${++counter}`;

function pipeRow(
  overrides: Partial<PipeOpeningCatalogRow>,
): PipeOpeningCatalogRow {
  return {
    id: undefined,
    pipeMaterial: "PVC SDR35",
    pipeSizeInches: "8",
    hasBoot: true,
    holeDiameterInches: "12",
    pipeWallThicknessInches: "0.24",
    bootModel: "",
    pricePerBoot: "",
    ...overrides,
  };
}

describe("round opening catalog groups", () => {
  const rows: PipeOpeningCatalogRow[] = [
    pipeRow({
      id: "a",
      pipeSizeInches: "12",
      holeDiameterInches: "18",
      bootModel: "106-012",
      pricePerBoot: "66",
    }),
    pipeRow({
      id: "b",
      pipeSizeInches: "8",
      bootModel: "106-008",
      pricePerBoot: "45",
    }),
    pipeRow({
      id: "c",
      pipeSizeInches: "8",
      hasBoot: false,
      holeDiameterInches: "14",
      pipeWallThicknessInches: "0.3",
    }),
    pipeRow({
      id: "d",
      pipeMaterial: "RCP",
      pipeSizeInches: "24",
      hasBoot: false,
      holeDiameterInches: "36",
      pipeWallThicknessInches: "3",
    }),
    pipeRow({
      id: "e",
      pipeMaterial: " pvc  sdr35 ",
      pipeSizeInches: "4",
      holeDiameterInches: "8",
    }),
  ];

  it("groups by material and merges boot / no-boot rows of a size", () => {
    const groups = groupPipeOpeningRows(rows, key);
    expect(groups.map((g) => g.pipeMaterial)).toEqual(["PVC SDR35", "RCP"]);

    const pvc = groups[0];
    expect(pvc.boot).toBe(true);
    expect(pvc.noBoot).toBe(true);
    expect(pvc.sizes.map((line) => line.pipeSizeInches)).toEqual([
      "4",
      "8",
      "12",
    ]);
    const eight = pvc.sizes[1];
    expect(eight).toMatchObject({
      bootRowId: "b",
      bootHoleInches: "12",
      bootModel: "106-008",
      pricePerBoot: "45",
      noBootRowId: "c",
      noBootHoleInches: "14",
      // The boot row's wall wins when the legacy rows disagree.
      pipeWallThicknessInches: "0.24",
    });

    const rcp = groups[1];
    expect(rcp.boot).toBe(false);
    expect(rcp.noBoot).toBe(true);
  });

  it("flattens back to the same rows, keeping ids", () => {
    const flat = flattenPipeOpeningGroups(groupPipeOpeningRows(rows, key));
    expect(
      flat.map((row) => [
        row.id,
        row.pipeMaterial,
        row.pipeSizeInches,
        row.hasBoot,
      ]),
    ).toEqual([
      ["e", "PVC SDR35", "4", true],
      ["b", "PVC SDR35", "8", true],
      ["c", "PVC SDR35", "8", false],
      ["a", "PVC SDR35", "12", true],
      ["d", "RCP", "24", false],
    ]);
    // Pipe wall is shared across the size's boot and no-boot rows.
    expect(flat[2].pipeWallThicknessInches).toBe("0.24");
  });

  it("renames every size and drops a switched-off side", () => {
    const groups = groupPipeOpeningRows(rows, key);
    groups[0] = { ...groups[0], pipeMaterial: "PVC SDR-35", noBoot: false };
    const flat = flattenPipeOpeningGroups(groups);
    const pvc = flat.filter((row) => row.pipeMaterial === "PVC SDR-35");
    expect(pvc.map((row) => row.id)).toEqual(["e", "b", "a"]);
    expect(pvc.every((row) => row.hasBoot)).toBe(true);
  });

  it("flags missing holes, duplicate sizes and duplicate materials", () => {
    const groups = groupPipeOpeningRows(rows, key);
    groups[0].sizes.push({ ...groups[0].sizes[0], key: key() });
    groups[0].sizes.push({
      ...groups[0].sizes[0],
      key: key(),
      pipeSizeInches: "6",
      bootHoleInches: "",
      noBootHoleInches: "",
    });
    groups.push({ ...groups[1], key: key(), pipeMaterial: "rcp" });
    const errors = validatePipeOpeningGroups(groups);
    expect(errors).toContain('PVC SDR35: 4" is listed twice.');
    expect(errors).toContain('PVC SDR35 6": enter a hole size.');
    expect(errors).toContain(
      '"rcp" is listed twice. Combine the sizes into one material.',
    );
    expect(validatePipeOpeningGroups(groupPipeOpeningRows(rows, key))).toEqual(
      [],
    );
  });
});

describe("rect opening catalog groups", () => {
  const rows = [
    {
      id: "r1",
      pipeMaterial: "RCP",
      pipeSizeInches: "24",
      openingWidthInches: "34",
      openingHeightInches: "34",
      pipeWallThicknessInches: "3",
      pricePerOpening: "55",
    },
    {
      id: "r2",
      pipeMaterial: "PVC",
      pipeSizeInches: "8",
      openingWidthInches: "12",
      openingHeightInches: "12",
      pipeWallThicknessInches: "",
      pricePerOpening: "",
    },
    {
      id: "r3",
      pipeMaterial: "RCP",
      pipeSizeInches: "15",
      openingWidthInches: "24",
      openingHeightInches: "24",
      pipeWallThicknessInches: "2.25",
      pricePerOpening: "40",
    },
  ];

  it("groups, sorts and flattens", () => {
    const groups = groupRectOpeningRows(rows, key);
    expect(groups.map((g) => g.pipeMaterial)).toEqual(["RCP", "PVC"]);
    expect(groups[0].sizes.map((line) => line.pipeSizeInches)).toEqual([
      "15",
      "24",
    ]);
    expect(flattenRectOpeningGroups(groups).map((row) => row.id)).toEqual([
      "r3",
      "r1",
      "r2",
    ]);
    expect(validateRectOpeningGroups(groups)).toEqual([]);
  });

  it("requires width and height", () => {
    const groups = groupRectOpeningRows(rows, key);
    groups[1].sizes[0].openingHeightInches = "";
    expect(validateRectOpeningGroups(groups)).toEqual([
      'PVC 8": enter the opening width and height.',
    ]);
  });
});
