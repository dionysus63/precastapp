"use client";

import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { EditableQuoteLineItem } from "@/components/quotes/quote-utils";
import { resolveCustomStructureUnitPrice } from "@/lib/quotes/custom-structure";
import type { CustomStructureCostItem } from "@/lib/quotes/types";
import { sanitizeRichText } from "@/lib/rich-text";
import type {
  CustomStructureRow,
  CustomStructureRowField,
} from "@/components/quotes/quote-form/quote-form-utils";

/**
 * Draft state for the "Edit Custom Structure" dialog opened from a custom
 * structure line in the table. State stays owned by the quote form; this
 * only groups it.
 */
export function useCustomStructureLineEditor({
  setLineItems,
}: {
  setLineItems: Dispatch<SetStateAction<EditableQuoteLineItem[]>>;
}) {
  const [editingCustomStructureLineId, setEditingCustomStructureLineId] =
    useState<string | null>(null);
  const [editingCustomStructureDraft, setEditingCustomStructureDraft] =
    useState<CustomStructureRow | null>(null);

  function updateEditingCustomStructureDraft(
    field: CustomStructureRowField,
    value: string,
  ) {
    setEditingCustomStructureDraft((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  function updateEditingCustomStructureCostItems(
    costItems: CustomStructureCostItem[],
  ) {
    setEditingCustomStructureDraft((current) =>
      current ? { ...current, costItems } : current,
    );
  }

  const openEditCustomStructureLine = useCallback(
    (line: EditableQuoteLineItem) => {
      setEditingCustomStructureLineId(line.id);
      setEditingCustomStructureDraft({
        id: line.id,
        structureNumber: line.item,
        description: line.description,
        qty: line.qty,
        unitPrice: line.unitPrice,
        weight: line.weight,
        yards: line.yards,
        costItems: line.costBreakdown?.map((item) => ({ ...item })) ?? [],
      });
    },
    [],
  );

  function closeEditCustomStructureLine() {
    setEditingCustomStructureLineId(null);
    setEditingCustomStructureDraft(null);
  }

  function handleSaveEditedCustomStructure() {
    if (!editingCustomStructureDraft || !editingCustomStructureLineId) {
      return;
    }

    const draft = editingCustomStructureDraft;
    const resolvedUnitPrice = resolveCustomStructureUnitPrice(
      draft.unitPrice,
      draft.costItems,
    );
    const costBreakdown = draft.costItems.length > 0 ? draft.costItems : null;

    setLineItems((current) =>
      current.map((line) =>
        line.id === editingCustomStructureLineId
          ? {
              ...line,
              item: draft.structureNumber.trim() || line.item,
              description: sanitizeRichText(draft.description),
              qty: draft.qty || "1",
              unitPrice: resolvedUnitPrice,
              weight: draft.weight,
              yards: draft.yards,
              costBreakdown,
            }
          : line,
      ),
    );
    closeEditCustomStructureLine();
  }

  return {
    editingCustomStructureDraft,
    updateEditingCustomStructureDraft,
    updateEditingCustomStructureCostItems,
    openEditCustomStructureLine,
    closeEditCustomStructureLine,
    handleSaveEditedCustomStructure,
  };
}
