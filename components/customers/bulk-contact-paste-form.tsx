"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  checkBulkContactDbState,
  importContacts,
} from "@/app/customers/contact-actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  bulkContactColumnHeaders,
  bulkContactExample,
  bulkContactRowKey,
  contactRoleLabels,
  markBulkContactDuplicateRows,
  validateBulkContactPasteRow,
  type BulkContactPasteRow,
} from "@/components/customers/customer-utils";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

function parseBulkContactPaste(text: string): BulkContactPasteRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = lines.map((line, index) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const cells = line.split(delimiter).map((cell) => cell.trim());

    const [
      customer = "",
      name = "",
      title = "",
      rolesRaw = "",
      phone = "",
      email = "",
      notes = "",
    ] = cells;

    return validateBulkContactPasteRow(
      { customer, name, title, rolesRaw, phone, email, notes },
      index + 1,
    );
  });

  return markBulkContactDuplicateRows(rows);
}

export function BulkContactPasteForm() {
  const router = useRouter();
  const [pasteText, setPasteText] = useState("");
  const [previewRows, setPreviewRows] = useState<BulkContactPasteRow[]>([]);
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
    const rows = parseBulkContactPaste(pasteText);
    setPreviewRows(rows);
    setHasParsed(true);
    setImportComplete(false);

    const rowsToCheck = rows
      .filter((row) => row.isValid)
      .map((row) => ({ customer: row.customer, name: row.name }));

    if (rowsToCheck.length > 0) {
      checkBulkContactDbState(rowsToCheck)
        .then((state) => {
          const unknown = new Set(state.unknownCustomers);
          const existing = new Set(state.existingContacts);
          setPreviewRows((current) =>
            current.map((row) => {
              const issues = [...row.issues];
              let isValid = row.isValid;
              if (unknown.has(row.customer.trim().toLowerCase())) {
                issues.push(
                  "No customer with this exact name — row will be skipped.",
                );
                isValid = false;
              } else if (existing.has(bulkContactRowKey(row))) {
                issues.push(
                  "This customer already has a contact with this name — row will be skipped.",
                );
                isValid = false;
              }
              return issues.length === row.issues.length
                ? row
                : { ...row, issues, isValid };
            }),
          );
        })
        .catch(() => {
          // Permission error or network failure — the import re-checks anyway.
        });
    }
  }

  function handleLoadExample() {
    setPasteText(bulkContactExample);
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
    if (isPending || importComplete) {
      return;
    }

    const validRows = previewRows.filter((row) => row.isValid);
    if (validRows.length === 0) {
      return;
    }

    const formData = new FormData();
    formData.set(
      "contacts",
      JSON.stringify(
        validRows.map(({ customer, name, title, roles, phone, email, notes }) => ({
          customer,
          name,
          title,
          roles,
          phone,
          email,
          notes,
        })),
      ),
    );

    startTransition(async () => {
      try {
        setErrorMessage(null);
        const result = await importContacts(formData);
        setImportComplete(true);
        const skipped =
          result.skippedUnknownCustomer + result.skippedExisting;
        toast.success(
          `Imported ${result.imported} contact${result.imported === 1 ? "" : "s"}${skipped > 0 ? ` (${skipped} skipped)` : ""}.`,
        );
        router.push("/customers");
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
        description="Copy contact rows from Excel and paste below. Columns should be tab-separated. Rows match customers by exact name; unknown customers are skipped."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">
              Expected column order
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {bulkContactColumnHeaders.join(" → ")}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Roles accepts comma-separated values: Estimating, Billing, Field
              (est / bill / ap / site work too). The first contact imported for
              a role becomes the customer&apos;s default for it.
            </p>
          </div>

          <div>
            <label
              htmlFor="bulkContactPaste"
              className="block text-xs font-medium text-slate-700"
            >
              Paste Excel rows
            </label>
            <textarea
              id="bulkContactPaste"
              rows={8}
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={bulkContactExample.trimEnd()}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[11px] text-slate-900 shadow-sm placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleParsePreview}
              disabled={!pasteText.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
          description={`${validCount} valid row${validCount === 1 ? "" : "s"}, ${invalidCount} skipped or with issues`}
          noPadding
        >
          {previewRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No rows found. Paste Excel data above and click Parse Preview.
            </p>
          ) : (
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Line</th>
                    <th className={tableHeaderCellClassName}>Status</th>
                    <th className={tableHeaderCellClassName}>Customer</th>
                    <th className={tableHeaderCellClassName}>Name</th>
                    <th className={tableHeaderCellClassName}>Title</th>
                    <th className={tableHeaderCellClassName}>Roles</th>
                    <th className={tableHeaderCellClassName}>Phone</th>
                    <th className={tableHeaderCellClassName}>Email</th>
                    <th className={tableHeaderCellClassName}>Notes</th>
                    <th className={tableHeaderCellClassName}>Issues</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {previewRows.map((row) => (
                    <tr key={row.lineNumber} className={tableRowClassName}>
                      <td className={`${tableCellClassName} text-slate-500`}>
                        {row.lineNumber}
                      </td>
                      <td className={tableCellClassName}>
                        <StatusBadge
                          label={row.isValid ? "Valid" : "Skipped"}
                          variant={row.isValid ? "success" : "danger"}
                        />
                      </td>
                      <td className={`${tableCellClassName} text-slate-700`}>
                        {row.customer || "—"}
                      </td>
                      <td className={`${tableCellClassName} font-medium text-slate-900`}>
                        {row.name || "—"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {row.title || "—"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {row.roles.length > 0
                          ? row.roles
                              .map((role) => contactRoleLabels[role] ?? role)
                              .join(", ")
                          : "—"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {row.phone || "—"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {row.email || "—"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {row.notes || "—"}
                      </td>
                      <td className={`${tableCellClassName} text-red-600`}>
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
                href="/customers"
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
                  : `Import ${validCount} Contact${validCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
