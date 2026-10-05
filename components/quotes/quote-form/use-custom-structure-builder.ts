"use client";

import { useState } from "react";
import { loadJobCustomStructureImportCandidates } from "@/app/quotes/job-sheet-import-actions";
import {
  type EditableQuoteLineItem,
  quoteLineItemTypeLabels,
} from "@/components/quotes/quote-utils";
import {
  customGridFromTsv,
  parseCustomStructureImport,
} from "@/lib/custom-structure-import";
import {
  createCostItemId,
  resolveCustomStructureUnitPrice,
} from "@/lib/quotes/custom-structure";
import type { CustomStructureCostItem } from "@/lib/quotes/types";
import { plainTextToRichText, sanitizeRichText } from "@/lib/rich-text";
import {
  createDefaultCustomStructureRow,
  createLineId,
  findDuplicateStructureNumbers,
  formatDuplicatePasteMessage,
  formatStructureNumberList,
  isBlankCustomStructureRow,
  isCustomStructureRowUserContent,
  type CustomStructureImportState,
  type CustomStructureRow,
  type CustomStructureRowField,
  type FlashMessage,
} from "@/components/quotes/quote-form/quote-form-utils";

/**
 * Rows of the "Add Custom Structure" modal, plus its "Import from job
 * structures" picker and "Paste from Excel" bulk add. State stays owned by
 * the quote form; this only groups it.
 */
export function useCustomStructureBuilder({
  lineItems,
  jobId,
  showFlash,
  addLineItems,
}: {
  lineItems: EditableQuoteLineItem[];
  jobId: string;
  showFlash: (type: FlashMessage["type"], text: string) => void;
  addLineItems: (items: EditableQuoteLineItem[]) => void;
}) {
  const [customStructureRows, setCustomStructureRows] = useState<
    CustomStructureRow[]
  >(() => [createDefaultCustomStructureRow([])]);

  // "Import from job structures" picker inside the custom-structure modal.
  const [customImport, setCustomImport] =
    useState<CustomStructureImportState | null>(null);

  // "Paste from Excel" bulk add inside the custom-structure modal.
  const [customPasteOpen, setCustomPasteOpen] = useState(false);
  const [customPasteText, setCustomPasteText] = useState("");
  const [customPasteError, setCustomPasteError] = useState<string | null>(null);

  function updateCustomStructureRow(
    id: string,
    field: CustomStructureRowField,
    value: string,
  ) {
    setCustomStructureRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      ),
    );
  }

  function updateCustomStructureRowCostItems(
    id: string,
    costItems: CustomStructureCostItem[],
  ) {
    setCustomStructureRows((current) =>
      current.map((row) => (row.id === id ? { ...row, costItems } : row)),
    );
  }

  function duplicateCustomStructureRow(id: string) {
    setCustomStructureRows((current) => {
      const source = current.find((row) => row.id === id);
      if (!source) {
        return current;
      }
      const structureNumber = `CS-${current.length + 1}`;
      const duplicate: CustomStructureRow = {
        ...source,
        id: createLineId(),
        structureNumber,
        defaultStructureNumber: structureNumber,
        costItems: source.costItems.map((item) => ({
          ...item,
          id: createCostItemId(),
        })),
      };
      const index = current.findIndex((row) => row.id === id);
      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  }

  /** Structure numbers already on this quote (editor rows + added lines). */
  function customStructureNumbersInUse(): Set<string> {
    const used = new Set<string>();
    for (const row of customStructureRows) {
      if (!isBlankCustomStructureRow(row) && row.structureNumber.trim()) {
        used.add(row.structureNumber.trim().toLowerCase());
      }
    }
    for (const line of lineItems) {
      if (line.type === "CUSTOM_STRUCTURE" && line.item.trim()) {
        used.add(line.item.trim().toLowerCase());
      }
    }
    return used;
  }

  async function openCustomStructureImport() {
    setCustomImport({
      loading: true,
      error: null,
      candidates: [],
      unchecked: new Set(),
    });
    try {
      const candidates = await loadJobCustomStructureImportCandidates(jobId);
      setCustomImport({
        loading: false,
        error: null,
        candidates,
        unchecked: new Set(),
      });
    } catch (error) {
      setCustomImport({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load the job's structures.",
        candidates: [],
        unchecked: new Set(),
      });
    }
  }

  function importCustomStructureCandidates() {
    if (!customImport) {
      return;
    }
    const used = customStructureNumbersInUse();
    const picked = customImport.candidates.filter(
      (candidate) =>
        !customImport.unchecked.has(candidate.structureNumber) &&
        !used.has(candidate.structureNumber.toLowerCase()),
    );
    setCustomImport(null);
    if (picked.length === 0) {
      showFlash("info", "Nothing new to import from the job.");
      return;
    }
    const importedRows: CustomStructureRow[] = picked.map((candidate) => ({
      id: createLineId(),
      structureNumber: candidate.structureNumber,
      description: candidate.description
        ? plainTextToRichText(candidate.description)
        : "",
      qty: candidate.qty,
      unitPrice: "",
      weight: candidate.weight,
      yards: candidate.yards,
      costItems: [],
    }));
    setCustomStructureRows((current) => [
      ...current.filter((row) => !isBlankCustomStructureRow(row)),
      ...importedRows,
    ]);
    showFlash(
      "info",
      `Added ${importedRows.length} structure${importedRows.length === 1 ? "" : "s"} from the job — fill in prices, then Add to Quote.`,
    );
  }

  /** Bulk add: pasted Excel rows (with prices) become editable structure rows. */
  function handleCustomStructurePaste() {
    const parsed = parseCustomStructureImport(customGridFromTsv(customPasteText));
    if (!parsed.headerFound) {
      setCustomPasteError(
        'Couldn\'t find the header row — include column headings like "Structure #", "Description", "Qty", "Unit Price", "Weight", "Yards".',
      );
      return;
    }

    // The same structure # twice within one paste: refuse the whole paste
    // (including rows the parser rejected) so nothing is silently dropped.
    const pasteDuplicates = findDuplicateStructureNumbers([
      ...parsed.rows.map((row) => ({
        rowNumber: row.rowNumber,
        structureNumber: row.entry.structureNumber,
      })),
      ...parsed.errors,
    ]);
    if (pasteDuplicates.length > 0) {
      setCustomPasteError(formatDuplicatePasteMessage(pasteDuplicates));
      return;
    }

    const used = customStructureNumbersInUse();
    const skippedDuplicates: string[] = [];
    const pastedRows: CustomStructureRow[] = [];
    for (const row of parsed.rows) {
      if (used.has(row.entry.structureNumber.toLowerCase())) {
        skippedDuplicates.push(row.entry.structureNumber);
        continue;
      }
      pastedRows.push({
        id: createLineId(),
        structureNumber: row.entry.structureNumber,
        description: plainTextToRichText(row.entry.description),
        qty: String(row.entry.quantity),
        unitPrice:
          row.entry.unitPriceEach != null ? String(row.entry.unitPriceEach) : "",
        weight:
          row.entry.weightEachLbs != null ? String(row.entry.weightEachLbs) : "",
        yards: row.entry.yardsEach != null ? String(row.entry.yardsEach) : "",
        costItems: [],
      });
    }

    if (pastedRows.length === 0) {
      const problems: string[] = [];
      if (parsed.errors.length > 0) {
        problems.push(
          `${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} had errors (first: row ${parsed.errors[0].rowNumber} — ${parsed.errors[0].message})`,
        );
      }
      if (skippedDuplicates.length > 0) {
        problems.push(
          `${skippedDuplicates.length} already on this quote (${formatStructureNumberList(skippedDuplicates)})`,
        );
      }
      setCustomPasteError(
        problems.length > 0
          ? `No rows added: ${problems.join("; ")}.`
          : "No structure rows found below the header row.",
      );
      return;
    }

    setCustomStructureRows((current) => [
      ...current.filter((row) => !isBlankCustomStructureRow(row)),
      ...pastedRows,
    ]);
    setCustomPasteOpen(false);
    setCustomPasteText("");
    setCustomPasteError(null);

    const notes: string[] = [];
    if (parsed.errors.length > 0) {
      notes.push(
        `${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} skipped (first: row ${parsed.errors[0].rowNumber} — ${parsed.errors[0].message})`,
      );
    }
    if (skippedDuplicates.length > 0) {
      notes.push(
        `${skippedDuplicates.length} skipped as already on this quote (${formatStructureNumberList(skippedDuplicates)})`,
      );
    }
    showFlash(
      notes.length > 0 ? "info" : "success",
      `Added ${pastedRows.length} structure${pastedRows.length === 1 ? "" : "s"} from the paste${notes.length > 0 ? ` — ${notes.join("; ")}` : ""}. Review below, then Add to Quote.`,
    );
  }

  function handleAddCustomStructure() {
    const items: EditableQuoteLineItem[] = [];

    for (const row of customStructureRows) {
      // Rows left at their auto-filled "CS-n" number are untouched — skip
      // them rather than adding empty $0 lines.
      if (!isCustomStructureRowUserContent(row)) {
        continue;
      }

      items.push({
        id: createLineId(),
        lineNumber: 0,
        type: "CUSTOM_STRUCTURE",
        typeLabel: quoteLineItemTypeLabels.CUSTOM_STRUCTURE,
        item: row.structureNumber.trim() || "Custom Structure",
        description: sanitizeRichText(row.description),
        qty: row.qty || "1",
        unit: "EA",
        unitPrice: resolveCustomStructureUnitPrice(row.unitPrice, row.costItems),
        weight: row.weight,
        yards: row.yards,
        taxable: true,
        costBreakdown: row.costItems.length > 0 ? row.costItems : null,
      });
    }

    if (items.length === 0) {
      showFlash(
        "error",
        "Enter at least one custom structure with a structure number, description, or pricing details.",
      );
      return;
    }

    addLineItems(items);
  }

  return {
    customStructureRows,
    setCustomStructureRows,
    customImport,
    setCustomImport,
    customPasteOpen,
    setCustomPasteOpen,
    customPasteText,
    setCustomPasteText,
    customPasteError,
    setCustomPasteError,
    updateCustomStructureRow,
    updateCustomStructureRowCostItems,
    duplicateCustomStructureRow,
    customStructureNumbersInUse,
    openCustomStructureImport,
    importCustomStructureCandidates,
    handleCustomStructurePaste,
    handleAddCustomStructure,
  };
}
