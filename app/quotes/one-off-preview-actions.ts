"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import type { RectSheetPreviewMeta } from "@/components/drill-sheets/rect-sheet-preview";
import { requirePermission } from "@/lib/auth/session";
import { formatSheetDate } from "@/lib/date-only";
import {
  loadDrillSheetFormOptions,
  loadRectSheetFormOptions,
} from "@/lib/drill-sheet-options";
import { buildDrillSheetPdfFromDetail } from "@/lib/drill-sheet-pdf-generate";
import {
  findMoldSheetSettings,
  resolveSheetDiameter,
} from "@/lib/mold-sheet-settings";
import { withDatabaseRetry } from "@/lib/prisma";
import { parseOneOffRow } from "@/lib/quotes/one-off-draft";
import {
  computeCircularOneOffRow,
  computeRectOneOffRow,
  ONE_OFF_MAX_OPENINGS,
  type OneOffShape,
} from "@/lib/quotes/one-off-drill-sheets";
import { fillRectSheetPdf } from "@/lib/rect-sheet-pdf-generate";
import { returnActionError } from "@/lib/server/action-errors";

export type OneOffSheetPreviewInput = {
  shape: OneOffShape;
  /** One grid row (OneOffRow), re-parsed server side. */
  row: unknown;
  openingCount: number;
  /** Printed in the sheet header. */
  contractor: string;
  project: string;
};

export type OneOffSheetPreviewResult = {
  /** The filled drill sheet PDF, base64 encoded. */
  pdfBase64: string;
  source: "template" | "generated" | "rect-template";
};

/**
 * Fills the real drill sheet PDF for a One-Off grid row that hasn't been
 * created yet, so the page can show the sheet as it will print while the row
 * is typed. Same template fill as saved sheets (and the same HTML fallback for
 * circular templates without an uploaded set); nothing is stored.
 */
export async function renderOneOffSheetPreview(input: OneOffSheetPreviewInput) {
  return returnActionError(async (): Promise<OneOffSheetPreviewResult> => {
    await requirePermission(AppPermission.STRUCTURES_MANAGE);

    const shape: OneOffShape =
      input.shape === "RECTANGULAR" ? "RECTANGULAR" : "CIRCULAR";
    const rawCount = Number(input.openingCount);
    const openingCount =
      Number.isInteger(rawCount) && rawCount >= 1
        ? Math.min(ONE_OFF_MAX_OPENINGS, rawCount)
        : 1;
    const row = parseOneOffRow(input.row, openingCount);
    if (!row) {
      throw new Error("There is no row to preview.");
    }
    if (!row.templateId) {
      throw new Error("Select a template to preview the sheet.");
    }
    const contractor = String(input.contractor ?? "");
    const project = String(input.project ?? "");
    // Same format the saved sheet prints (mm-dd-yyyy).
    const today = formatSheetDate(new Date());

    const template = await withDatabaseRetry((client) =>
      client.structureTemplate.findUnique({
        where: { id: row.templateId },
        select: {
          id: true,
          name: true,
          shape: true,
          topSlabOpeningInches: true,
          rectPdfSet: { include: { files: true } },
        },
      }),
    );
    if (!template) {
      throw new Error("That template was not found. It may have been retired.");
    }

    if (shape === "CIRCULAR") {
      const loaded = await loadDrillSheetFormOptions(null, {
        includeTemplateIds: [row.templateId],
      });
      const computed = computeCircularOneOffRow(row, {
        templates: loaded.templateOptions,
        castings: loaded.castingOptions,
        pipeOpeningSizes: loaded.pipeOpeningSizes,
        diameterConfigs: loaded.diameterConfigs,
      });
      if (!computed.circularSheet) {
        throw new Error(computed.status || "Enter the rim and inverts first.");
      }
      const casting = loaded.castingOptions.find(
        (entry) => entry.id === row.castingProductId,
      );
      const insideDiameterFeet = row.diameterFeet
        ? Number(row.diameterFeet)
        : null;
      const meta: DrillSheetPreviewMeta = {
        templateName: template.name,
        manholeNumber: row.structureNumber,
        contractor,
        project,
        date: today,
        castingName: casting?.name ?? "",
        insideDiameterFeet,
        sheetDiameter: resolveSheetDiameter(
          insideDiameterFeet,
          findMoldSheetSettings(loaded.diameterConfigs, insideDiameterFeet),
        ),
        hasSteps: false,
        inspection: "",
        approvedBy: "",
        useBase: "",
        useRiser: "",
        brickAdjustment: "",
        topSlabOpeningInches: template.topSlabOpeningInches ?? null,
      };
      const built = await buildDrillSheetPdfFromDetail(
        { meta, result: computed.circularSheet },
        template.rectPdfSet?.files ?? [],
      );
      return {
        pdfBase64: Buffer.from(built.bytes).toString("base64"),
        source: built.source,
      };
    }

    const loaded = await loadRectSheetFormOptions();
    const computed = computeRectOneOffRow(row, {
      templates: loaded.templateOptions,
      castings: loaded.castingOptions,
      openingSizes: loaded.openingSizes,
    });
    if (!computed.rectSheet) {
      throw new Error(computed.status || "Enter the rim and inverts first.");
    }
    const casting = loaded.castingOptions.find(
      (entry) => entry.id === row.castingProductId,
    );
    const meta: RectSheetPreviewMeta = {
      structureNumber: row.structureNumber,
      contractor,
      project,
      templateName: template.name,
      castingName: casting?.name ?? null,
    };
    const built = await fillRectSheetPdf(
      meta,
      computed.rectSheet,
      template.rectPdfSet ?? null,
      { date: today },
    );
    if (!built.ok) {
      throw new Error(built.error);
    }
    return {
      pdfBase64: Buffer.from(built.bytes).toString("base64"),
      source: "rect-template",
    };
  });
}
