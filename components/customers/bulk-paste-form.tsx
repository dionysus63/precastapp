"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  checkBulkCustomerDbDuplicates,
  importCustomers,
} from "@/app/customers/actions";
import { customerInputClassName } from "@/components/customers/customer-form";
import {
  type BulkCustomerPasteRow,
  bulkPasteColumnHeaders,
  bulkPasteExample,
  markBulkPasteDuplicateRows,
  validateBulkCustomerPasteRow,
} from "@/components/customers/customer-utils";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";

function parseBulkPaste(text: string): BulkCustomerPasteRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = lines.map((line, index) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const cells = line.split(delimiter).map((cell) => cell.trim());

    const [
      name = "",
      status = "",
      primaryContactName = "",
      phone = "",
      email = "",
      address = "",
      town = "",
      state = "",
      zip = "",
      notes = "",
    ] = cells;

    return validateBulkCustomerPasteRow(
      {
        name,
        status,
        primaryContactName,
        phone,
        email,
        address,
        town,
        state,
        zip,
        notes,
      },
      index + 1,
    );
  });

  return markBulkPasteDuplicateRows(rows);
}

export function BulkPasteForm() {
  const router = useRouter();
  const [pasteText, setPasteText] = useState("");
  const [previewRows, setPreviewRows] = useState<BulkCustomerPasteRow[]>([]);
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

    const namesToCheck = rows
      .filter((row) => row.isValid && row.name.trim())
      .map((row) => row.name);

    if (namesToCheck.length > 0) {
      checkBulkCustomerDbDuplicates(namesToCheck)
        .then((duplicates) => {
          setPreviewRows((current) =>
            current.map((row) => {
              const match = duplicates[row.name];
              if (!match) {
                return row;
              }
              return {
                ...row,
                issues: [
                  ...row.issues,
                  `Possible duplicate of existing customer "${match}".`,
                ],
              };
            }),
          );
        })
        .catch(() => {
          // Permission error or network failure — skip duplicate detection.
        });
    }
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
      "customers",
      JSON.stringify(
        validRows.map(
          ({
            name,
            status,
            primaryContactName,
            phone,
            email,
            address,
            town,
            state,
            zip,
            notes,
          }) => ({
            name,
            status,
            primaryContactName,
            phone,
            email,
            address,
            town,
            state,
            zip,
            notes,
          }),
        ),
      ),
    );

    startTransition(async () => {
      try {
        setErrorMessage(null);
        const result = await importCustomers(formData);
        setImportComplete(true);
        router.push(`/customers?imported=${result.imported}`);
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
        description="Copy customer rows from Excel and paste below. Columns should be tab-separated. Empty status defaults to Active."
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
              className={`${customerInputClassName} font-mono text-[11px]`}
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
                    <th className="px-4 py-2.5 font-semibold">Name</th>
                    <th className="px-4 py-2.5 font-semibold">Customer Status</th>
                    <th className="px-4 py-2.5 font-semibold">Primary Contact</th>
                    <th className="px-4 py-2.5 font-semibold">Phone</th>
                    <th className="px-4 py-2.5 font-semibold">Email</th>
                    <th className="px-4 py-2.5 font-semibold">Address</th>
                    <th className="px-4 py-2.5 font-semibold">Town</th>
                    <th className="px-4 py-2.5 font-semibold">State</th>
                    <th className="px-4 py-2.5 font-semibold">Zip</th>
                    <th className="px-4 py-2.5 font-semibold">Notes</th>
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
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {row.name || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.status || "Active"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.primaryContactName || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.phone || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.email || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.address || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.town || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.state || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.zip || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.notes || "—"}
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
                  : `Import ${validCount} Customer${validCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
