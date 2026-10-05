"use client";

import { useState } from "react";
import {
  splitStructureForShipping,
  unsplitStructure,
} from "@/app/delivery-tickets/actions";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import { buildSplitDraft } from "./editor-utils";
import type { SplitDraftPiece } from "./types";

/** Split-structure pieces: the inline "Split for shipping" form state plus
 * the split / unsplit server calls. `refreshFulfillment` reloads the quote
 * lines after a successful change. */
export function useStructureSplit(refreshFulfillment: () => void) {
  const [splitFormStructureId, setSplitFormStructureId] = useState<string | null>(
    null,
  );
  const [splitDraft, setSplitDraft] = useState<SplitDraftPiece[]>([]);
  const [splitPending, setSplitPending] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  function openSplitForm(meta: QuoteLineFulfillment) {
    if (!meta.jobStructureId) {
      return;
    }
    setSplitError(null);
    setSplitFormStructureId(meta.jobStructureId);
    setSplitDraft(buildSplitDraft(meta, 4));
  }

  function setSplitPieceCount(meta: QuoteLineFulfillment, count: number) {
    const clamped = Math.max(2, Math.min(12, count));
    setSplitDraft((current) => {
      const next = buildSplitDraft(meta, clamped);
      // Keep names the user already typed; weights re-spread evenly.
      for (let index = 0; index < Math.min(current.length, clamped); index += 1) {
        next[index] = { ...next[index], name: current[index].name };
      }
      return next;
    });
  }

  function updateSplitDraft(index: number, field: "name" | "weight", value: string) {
    setSplitDraft((current) =>
      current.map((piece, i) =>
        i === index ? { ...piece, [field]: value } : piece,
      ),
    );
  }

  async function saveSplit(meta: QuoteLineFulfillment) {
    if (!meta.jobStructureId) {
      return;
    }
    setSplitError(null);
    setSplitPending(true);
    try {
      const result = await splitStructureForShipping(
        meta.jobStructureId,
        splitDraft.map((piece) => {
          const parsed = Number(piece.weight);
          return {
            name: piece.name,
            weightLbs:
              piece.weight.trim() && Number.isFinite(parsed) && parsed > 0
                ? parsed
                : null,
          };
        }),
      );
      if ("error" in result) {
        setSplitError(result.error);
        return;
      }
      setSplitFormStructureId(null);
      refreshFulfillment();
    } finally {
      setSplitPending(false);
    }
  }

  async function removeSplit(meta: QuoteLineFulfillment) {
    if (!meta.jobStructureId) {
      return;
    }
    setSplitError(null);
    setSplitPending(true);
    try {
      const result = await unsplitStructure(meta.jobStructureId);
      if ("error" in result) {
        setSplitError(result.error);
        return;
      }
      refreshFulfillment();
    } finally {
      setSplitPending(false);
    }
  }

  return {
    splitFormStructureId,
    setSplitFormStructureId,
    splitDraft,
    splitPending,
    splitError,
    openSplitForm,
    setSplitPieceCount,
    updateSplitDraft,
    saveSplit,
    removeSplit,
  };
}

export type StructureSplitState = ReturnType<typeof useStructureSplit>;
