import "server-only";

import {
  loadDrillSheetFormOptions,
  loadRectSheetFormOptions,
} from "@/lib/drill-sheet-options";
import { withDatabaseRetry } from "@/lib/prisma";
import type { OneOffDraftState } from "@/lib/quotes/one-off-draft";
import type {
  OneOffCircularOptions,
  OneOffRectOptions,
} from "@/lib/quotes/one-off-drill-sheets";

export type OneOffOptions = {
  circularOptions: OneOffCircularOptions;
  rectOptions: OneOffRectOptions;
};

/** Circular template ids a draft's setup and rows refer to. */
export function draftTemplateIds(state: OneOffDraftState): string[] {
  const ids = new Set<string>();
  if (state.circular.setup.templateId) {
    ids.add(state.circular.setup.templateId);
  }
  for (const row of state.circular.rows ?? []) {
    if (row.templateId) {
      ids.add(row.templateId);
    }
  }
  return [...ids];
}

/** Template ids used by a job's structures, so retired ones stay pickable. */
export async function jobTemplateIds(jobId: string): Promise<string[]> {
  const structures = await withDatabaseRetry((client) =>
    client.jobStructure.findMany({
      where: { jobId, structureTemplateId: { not: null } },
      select: { structureTemplateId: true },
      distinct: ["structureTemplateId"],
    }),
  );
  return structures
    .map((structure) => structure.structureTemplateId ?? "")
    .filter(Boolean);
}

/**
 * Templates, castings and opening sizes for both Quick Build grids. Shared
 * by the Quotes → Quick Build page and the job page's Quick Build tab.
 * `includeTemplateIds` keeps since-retired circular templates that sheets
 * being edited, or a draft's rows, still refer to.
 */
export async function loadOneOffOptions(
  includeTemplateIds: string[] = [],
): Promise<OneOffOptions> {
  const [circular, rect] = await Promise.all([
    loadDrillSheetFormOptions(null, { includeTemplateIds }),
    loadRectSheetFormOptions(),
  ]);
  return {
    circularOptions: {
      templates: circular.templateOptions,
      castings: circular.castingOptions,
      pipeOpeningSizes: circular.pipeOpeningSizes,
      diameterConfigs: circular.diameterConfigs,
    },
    rectOptions: {
      templates: rect.templateOptions,
      castings: rect.castingOptions,
      openingSizes: rect.openingSizes,
    },
  };
}
