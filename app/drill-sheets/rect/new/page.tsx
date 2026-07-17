import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/dashboard/back-button";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RectSheetForm } from "@/components/drill-sheets/rect-sheet-form";
import {
  createRectSheet,
  upgradeRectSheetFromPlaceholder,
} from "@/app/drill-sheets/actions";
import { loadRectSheetFormOptions } from "@/lib/drill-sheet-options";
import { withDatabaseRetry } from "@/lib/prisma";
import { parseRectStructureConfigJson } from "@/lib/quotes/rect-structure-workbook";
import { parseStructureConfigJson } from "@/lib/quotes/structure-workbook";
import {
  buildRectSheetFormValuesForIdentity,
  buildRectSheetFormValuesFromQuoteConfig,
} from "@/lib/rect-sheet-detail";

type NewRectSheetPageProps = {
  searchParams: Promise<{ structureId?: string; jobId?: string }>;
};

/** Placeholder structure being completed, or null for a blank new sheet. */
async function loadPlaceholder(structureId: string | undefined) {
  if (!structureId?.trim()) {
    return null;
  }

  const structure = await withDatabaseRetry((client) =>
    client.jobStructure.findUnique({
      where: { id: structureId },
      select: {
        id: true,
        jobId: true,
        structureNumber: true,
        structureTemplateId: true,
        updatedAt: true,
        quote: {
          select: { id: true, customerName: true, projectName: true },
        },
        quoteLineItems: {
          select: { structureConfigJson: true },
          take: 1,
        },
      },
    }),
  );

  if (!structure) {
    notFound();
  }
  if (structure.structureTemplateId) {
    // Already upgraded — edit it like any other sheet.
    redirect(`/drill-sheets/${structure.id}`);
  }

  return structure;
}

export default async function NewRectSheetPage({
  searchParams,
}: NewRectSheetPageProps) {
  const { structureId, jobId } = await searchParams;
  const [{ templateOptions, castingOptions, jobOptions, openingSizes }, placeholder] =
    await Promise.all([loadRectSheetFormOptions(), loadPlaceholder(structureId)]);

  const configJson = placeholder?.quoteLineItems[0]?.structureConfigJson ?? null;
  const rectConfig = placeholder ? parseRectStructureConfigJson(configJson) : null;
  const isCircularConfig =
    placeholder && !rectConfig && parseStructureConfigJson(configJson) != null;

  const seed = placeholder
    ? {
        jobId: placeholder.jobId,
        structureNumber: placeholder.structureNumber,
        contractor: placeholder.quote?.customerName ?? "",
        project: placeholder.quote?.projectName ?? "",
      }
    : null;
  const defaultValues =
    seed == null
      ? undefined
      : rectConfig
        ? buildRectSheetFormValuesFromQuoteConfig(rectConfig, seed)
        : buildRectSheetFormValuesForIdentity(seed);

  const backHref =
    placeholder?.jobId != null
      ? `/jobs/${placeholder.jobId}/structures/${placeholder.id}`
      : "/drill-sheets";
  const templateMissing =
    rectConfig != null &&
    !templateOptions.some((template) => template.id === rectConfig.templateId);

  return (
    <DashboardShell
      title={
        placeholder
          ? `Create Rect Sheet — ${placeholder.structureNumber ?? "Structure"}`
          : "New Rect Sheet"
      }
      subtitle={
        placeholder
          ? "Complete the drill sheet for this quoted structure. Saving upgrades it in place — quote link, status, and documents are kept."
          : "Enter rim, size, and pipe data to compute heights, sections, and pick weights for a rectangular structure."
      }
    >
      <BackButton
        href={backHref}
        label={placeholder?.jobId ? "Back to Structure" : "Back to Workbook"}
      />

      <div className="mt-4 space-y-4">
        {isCircularConfig && placeholder?.quote ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            This structure was quoted as a circular structure. Complete it in
            the{" "}
            <Link
              href={`/quotes/${placeholder.quote.id}/edit/structures`}
              className="font-semibold underline"
            >
              Circular Structure Workbook
            </Link>{" "}
            and use the quote&apos;s Create Drill Sheets button.
          </div>
        ) : templateOptions.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No active rectangular templates yet. Create one in{" "}
            <Link href="/structures" className="font-semibold underline">
              Structures
            </Link>{" "}
            first.
          </div>
        ) : (
          <>
            {templateMissing ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                The template this structure was quoted with is no longer
                active — the form fell back to the first available template.
                Double-check the selection before saving.
              </div>
            ) : null}
            <RectSheetForm
              action={
                placeholder
                  ? upgradeRectSheetFromPlaceholder.bind(null, placeholder.id)
                  : createRectSheet
              }
              templates={templateOptions}
              castings={castingOptions}
              jobs={jobOptions}
              openingSizes={openingSizes}
              defaultValues={defaultValues}
              defaultJobId={jobId}
              expectedUpdatedAt={placeholder?.updatedAt.toISOString()}
              submitLabel={placeholder ? "Create Drill Sheet" : "Create Sheet"}
            />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
