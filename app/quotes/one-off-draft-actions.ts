"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  defaultDraftName,
  describeDraftJob,
  normalizeDraftName,
  parseOneOffDraftState,
  serializeOneOffDraftState,
  type OneOffDraftSaveResult,
} from "@/lib/quotes/one-off-draft";
import { returnActionError } from "@/lib/server/action-errors";

const ONE_OFF_PATH = "/quotes/one-off";

export type OneOffDraftSaveInput = {
  /** Null saves a new draft; an id updates that draft in place. */
  id: string | null;
  name: string;
  /** The page's working state (OneOffDraftState), re-parsed server side. */
  state: unknown;
};

/**
 * Saves the One-Off page's in-progress grid to finish later. The state is
 * rebuilt from the client JSON so a malformed field can't poison the draft,
 * and an existing job is checked so the draft never points at nothing.
 */
export async function saveOneOffDraft(input: OneOffDraftSaveInput) {
  return returnActionError(async (): Promise<OneOffDraftSaveResult> => {
    const user = await requirePermission(AppPermission.STRUCTURES_MANAGE);

    const state = parseOneOffDraftState(input.state);
    if (!state) {
      throw new Error("There is nothing to save yet.");
    }
    if (!state.job && state.circular.rows == null && state.rect.rows == null) {
      throw new Error("Pick a job or build a grid before saving a draft.");
    }

    let jobId: string | null = null;
    let jobForLabel: {
      jobNumber: string;
      projectName: string;
      customerName: string;
    } | null = null;
    const draftJob = state.job;
    if (draftJob?.mode === "existing") {
      jobForLabel = await withDatabaseRetry((client) =>
        client.job.findUnique({
          where: { id: draftJob.jobId },
          select: { jobNumber: true, projectName: true, customerName: true },
        }),
      );
      if (!jobForLabel) {
        throw new Error("That job was not found. It may have been deleted.");
      }
      jobId = draftJob.jobId;
    }

    const name =
      normalizeDraftName(String(input.name ?? "")) ||
      defaultDraftName(describeDraftJob(state.job, jobForLabel));
    const draftJson = serializeOneOffDraftState(state);
    const savedBy = user.displayName ?? null;
    const id = typeof input.id === "string" ? input.id.trim() : "";

    const saved = await withDatabaseRetry(async (client) => {
      if (id) {
        const existing = await client.oneOffDraft.findUnique({
          where: { id },
          select: { id: true },
        });
        if (existing) {
          return client.oneOffDraft.update({
            where: { id },
            data: { name, jobId, draftJson, savedBy },
            select: { id: true, name: true, savedBy: true, updatedAt: true },
          });
        }
        // The draft was deleted (or created) elsewhere since this page
        // loaded: keep the work by saving it as a new draft.
      }
      return client.oneOffDraft.create({
        data: { name, jobId, draftJson, savedBy },
        select: { id: true, name: true, savedBy: true, updatedAt: true },
      });
    });

    revalidatePath(ONE_OFF_PATH);
    return {
      id: saved.id,
      name: saved.name,
      savedBy: saved.savedBy,
      savedAt: saved.updatedAt.toISOString(),
    };
  });
}

export async function deleteOneOffDraft(draftId: string) {
  return returnActionError(async (): Promise<{ deleted: boolean }> => {
    await requirePermission(AppPermission.STRUCTURES_MANAGE);
    const id = String(draftId ?? "").trim();
    if (!id) {
      throw new Error("That draft was not found.");
    }
    const result = await withDatabaseRetry((client) =>
      client.oneOffDraft.deleteMany({ where: { id } }),
    );
    revalidatePath(ONE_OFF_PATH);
    return { deleted: result.count > 0 };
  });
}
