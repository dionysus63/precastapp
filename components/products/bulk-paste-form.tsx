"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { importProducts } from "@/app/products/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  type BulkProductPasteRow,
  bulkPasteColumnHeaders,
  bulkPasteExample,
  productInputClassName,
} from "@/components/products/product-utils";
import {
  isRecognizedBulkRingStyle,
  parseBulkRingStyle,
} from "@/lib/drain-ring-utils";

function parseBulkPaste(text: string): BulkProductPasteRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const cells = line.split(delimiter).map((cell) => cell.trim());

    const [
      productCode = "",
      productName = "",
      category = "",
      subcategory = "",
      unit = "",
      defaultPrice = "",
      weight = "",
      yards = "",
      trackInventory = "",
      isDrainRing = "",
      ringDiameterFeet = "",
      heightFeet = "",
      ringStyle = "",
    ] = cells;

    const issues: string[] = [];

    if (!productCode) {
      issues.push("Product code is required.");
    }
    if (!productName) {
      issues.push("Product name is required.");
    }
    if (cells.length < 9) {
      issues.push("Expected at least 9 columns from Excel paste.");
    }

    const inventoryValue = trackInventory.toLowerCase();
    if (
      trackInventory &&
      inventoryValue !== "yes" &&
      inventoryValue !== "no"
    ) {
      issues.push('Track inventory must be "Yes" or "No".');
    }

    const drainRingValue = isDrainRing.trim().toLowerCase();
    const isDrainRingYes = drainRingValue === "yes";
    if (
      isDrainRing &&
      drainRingValue !== "yes" &&
      drainRingValue !== "no"
    ) {
      issues.push('Ring must be "Yes" or "No".');
    }
    if (isDrainRingYes) {
      const diameter = Number(ringDiameterFeet.replace(/[^\d.]/g, ""));
      const height = Number(heightFeet.replace(/[^\d.]/g, ""));
      if (!ringDiameterFeet.trim() || !Number.isFinite(diameter) || diameter <= 0) {
        issues.push("Rings require a pool diameter (ft).");
      }
      if (!heightFeet.trim() || !Number.isFinite(height) || height <= 0) {
        issues.push("Rings require a ring height (ft).");
      }
      if (ringStyle.trim() && !isRecognizedBulkRingStyle(ringStyle)) {
        issues.push('Style must be "DRAIN", "SAN", "SOL", or legacy "Yes"/"No".');
      }
      const style = parseBulkRingStyle(ringStyle);
      if (style === "SANITARY" && ringDiameterFeet.trim()) {
        if (Number.isFinite(diameter) && diameter !== 8 && diameter !== 10) {
          issues.push("Sanitary rings are only available for 8' and 10' diameters.");
        }
      }
    } else if (ringStyle.trim() && !isRecognizedBulkRingStyle(ringStyle)) {
      issues.push('Style must be "DRAIN", "SAN", or legacy "Yes"/"No".');
    }

    return {
      lineNumber: index + 1,
      productCode,
      productName,
      category,
      subcategory,
      unit,
      defaultPrice,
      weight,
      yards,
      trackInventory,
      isDrainRing,
      ringDiameterFeet,
      heightFeet,
      ringStyle,
      isValid: issues.length === 0,
      issues,
    };
  });
}

export function BulkPasteForm() {
  const router = useRouter();
  const [pasteText, setPasteText] = useState("");
  const [previewRows, setPreviewRows] = useState<BulkProductPasteRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importComplete, setImportComplete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const validCount = useMemo(
    () => previewRows.filter((row) => row.isValid).length,
    [previewRows],
  );

  const invalidCount = previewRows.length - validCount;

  function handleParsePreview() {
    const rows = parseBulkPaste(pasteText);
    setPreviewRows(rows);
    setHasParsed(true);
    setImportComplete(false);
  }

  function handleLoadExample() {
    setPasteText(bulkPasteExample);
    setPreviewRows([]);
    setHasParsed(false);
    setImportComplete(false);
  }

  function handleClear() {
    setPasteText("");
    setPreviewRows([]);
    setHasParsed(false);
    setImportComplete(false);
    setErrorMessage(null);
  }

  function handleImport() {
    if (importComplete) {
      return;
    }

    const validRows = previewRows.filter((row) => row.isValid);
    if (validRows.length === 0) {
      return;
    }

    const formData = new FormData();
    formData.set(
      "products",
      JSON.stringify(
        validRows.map(
          ({
            productCode,
            productName,
            category,
            subcategory,
            unit,
            defaultPrice,
            weight,
            yards,
            trackInventory,
            isDrainRing,
            ringDiameterFeet,
            heightFeet,
            ringStyle,
          }) => ({
            productCode,
            productName,
            category,
            subcategory,
            unit,
            defaultPrice,
            weight,
            yards,
            trackInventory,
            isDrainRing,
            ringDiameterFeet,
            heightFeet,
            ringStyle,
          }),
        ),
      ),
    );

    startTransition(async () => {
      try {
        setErrorMessage(null);
        const result = await importProducts(formData);
        setImportComplete(true);
        router.push(`/products?imported=${result.imported}`);
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Import failed.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Paste from Excel"
        description="Copy rows from Excel and paste below. Columns should be tab-separated in the same order as the product catalog. For rings, use Style DRAIN, SAN, or SOL (quote pool lines use codes like R-10-DRAIN, R-10-SAN, and R-10-SOL)."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">
              Expected column order
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {bulkPasteColumnHeaders.join(" → ")}
            </p>
          </div>

          <div>
            <label
              htmlFor="bulkPaste"
              className="block text-xs font-medium text-slate-700"
            >
              Paste Excel rows
            </label>
            <textarea
              id="bulkPaste"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              rows={10}
              placeholder="Paste copied Excel rows here..."
              className={`${productInputClassName} font-mono text-[11px]`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleParsePreview}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Parse Preview
            </button>
            <button
              type="button"
              onClick={handleLoadExample}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Load Example
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
      </SectionCard>

      {hasParsed ? (
        <SectionCard
          title="Import Preview"
          description={`${validCount} valid row${validCount === 1 ? "" : "s"}, ${invalidCount} with issues`}
          noPadding
        >
          {previewRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No rows found. Paste Excel data above and click Parse Preview.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Line</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Product Code</th>
                    <th className="px-4 py-2.5 font-semibold">Product Name</th>
                    <th className="px-4 py-2.5 font-semibold">Category</th>
                    <th className="px-4 py-2.5 font-semibold">Subcategory</th>
                    <th className="px-4 py-2.5 font-semibold">Unit</th>
                    <th className="px-4 py-2.5 font-semibold">Default Price</th>
                    <th className="px-4 py-2.5 font-semibold">Weight</th>
                    <th className="px-4 py-2.5 font-semibold">Yards</th>
                    <th className="px-4 py-2.5 font-semibold">Track Inventory</th>
                    <th className="px-4 py-2.5 font-semibold">Ring</th>
                    <th className="px-4 py-2.5 font-semibold">Dia (ft)</th>
                    <th className="px-4 py-2.5 font-semibold">Height (ft)</th>
                    <th className="px-4 py-2.5 font-semibold">Style</th>
                    <th className="px-4 py-2.5 font-semibold">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((row) => (
                    <tr key={row.lineNumber} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-500">
                        {row.lineNumber}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          label={row.isValid ? "Valid" : "Invalid"}
                          variant={row.isValid ? "success" : "danger"}
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-900">
                        {row.productCode || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-900">
                        {row.productName || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.category || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.subcategory || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.unit || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-900">
                        {row.defaultPrice || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.weight || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.yards || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.trackInventory || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.isDrainRing || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.ringDiameterFeet || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.heightFeet || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.ringStyle || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-red-600">
                        {row.issues.length > 0 ? row.issues.join(" ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-100 px-4 py-4">
            {errorMessage ? (
              <p className="mb-3 text-xs text-red-600">{errorMessage}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Link
                href="/products"
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleImport}
                disabled={validCount === 0 || isPending || importComplete}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending
                  ? "Importing..."
                  : `Import ${validCount} Product${validCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
