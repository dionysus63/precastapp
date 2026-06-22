"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveStructureForProduction,
  markStructureMade,
  startStructureProduction,
  submitStructureForApproval,
} from "@/app/operations/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { JobStructureDocumentsSection } from "@/components/jobs/job-structure-documents-section";
import type { JobStructureDetailView } from "@/lib/job-structure-detail-mapper";

type JobStructureDetailContentProps = {
  detail: JobStructureDetailView;
};

export function JobStructureDetailContent({
  detail,
}: JobStructureDetailContentProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );

  function runAction(
    action: () => Promise<{ error?: string } | unknown>,
    successText: string,
  ) {
    setMessage({});
    startTransition(async () => {
      try {
        const result = await action();
        if (result && typeof result === "object" && "error" in result && result.error) {
          setMessage({ error: String(result.error) });
          return;
        }
        setMessage({ success: successText });
        router.refresh();
      } catch (error) {
        setMessage({
          error: error instanceof Error ? error.message : "Action failed.",
        });
      }
    });
  }

  const canMarkSubmitted =
    detail.status === "NOT_SUBMITTED" &&
    (!detail.needsSubmittal || detail.jobSpecificSubmittalCount > 0);

  const nextAction = (() => {
    switch (detail.status) {
      case "NOT_SUBMITTED":
        return {
          label: "Mark as submitted",
          hint: detail.needsSubmittal
            ? "Upload a job-specific submittal first, then mark as submitted for approval."
            : "Mark this structure as submitted for production approval.",
          disabled: !canMarkSubmitted,
          onClick: () =>
            runAction(
              () => submitStructureForApproval(detail.id),
              "Structure marked as submitted.",
            ),
        };
      case "SUBMITTED":
        return {
          label: "Approve for production",
          hint: "Approve this structure to add it to the production queue.",
          disabled: false,
          onClick: () =>
            runAction(
              () => approveStructureForProduction(detail.id),
              "Structure approved for production.",
            ),
        };
      case "APPROVED":
        return {
          label: "Start production",
          hint: "Move this structure into active production.",
          disabled: false,
          onClick: () =>
            runAction(
              () => startStructureProduction(detail.id),
              "Production started.",
            ),
        };
      case "IN_PRODUCTION":
        return {
          label: "Mark as made",
          hint: "Mark when fabrication is complete and the structure is ready to ship.",
          disabled: false,
          onClick: () =>
            runAction(
              () => markStructureMade(detail.id),
              "Structure marked as made.",
            ),
        };
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {detail.jobNumber} — {detail.projectName}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {detail.structureNumber}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{detail.description}</p>
        </div>
        <StatusBadge label={detail.statusLabel} variant={detail.statusVariant} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href={`/jobs/${detail.jobId}?tab=production`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to job
        </Link>
        <Link
          href="/production"
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          Production queue
        </Link>
        {detail.quoteId ? (
          <Link
            href={`/quotes/${detail.quoteId}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Quote {detail.quoteNumber}
          </Link>
        ) : null}
      </div>

      <SectionCard title="Structure Info">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Type
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{detail.typeLabel}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Quantity
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {detail.quantity} {detail.unit}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Needs submittal
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {detail.needsSubmittal ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Documents
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {detail.documents.length} file
              {detail.documents.length === 1 ? "" : "s"}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        title="Production Workflow"
        description="Track submittal, approval, production, and completion."
      >
        <ol className="grid gap-3 sm:grid-cols-5">
          {detail.workflowSteps.map((step) => (
            <li
              key={step.status}
              className={`rounded-lg border px-3 py-3 ${
                step.isCurrent
                  ? "border-slate-900 bg-slate-900 text-white"
                  : step.isComplete
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-white"
              }`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  step.isCurrent
                    ? "text-white/80"
                    : step.isComplete
                      ? "text-emerald-700"
                      : "text-slate-500"
                }`}
              >
                {step.label}
              </p>
              <p
                className={`mt-1 text-xs ${
                  step.isCurrent
                    ? "text-white"
                    : step.isComplete
                      ? "text-emerald-900"
                      : "text-slate-700"
                }`}
              >
                {step.date}
              </p>
            </li>
          ))}
        </ol>
      </SectionCard>

      <JobStructureDocumentsSection
        jobId={detail.jobId}
        jobStructureId={detail.id}
        structureNumber={detail.structureNumber}
        folderPath={detail.folderPath}
        documents={detail.documents}
      />

      {nextAction ? (
        <SectionCard title="Next Step">
          <p className="text-sm text-slate-600">{nextAction.hint}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || nextAction.disabled}
              onClick={nextAction.onClick}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Working…" : nextAction.label}
            </button>
            {detail.status === "NOT_SUBMITTED" &&
            detail.needsSubmittal &&
            detail.jobSpecificSubmittalCount === 0 ? (
              <span className="text-xs text-amber-700">
                Upload a job-specific submittal to continue.
              </span>
            ) : null}
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Complete">
          <p className="text-sm text-slate-600">
            This structure is {detail.statusLabel.toLowerCase()}. It can be
            included on delivery tickets when marked as made.
          </p>
        </SectionCard>
      )}

      {message.error ? (
        <p className="text-sm text-red-600">{message.error}</p>
      ) : null}
      {message.success ? (
        <p className="text-sm text-green-700">{message.success}</p>
      ) : null}

      {detail.notes ? (
        <SectionCard title="Notes">
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {detail.notes}
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
