"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  importProducts,
  validateCastingAssemblyImportCodesAction,
} from "@/app/products/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  type BulkProductPasteRow,
  productInputClassName,
} from "@/components/products/product-utils";
import type { PriceListOption } from "@/lib/price-list-service";
import {
  bulkImportPresetLabels,
  bulkImportPresets,
  bulkPasteExamples,
  getBulkPasteFieldKeys,
  getBulkPasteHeaders,
  normalizeBulkPasteCells,
  bulkPasteColumnCountIssue,
  presetRequiresSupplier,
  presetCastingSoldAsUnit,
  presetToProductKind,
  presetToProductType,
  validateBulkPasteRow,
  type BulkImportPreset,
} from "@/lib/product-kinds";
import {
  analyzeTaxonomyByNames,
  collectMissingTaxonomyForImport,
} from "@/lib/product-taxonomy";
import { productTypeLabels } from "@/lib/product-types";
import { formatCastingSupplierOriginLabel } from "@/lib/casting-utils";
import type { ProductTaxonomyCategory } from "@/lib/product-taxonomy.shared";

const PROFILE_FIELD_KEYS = new Set([
  "ringDiameterFeet",
  "heightFeet",
  "ringStyle",
  "pipeDiameterInches",
  "pipeLengthFeet",
  "pipeClass",
  "pipeJointType",
  "castingHeightFeet",
  "castingClearOpeningInches",
  "manufacturerCode",
  "frameProductCode",
  "coverGrateProductCode",
  "hoodProductCode",
  "throatProductCode",
  "castingPieceRole",
]);

function parseBulkPaste(
  text: string,
  preset: BulkImportPreset,
  taxonomy: ProductTaxonomyCategory[],
): BulkProductPasteRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fieldKeys = getBulkPasteFieldKeys(preset);
  const expectedColumns = fieldKeys.length;

  return lines.map((line, index) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const rawCells = line.split(delimiter).map((cell) => cell.trim());
    const cells = normalizeBulkPasteCells(preset, rawCells);
    const values: Record<string, string> = {};
    fieldKeys.forEach((key, fieldIndex) => {
      values[key] = cells[fieldIndex] ?? "";
    });

    const kindFields: Record<string, string> = {};
    for (const key of fieldKeys) {
      if (PROFILE_FIELD_KEYS.has(key)) {
        kindFields[key] = values[key] ?? "";
      }
    }

    const category = values.category ?? "";
    const subcategory = values.subcategory ?? "";
    const expectedProductType = presetToProductType(preset);

    const issues: string[] = [];
    const columnIssue = bulkPasteColumnCountIssue(preset, rawCells);
    if (columnIssue) {
      issues.push(columnIssue);
    }

    issues.push(
      ...validateBulkPasteRow(
        preset,
        {
          productCode: values.productCode ?? "",
          productName: values.productName ?? "",
          category,
          subcategory,
          unitPrice: values.unitPrice ?? "",
          weight: values.weight ?? "",
          trackInventory: "",
          kindFields,
        },
        index + 1,
      ),
    );

    const taxonomyResult = analyzeTaxonomyByNames(
      taxonomy,
      category,
      subcategory,
      expectedProductType,
    );
    issues.push(...taxonomyResult.errors);

    const needsTaxonomyCreate =
      taxonomyResult.missingCategory || taxonomyResult.missingSubcategory;

    return {
      lineNumber: index + 1,
      productCode: values.productCode ?? "",
      productName: values.productName ?? "",
      category,
      subcategory,
      unit: values.unit ?? "",
      unitPrice: values.unitPrice ?? "",
      weight: values.weight ?? "",
      yards: values.yards ?? "",
      trackInventory: "",
      kindFields,
      isValid: issues.length === 0,
      needsTaxonomyCreate,
      issues,
    };
  });
}

function presetPreviewColumns(preset: BulkImportPreset): Array<{
  key: string;
  label: string;
  getValue: (row: BulkProductPasteRow) => string;
}> {
  return [
    { key: "line", label: "Line", getValue: (row) => String(row.lineNumber) },
    { key: "status", label: "Status", getValue: () => "" },
    ...getBulkPasteHeaders(preset).map((label, index) => {
      const fieldKey = getBulkPasteFieldKeys(preset)[index] ?? `field${index}`;
      return {
        key: fieldKey,
        label,
        getValue: (row: BulkProductPasteRow) => {
          if (
            fieldKey === "productCode" ||
            fieldKey === "productName" ||
            fieldKey === "category" ||
            fieldKey === "subcategory" ||
            fieldKey === "unit" ||
            fieldKey === "unitPrice" ||
            fieldKey === "weight" ||
            fieldKey === "yards"
          ) {
            return row[fieldKey as keyof BulkProductPasteRow]?.toString() ?? "";
          }
          return row.kindFields[fieldKey] ?? "";
        },
      };
    }),
    {
      key: "issues",
      label: "Issues",
      getValue: (row) => (row.issues.length > 0 ? row.issues.join(" ") : "—"),
    },
  ];
}

function rowStatusBadge(row: BulkProductPasteRow) {
  if (!row.isValid) {
    return <StatusBadge label="Invalid" variant="danger" />;
  }
  if (row.needsTaxonomyCreate) {
    return <StatusBadge label="New taxonomy" variant="warning" />;
  }
  return <StatusBadge label="Valid" variant="success" />;
}

function formatMissingTaxonomySummary(
  missing: ReturnType<typeof collectMissingTaxonomyForImport>,
  productTypeLabel: string,
): string {
  const parts: string[] = [];
  if (missing.categories.length > 0) {
    parts.push(
      `${missing.categories.length} categor${missing.categories.length === 1 ? "y" : "ies"} (${missing.categories.map((item) => item.name).join(", ")})`,
    );
  }
  if (missing.subcategories.length > 0) {
    parts.push(
      `${missing.subcategories.length} subcategor${missing.subcategories.length === 1 ? "y" : "ies"} (${missing.subcategories.map((item) => `${item.name} under ${item.categoryName}`).join(", ")})`,
    );
  }
  return `The following will be created as ${productTypeLabel} taxonomy: ${parts.join("; ")}.`;
}

type BulkPasteFormProps = {
  priceLists: PriceListOption[];
  taxonomy: ProductTaxonomyCategory[];
  castingSuppliers: Array<{ id: string; name: string; origin: "DOMESTIC" | "IMPORTED" }>;
};

export function BulkPasteForm({
  priceLists,
  taxonomy,
  castingSuppliers,
}: BulkPasteFormProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const defaultPriceListId =
    priceLists.find((list) => list.isDefault)?.id ?? priceLists[0]?.id ?? "";

  const [priceListId, setPriceListId] = useState(defaultPriceListId);
  const [importPreset, setImportPreset] = useState<BulkImportPreset>("STOCK_PRECAST");
  const [supplierId, setSupplierId] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [previewRows, setPreviewRows] = useState<BulkProductPasteRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isValidatingCodes, startCodeValidation] = useTransition();

  const columnHeaders = useMemo(
    () => getBulkPasteHeaders(importPreset),
    [importPreset],
  );
  const previewColumns = useMemo(
    () => presetPreviewColumns(importPreset),
    [importPreset],
  );

  const validCount = useMemo(
    () => previewRows.filter((row) => row.isValid).length,
    [previewRows],
  );
  const invalidCount = previewRows.length - validCount;
  const needsSupplier = presetRequiresSupplier(importPreset);
  const expectedProductType = presetToProductType(importPreset);

  const missingTaxonomy = useMemo(() => {
    if (!hasParsed || previewRows.length === 0) {
      return { categories: [], subcategories: [] };
    }
    return collectMissingTaxonomyForImport(
      taxonomy,
      previewRows.filter((row) => row.isValid).map((row) => ({
        category: row.category,
        subcategory: row.subcategory,
      })),
      expectedProductType,
    );
  }, [expectedProductType, hasParsed, previewRows, taxonomy]);

  const hasMissingTaxonomy =
    missingTaxonomy.categories.length > 0 ||
    missingTaxonomy.subcategories.length > 0;
  const taxonomyCreateCount =
    missingTaxonomy.categories.length + missingTaxonomy.subcategories.length;

  function handlePresetChange(nextPreset: BulkImportPreset) {
    setImportPreset(nextPreset);
    setPreviewRows([]);
    setHasParsed(false);
    setImportSummary(null);
    setPasteText("");
  }

  function handleParsePreview() {
    if (needsSupplier && !supplierId) {
      setErrorMessage("Select a supplier for casting imports.");
      return;
    }

    const rows = parseBulkPaste(pasteText, importPreset, taxonomy);
    setHasParsed(true);
    setImportSummary(null);
    setErrorMessage(null);

    const productKind = presetToProductKind(importPreset);
    if (productKind !== "CASTING_ASSEMBLY") {
      setPreviewRows(rows);
      return;
    }

    if (presetCastingSoldAsUnit(importPreset)) {
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
        const codeIssues = await validateCastingAssemblyImportCodesAction(
          structurallyValidRows.map((row) => ({
            lineNumber: row.lineNumber,
            frameProductCode: row.kindFields.frameProductCode ?? "",
            coverGrateProductCode: row.kindFields.coverGrateProductCode ?? "",
            hoodProductCode: row.kindFields.hoodProductCode ?? "",
            throatProductCode: row.kindFields.throatProductCode ?? "",
          })),
        );

        setPreviewRows(
          rows.map((row) => {
            const extraIssues = codeIssues[row.lineNumber] ?? [];
            if (extraIssues.length === 0) {
              return row;
            }
            const issues = [...row.issues, ...extraIssues];
            return { ...row, issues, isValid: issues.length === 0 };
          }),
        );
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
    setPasteText(bulkPasteExamples[importPreset]);
    setPreviewRows([]);
    setHasParsed(false);
    setImportSummary(null);
  }

  function handleClear() {
    setPasteText("");
    setPreviewRows([]);
    setHasParsed(false);
    setImportSummary(null);
    setErrorMessage(null);
  }

  async function handleImport() {
    if (!priceListId) {
      setErrorMessage("Select a price list before importing.");
      return;
    }
    if (needsSupplier && !supplierId) {
      setErrorMessage("Select a supplier for casting imports.");
      return;
    }

    const validRows = previewRows.filter((row) => row.isValid);
    if (validRows.length === 0) {
      return;
    }

    let createMissingTaxonomy = false;
    if (hasMissingTaxonomy) {
      const productTypeLabel = productTypeLabels[expectedProductType];
      const confirmed = await confirm({
        title: "Create missing categories?",
        message: `${formatMissingTaxonomySummary(missingTaxonomy, productTypeLabel)} Continue and import ${validRows.length} product${validRows.length === 1 ? "" : "s"}?`,
        confirmLabel: "Create & Import",
        cancelLabel: "Cancel",
      });
      if (!confirmed) {
        return;
      }
      createMissingTaxonomy = true;
    }

    const formData = new FormData();
    formData.set("priceListId", priceListId);
    formData.set("importPreset", importPreset);
    if (createMissingTaxonomy) {
      formData.set("createMissingTaxonomy", "true");
    }
    if (supplierId) {
      formData.set("supplierId", supplierId);
    }
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
            unitPrice,
            weight,
            yards,
            kindFields,
          }) => ({
            productCode,
            productName,
            category,
            subcategory,
            unit,
            unitPrice,
            weight,
            yards,
            kindFields,
          }),
        ),
      ),
    );

    startTransition(async () => {
      try {
        setErrorMessage(null);
        const result = await importProducts(formData);
        const summaryParts = [
          `${result.imported} product${result.imported === 1 ? "" : "s"} imported`,
        ];
        if (result.updated > 0) {
          summaryParts.push(
            `${result.updated} existing product${result.updated === 1 ? "" : "s"} updated`,
          );
        }
        if (result.listsMissingProducts.length > 0) {
          summaryParts.push(
            `Other lists missing prices: ${result.listsMissingProducts
              .map((list) => `${list.name} (${list.missingCount})`)
              .join(", ")}`,
          );
        }
        setImportSummary(summaryParts.join(". "));
        toast.success(
          `Imported ${result.imported} product${result.imported === 1 ? "" : "s"}${result.updated ? `, updated ${result.updated}` : ""}.`,
        );
        router.push(
          `/products?imported=${result.imported}&updated=${result.updated}`,
        );
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
        description="Choose an import preset and price list (plus supplier for castings), then paste rows including Category and optional Subcategory per line."
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="bulkImportPreset"
                className="block text-xs font-medium text-slate-700"
              >
                Import preset
              </label>
              <select
                id="bulkImportPreset"
                value={importPreset}
                onChange={(event) =>
                  handlePresetChange(event.target.value as BulkImportPreset)
                }
                className={productInputClassName}
              >
                {bulkImportPresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {bulkImportPresetLabels[preset]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="bulkPriceList"
                className="block text-xs font-medium text-slate-700"
              >
                Price List *
              </label>
              <select
                id="bulkPriceList"
                value={priceListId}
                onChange={(event) => setPriceListId(event.target.value)}
                required
                className={productInputClassName}
              >
                {priceLists.length === 0 ? (
                  <option value="">No price lists available</option>
                ) : (
                  priceLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                      {list.isDefault ? " (default)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            {needsSupplier ? (
              <div className="sm:col-span-2">
                <label
                  htmlFor="bulkSupplier"
                  className="block text-xs font-medium text-slate-700"
                >
                  Supplier *
                </label>
                <select
                  id="bulkSupplier"
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className={productInputClassName}
                >
                  <option value="">Select supplier</option>
                  {castingSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} (
                      {formatCastingSupplierOriginLabel(supplier.origin)})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">
              Paste columns ({bulkImportPresetLabels[importPreset]})
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

      {hasParsed && hasMissingTaxonomy ? (
        <SectionCard
          title="Missing categories or subcategories"
          description={`${taxonomyCreateCount} taxonomy item${taxonomyCreateCount === 1 ? "" : "s"} in your paste data do not exist yet.`}
        >
          <div className="space-y-3 text-xs text-amber-900">
            {missingTaxonomy.categories.length > 0 ? (
              <div>
                <p className="font-semibold">Categories to create</p>
                <ul className="mt-1 list-inside list-disc text-amber-800">
                  {missingTaxonomy.categories.map((category) => (
                    <li key={category.name}>
                      {category.name}{" "}
                      <span className="text-amber-700">
                        ({productTypeLabels[expectedProductType]})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {missingTaxonomy.subcategories.length > 0 ? (
              <div>
                <p className="font-semibold">Subcategories to create</p>
                <ul className="mt-1 list-inside list-disc text-amber-800">
                  {missingTaxonomy.subcategories.map((subcategory) => (
                    <li key={`${subcategory.categoryName}|${subcategory.name}`}>
                      {subcategory.name}{" "}
                      <span className="text-amber-700">
                        (under {subcategory.categoryName})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-amber-800">
              These will be created automatically when you import. Rows marked
              &ldquo;New taxonomy&rdquo; are otherwise ready.
            </p>
          </div>
        </SectionCard>
      ) : null}

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
                            rowStatusBadge(row)
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
            {importSummary ? (
              <p className="mb-3 text-xs text-emerald-700">{importSummary}</p>
            ) : null}
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
                  !priceListId ||
                  (needsSupplier && !supplierId)
                }
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending
                  ? "Importing..."
                  : hasMissingTaxonomy
                    ? `Create Taxonomy & Import ${validCount} Product${validCount === 1 ? "" : "s"}`
                    : `Import ${validCount} Product${validCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
