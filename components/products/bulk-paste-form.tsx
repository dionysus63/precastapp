"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  importProducts,
  validateCastingAssemblyImportCodesAction,
  validateCastingBulkImportSuppliersAction,
} from "@/app/products/actions";
import type { ProductKind } from "@/app/generated/prisma/client";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  type BulkProductPasteRow,
  productInputClassName,
  productKindLabels,
} from "@/components/products/product-utils";
import {
  bulkImportKinds,
  bulkPasteExamples,
  getBulkPasteBaseHeaders,
  getBulkPasteHeaders,
  usesCastingBulkPasteBaseHeaders,
  validateBulkPasteRow,
} from "@/lib/product-kinds";

const kindFieldKeys: Record<ProductKind, string[]> = {
  STANDARD: [],
  DRAIN_RING: ["ringDiameterFeet", "heightFeet", "ringStyle"],
  PIPE: ["pipeDiameterInches", "pipeLengthFeet", "pipeClass", "pipeJointType"],
  CASTING_ASSEMBLY: [
    "castingHeightFeet",
    "castingClearOpeningInches",
    "frameProductCode",
    "coverGrateProductCode",
    "hoodProductCode",
    "throatProductCode",
  ],
  CASTING_COMPONENT: ["castingPieceRole"],
};

function parseBulkPaste(text: string, kind: ProductKind): BulkProductPasteRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const expectedColumns = getBulkPasteHeaders(kind).length;
  const baseHeaderCount = getBulkPasteBaseHeaders(kind).length;
  const kindKeys = kindFieldKeys[kind];
  const castingBase = usesCastingBulkPasteBaseHeaders(kind);

  return lines.map((line, index) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const cells = line.split(delimiter).map((cell) => cell.trim());

    let productCode = "";
    let productName = "";
    let category = "";
    let subcategory = "";
    let unit = "";
    let defaultPrice = "";
    let weight = "";
    let yards = "";
    let supplier = "";
    let trackInventory = "";
    let kindCells: string[] = [];

    if (castingBase) {
      [
        productCode = "",
        productName = "",
        category = "",
        subcategory = "",
        unit = "",
        defaultPrice = "",
        weight = "",
        supplier = "",
        trackInventory = "",
        ...kindCells
      ] = cells;
    } else {
      [
        productCode = "",
        productName = "",
        category = "",
        subcategory = "",
        unit = "",
        defaultPrice = "",
        weight = "",
        yards = "",
        trackInventory = "",
        ...kindCells
      ] = cells;
    }

    const kindFields: Record<string, string> = {};
    kindKeys.forEach((key, fieldIndex) => {
      kindFields[key] = kindCells[fieldIndex] ?? "";
    });

    const issues: string[] = [];
    if (cells.length < baseHeaderCount) {
      issues.push(`Expected at least ${baseHeaderCount} base columns.`);
    }
    if (cells.length < expectedColumns) {
      issues.push(`Expected ${expectedColumns} columns for ${productKindLabels[kind]}.`);
    }

    issues.push(
      ...validateBulkPasteRow(
        kind,
        {
          productCode,
          productName,
          trackInventory,
          supplier,
          kindFields,
        },
        index + 1,
      ),
    );

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
      supplier,
      trackInventory,
      kindFields,
      isValid: issues.length === 0,
      issues,
    };
  });
}

function kindPreviewColumns(kind: ProductKind): Array<{
  key: string;
  label: string;
  getValue: (row: BulkProductPasteRow) => string;
}> {
  const base = [
    { key: "line", label: "Line", getValue: (row: BulkProductPasteRow) => String(row.lineNumber) },
    { key: "status", label: "Status", getValue: () => "" },
    { key: "productCode", label: "Product Code", getValue: (row: BulkProductPasteRow) => row.productCode },
    { key: "productName", label: "Product Name", getValue: (row: BulkProductPasteRow) => row.productName },
    { key: "category", label: "Category", getValue: (row: BulkProductPasteRow) => row.category },
    { key: "subcategory", label: "Subcategory", getValue: (row: BulkProductPasteRow) => row.subcategory },
    { key: "unit", label: "Unit", getValue: (row: BulkProductPasteRow) => row.unit },
    { key: "defaultPrice", label: "Default Price", getValue: (row: BulkProductPasteRow) => row.defaultPrice },
    { key: "weight", label: "Weight", getValue: (row: BulkProductPasteRow) => row.weight },
  ];

  if (!usesCastingBulkPasteBaseHeaders(kind)) {
    base.push({
      key: "yards",
      label: "Yards",
      getValue: (row: BulkProductPasteRow) => row.yards,
    });
  } else {
    base.push({
      key: "supplier",
      label: "Supplier",
      getValue: (row: BulkProductPasteRow) => row.supplier,
    });
  }

  base.push({
    key: "trackInventory",
    label: "Track Inventory",
    getValue: (row: BulkProductPasteRow) => row.trackInventory,
  });

  const kindCols = getBulkPasteHeaders(kind)
    .slice(getBulkPasteBaseHeaders(kind).length)
    .map((label, index) => {
      const fieldKey = kindFieldKeys[kind][index] ?? `field${index}`;
      return {
        key: fieldKey,
        label,
        getValue: (row: BulkProductPasteRow) => row.kindFields[fieldKey] ?? "",
      };
    });

  return [
    ...base,
    ...kindCols,
    {
      key: "issues",
      label: "Issues",
      getValue: (row: BulkProductPasteRow) =>
        row.issues.length > 0 ? row.issues.join(" ") : "—",
    },
  ];
}

function mergePreviewIssues(
  rows: BulkProductPasteRow[],
  issueMaps: Array<Record<number, string[]>>,
): BulkProductPasteRow[] {
  return rows.map((row) => {
    const extraIssues = issueMaps.flatMap((map) => map[row.lineNumber] ?? []);
    if (extraIssues.length === 0) {
      return row;
    }
    const issues = [...row.issues, ...extraIssues];
    return {
      ...row,
      issues,
      isValid: issues.length === 0,
    };
  });
}

export function BulkPasteForm() {
  const router = useRouter();
  const [productKind, setProductKind] = useState<ProductKind>("STANDARD");
  const [pasteText, setPasteText] = useState("");
  const [previewRows, setPreviewRows] = useState<BulkProductPasteRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importComplete, setImportComplete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isValidatingCodes, startCodeValidation] = useTransition();

  const columnHeaders = useMemo(
    () => getBulkPasteHeaders(productKind),
    [productKind],
  );
  const previewColumns = useMemo(
    () => kindPreviewColumns(productKind),
    [productKind],
  );

  const validCount = useMemo(
    () => previewRows.filter((row) => row.isValid).length,
    [previewRows],
  );

  const invalidCount = previewRows.length - validCount;

  function handleKindChange(nextKind: ProductKind) {
    setProductKind(nextKind);
    setPreviewRows([]);
    setHasParsed(false);
    setImportComplete(false);
    setPasteText("");
  }

  function handleParsePreview() {
    const rows = parseBulkPaste(pasteText, productKind);
    setHasParsed(true);
    setImportComplete(false);
    setErrorMessage(null);

    const needsSupplierValidation =
      productKind === "CASTING_COMPONENT" || productKind === "CASTING_ASSEMBLY";
    const needsAssemblyCodeValidation = productKind === "CASTING_ASSEMBLY";

    if (!needsSupplierValidation && !needsAssemblyCodeValidation) {
      setPreviewRows(rows);
      return;
    }

    const structurallyValidRows = rows.filter((row) => row.issues.length === 0);
    if (structurallyValidRows.length === 0) {
      setPreviewRows(rows);
      return;
    }

    startCodeValidation(async () => {
      try {
        const issueMaps: Array<Record<number, string[]>> = [];

        if (needsSupplierValidation) {
          const supplierIssues = await validateCastingBulkImportSuppliersAction(
            structurallyValidRows.map((row) => ({
              lineNumber: row.lineNumber,
              supplier: row.supplier,
            })),
          );
          issueMaps.push(supplierIssues);
        }

        if (needsAssemblyCodeValidation) {
          const codeIssues = await validateCastingAssemblyImportCodesAction(
            structurallyValidRows.map((row) => ({
              lineNumber: row.lineNumber,
            frameProductCode: row.kindFields.frameProductCode ?? "",
            coverGrateProductCode: row.kindFields.coverGrateProductCode ?? "",
            hoodProductCode: row.kindFields.hoodProductCode ?? "",
            throatProductCode: row.kindFields.throatProductCode ?? "",
            })),
          );
          issueMaps.push(codeIssues);
        }

        setPreviewRows(mergePreviewIssues(rows, issueMaps));
      } catch (error) {
        setPreviewRows(rows);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not validate import rows.",
        );
      }
    });
  }

  function handleLoadExample() {
    setPasteText(bulkPasteExamples[productKind]);
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
    formData.set("productKind", productKind);
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
            supplier,
            trackInventory,
            kindFields,
          }) => ({
            productCode,
            productName,
            category,
            subcategory,
            unit,
            defaultPrice,
            weight,
            yards,
            supplier,
            trackInventory,
            kindFields,
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
        description="Choose a product kind, then paste tab-separated rows matching that kind's columns. Each kind has its own column layout — rings, pipe, casting components, casting assemblies, and standard stock are imported separately."
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="bulkProductKind"
              className="block text-xs font-medium text-slate-700"
            >
              Product Kind
            </label>
            <select
              id="bulkProductKind"
              value={productKind}
              onChange={(event) =>
                handleKindChange(event.target.value as ProductKind)
              }
              className={productInputClassName}
            >
              {bulkImportKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {productKindLabels[kind]}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">
              Expected column order ({productKindLabels[productKind]})
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {columnHeaders.join(" → ")}
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
              disabled={isValidatingCodes}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isValidatingCodes ? "Validating..." : "Parse Preview"}
            </button>
            <button
              type="button"
              onClick={handleLoadExample}
              disabled={!bulkPasteExamples[productKind]}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                    {previewColumns.map((column) => (
                      <th
                        key={column.key}
                        className="px-4 py-2.5 font-semibold"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((row) => (
                    <tr key={row.lineNumber} className="hover:bg-slate-50/60">
                      {previewColumns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-4 py-2.5 ${
                            column.key === "issues"
                              ? "text-red-600"
                              : column.key === "productCode"
                                ? "font-mono text-[11px] text-slate-900"
                                : column.key === "status"
                                  ? ""
                                  : "text-slate-600"
                          }`}
                        >
                          {column.key === "status" ? (
                            <StatusBadge
                              label={row.isValid ? "Valid" : "Invalid"}
                              variant={row.isValid ? "success" : "danger"}
                            />
                          ) : (
                            column.getValue(row) || "—"
                          )}
                        </td>
                      ))}
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
                disabled={
                  validCount === 0 ||
                  isPending ||
                  isValidatingCodes ||
                  importComplete
                }
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
