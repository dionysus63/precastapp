import type { RectSheetFormValues } from "@/components/drill-sheets/rect-sheet-form";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";

/**
 * Payload objects the bulk grids send to the bulk actions — the same JSON
 * shape the single-edit forms post, validated server-side by
 * parseDrillSheetPayloadData / parseRectSheetPayloadData.
 */

export function circularPayloadFromValues(
  values: DrillSheetFormValues,
): unknown {
  return {
    templateId: values.templateId,
    diameterId: values.diameterId,
    castingProductId: values.castingProductId || null,
    jobId: values.jobId || null,
    manholeNumber: values.manholeNumber,
    contractor: values.contractor,
    project: values.project,
    date: values.date,
    hasSteps: values.hasSteps,
    inspection: values.inspection,
    approvedBy: values.approvedBy,
    useBase: values.useBase,
    useRiser: values.useRiser,
    brickAdjustment: values.brickAdjustment,
    rimElevation: values.rimElevation,
    openings: values.openings.map((opening) => ({
      label: opening.label,
      pipeMaterial: opening.pipeMaterial,
      pipeSizeInches: opening.pipeSizeInches,
      invertElevation: opening.invertElevation,
      angle: opening.angle,
      connectionType: opening.connectionType,
    })),
  };
}

export function rectPayloadFromValues(values: RectSheetFormValues): unknown {
  return {
    templateId: values.templateId,
    castingProductId: values.castingProductId || null,
    jobId: values.jobId || null,
    structureNumber: values.structureNumber,
    contractor: values.contractor,
    project: values.project,
    date: values.date,
    inspection: values.inspection,
    approvedBy: values.approvedBy,
    rimElevation: values.rimElevation,
    brickTargetInches: values.brickTargetInches,
    insideLengthFeet: values.insideLengthFeet,
    insideWidthFeet: values.insideWidthFeet,
    hasTopSlab: values.hasTopSlab,
    hasBaseSlab: values.hasBaseSlab,
    baseAttached: values.baseAttached,
    topSlabOpeningLengthInches: values.topSlabOpeningLengthInches,
    topSlabOpeningWidthInches: values.topSlabOpeningWidthInches,
    topSlabOpeningSide: values.topSlabOpeningSide,
    sectionHeightsFeet: values.sections.map((section) => section.heightFeet),
    jointKeys: values.sections.slice(0, -1).map((section) => section.topKey),
    openings: values.openings.map((opening) => ({
      label: opening.label,
      wall: opening.wall,
      pipeMaterial: opening.pipeMaterial,
      pipeSizeInches: opening.pipeSizeInches,
      invertElevation: opening.invertElevation,
      angle: opening.angle,
      placement: opening.placement,
      offsetInches: opening.offsetInches,
      widthOverrideInches: opening.widthOverrideInches,
    })),
  };
}
