"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  approveStructureForProduction,
  uploadStructureSubmittalFile,
} from "@/app/operations/actions";

const ACCEPTED_FILE_TYPES = ".pdf,.png,.jpg,.jpeg,.tif,.tiff";

export type BulkAttachMode = "submittals" | "approvals";

export type BulkAttachTarget = {
  id: string;
  structureNumber: string | null;
  description: string | null;
  quantityLabel: string | null;
  status: string;
  needsSubmittal: boolean;
  submittalCount: number;
};

export type BulkAttachJobGroup = {
  jobId: string;
  jobNumber: string;
  projectName: string;
  customerName: string;
  hasFolder: boolean;
  submittalTargets: BulkAttachTarget[];
  approvalTargets: BulkAttachTarget[];
};

type TileState = {
  status: "idle" | "busy" | "done" | "error";
  message: string | null;
  /** File names accepted so far (survives a later error in the same batch). */
  uploaded: string[];
};

const IDLE_TILE: TileState = { status: "idle", message: null, uploaded: [] };

const MODES: {
  id: BulkAttachMode;
  label: string;
  description: string;
  emptyMessage: string;
}[] = [
  {
    id: "submittals",
    label: "Add Submittals",
    description:
      "Drop job-specific submittal PDFs onto each structure — for drawings made outside the drill sheet creator or filled-out sheets a contractor sent back. A structure can take several files.",
    emptyMessage:
      "No structures are waiting on submittals — everything pre-approval already has its paperwork.",
  },
  {
    id: "approvals",
    label: "Approvals",
    description:
      "Drop the signed submittal a contractor returned onto each structure. The file is saved as the approved submittal and the structure is approved for production in one step.",
    emptyMessage: "No structures are awaiting approval.",
  },
];

function targetsForMode(group: BulkAttachJobGroup, mode: BulkAttachMode) {
  return mode === "submittals" ? group.submittalTargets : group.approvalTargets;
}

export function BulkAttachBoard({
  groups,
  initialMode,
}: {
  groups: BulkAttachJobGroup[];
  initialMode: BulkAttachMode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<BulkAttachMode>(initialMode);
  // Uploading is rarely the whole job — the queues are status-driven, so by
  // default an upload also marks the structure submitted (Awaiting approval).
  const [markSubmitted, setMarkSubmitted] = useState(true);
  // Tile state is keyed `${mode}:${structureId}` so switching modes never
  // shows a stale "done" from the other mode's action.
  const [tiles, setTiles] = useState<Record<string, TileState>>({});
  const [draggingTile, setDraggingTile] = useState<string | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  const activeMode = MODES.find((entry) => entry.id === mode) ?? MODES[0];
  const visibleGroups = groups.filter(
    (group) => targetsForMode(group, mode).length > 0,
  );

  function tileKey(structureId: string) {
    return `${mode}:${structureId}`;
  }

  function getTile(structureId: string): TileState {
    return tiles[tileKey(structureId)] ?? IDLE_TILE;
  }

  function setTile(structureId: string, state: TileState) {
    setTiles((current) => ({ ...current, [tileKey(structureId)]: state }));
  }

  function selectMode(id: BulkAttachMode) {
    setMode(id);
    setDraggingTile(null);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", id);
    window.history.replaceState(null, "", url.toString());
  }

  async function handleFiles(target: BulkAttachTarget, incoming: File[]) {
    const files = incoming.filter((file) => file.size > 0);
    if (files.length === 0) {
      return;
    }
    const current = getTile(target.id);
    if (current.status === "busy") {
      return;
    }

    if (mode === "approvals") {
      if (current.status === "done") {
        return;
      }
      if (files.length > 1) {
        setTile(target.id, {
          status: "error",
          message: "Drop one signed file at a time.",
          uploaded: current.uploaded,
        });
        return;
      }
      setTile(target.id, {
        status: "busy",
        message: "Approving…",
        uploaded: current.uploaded,
      });
      const formData = new FormData();
      formData.set("jobStructureId", target.id);
      formData.set("useGeneratedSubmittal", "false");
      formData.set("approvalFile", files[0]);
      const result = await approveStructureForProduction(formData);
      if (result?.error) {
        setTile(target.id, {
          status: "error",
          message: result.error,
          uploaded: current.uploaded,
        });
        return;
      }
      setTile(target.id, {
        status: "done",
        message: "Approved for production",
        uploaded: [files[0].name],
      });
      return;
    }

    const uploaded = [...current.uploaded];
    let submitted = false;
    for (const [index, file] of files.entries()) {
      setTile(target.id, {
        status: "busy",
        message:
          files.length > 1
            ? `Uploading ${index + 1} of ${files.length}…`
            : "Uploading…",
        uploaded,
      });
      const formData = new FormData();
      formData.set("jobStructureId", target.id);
      formData.set("file", file);
      // Only the batch's last file flips the status, so a multi-file drop
      // lands every submittal before the structure moves queues.
      if (markSubmitted && index === files.length - 1) {
        formData.set("markSubmitted", "true");
      }
      const result = await uploadStructureSubmittalFile(formData);
      if (result?.error) {
        setTile(target.id, {
          status: "error",
          message: result.error,
          uploaded,
        });
        return;
      }
      uploaded.push(file.name);
      if ("submitted" in result && result.submitted) {
        submitted = true;
      }
    }
    setTile(target.id, {
      status: "done",
      message: submitted
        ? `Uploaded ${uploaded.length} file${uploaded.length === 1 ? "" : "s"} · marked submitted`
        : null,
      uploaded,
    });
    if (submitted) {
      // The structure just became approval-eligible; refresh so the
      // Approvals tab picks it up without a manual reload.
      router.refresh();
    }
  }

  function renderTile(group: BulkAttachJobGroup, target: BulkAttachTarget) {
    const tile = getTile(target.id);
    const key = tileKey(target.id);
    const disabled = !group.hasFolder || tile.status === "busy";
    const locked = mode === "approvals" && tile.status === "done";
    const isDragging = draggingTile === key;

    const surface = locked
      ? "border-emerald-300 bg-emerald-50"
      : tile.status === "error"
        ? "border-red-300 bg-red-50/60"
        : tile.status === "done"
          ? "border-emerald-300 bg-emerald-50/60"
          : isDragging
            ? "border-sky-500 bg-sky-50"
            : disabled
              ? "border-slate-200 bg-slate-50 opacity-60"
              : "border-slate-300 bg-white hover:border-sky-400 hover:bg-sky-50/40";

    return (
      <div
        key={target.id}
        role="button"
        tabIndex={disabled || locked ? -1 : 0}
        aria-disabled={disabled || locked}
        aria-label={`${mode === "approvals" ? "Drop signed approval for" : "Drop submittals for"} ${target.structureNumber ?? "structure"}`}
        onClick={() => {
          if (!disabled && !locked) {
            inputRefs.current.get(key)?.click();
          }
        }}
        onKeyDown={(event) => {
          if (!disabled && !locked && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRefs.current.get(key)?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !locked) {
            setDraggingTile(key);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !locked) {
            setDraggingTile(key);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDraggingTile((currentKey) => (currentKey === key ? null : currentKey));
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDraggingTile(null);
          if (!disabled && !locked && event.dataTransfer.files.length > 0) {
            void handleFiles(target, Array.from(event.dataTransfer.files));
          }
        }}
        className={`flex min-h-[7.5rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-3 text-center transition-colors ${surface} ${
          disabled || locked ? "cursor-default" : ""
        }`}
      >
        <p className="text-xl font-bold leading-tight text-slate-900">
          {target.structureNumber ?? "—"}
        </p>
        {target.description ? (
          <p
            className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500"
            title={target.description}
          >
            {target.description}
          </p>
        ) : null}

        {tile.status === "busy" ? (
          <p className="mt-1.5 text-[11px] font-medium text-sky-700">
            {tile.message}
          </p>
        ) : tile.status === "error" ? (
          <p className="mt-1.5 text-[11px] font-medium text-red-700">
            {tile.message}
          </p>
        ) : tile.status === "done" || tile.uploaded.length > 0 ? (
          <div className="mt-1.5 space-y-0.5">
            <p className="text-[11px] font-semibold text-emerald-700">
              ✓ {tile.message ?? `Uploaded ${tile.uploaded.length} file${tile.uploaded.length === 1 ? "" : "s"}`}
            </p>
            {tile.uploaded.slice(-2).map((name) => (
              <p
                key={name}
                className="max-w-[14rem] truncate text-[10px] text-emerald-700/80"
                title={name}
              >
                {name}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-slate-400">
            {mode === "approvals"
              ? "Drop signed approval"
              : target.submittalCount > 0
                ? `${target.submittalCount} on file — drop to add more`
                : "Drop submittal PDF"}
          </p>
        )}

        <input
          ref={(element) => {
            if (element) {
              inputRefs.current.set(key, element);
            } else {
              inputRefs.current.delete(key);
            }
          }}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple={mode === "submittals"}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) {
              void handleFiles(target, Array.from(event.target.files));
            }
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {MODES.map((entry) => {
          const count = groups.reduce(
            (sum, group) => sum + targetsForMode(group, entry.id).length,
            0,
          );
          const isActive = entry.id === mode;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectMode(entry.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {entry.label}{" "}
              <span className={isActive ? "text-slate-300" : "text-slate-400"}>
                {count}
              </span>
            </button>
          );
        })}
        <Link
          href="/production"
          className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Production
        </Link>
      </div>

      <p className="text-xs text-slate-500">{activeMode.description}</p>

      {mode === "submittals" ? (
        <label className="flex w-fit cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={markSubmitted}
            onChange={(event) => setMarkSubmitted(event.target.checked)}
            className="mt-0.5 rounded border-slate-300"
          />
          <span>
            <span className="font-medium text-slate-900">
              Mark structures as submitted after upload
            </span>
            <span className="mt-0.5 block text-slate-500">
              Moves them from “Needs submittal” to “Awaiting approval” on the
              production board. Uncheck if the submittal still has to go out
              to the contractor.
            </span>
          </span>
        </label>
      ) : null}

      {visibleGroups.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {activeMode.emptyMessage}
        </div>
      ) : (
        visibleGroups.map((group) => (
          <section
            key={group.jobId}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pb-2.5">
              <Link
                href={`/jobs/${group.jobId}`}
                className="text-sm font-semibold text-slate-900 hover:text-sky-700 hover:underline"
              >
                {group.jobNumber} — {group.projectName}
              </Link>
              <span className="text-xs text-slate-500">{group.customerName}</span>
              {!group.hasFolder ? (
                <span className="text-[11px] font-medium text-amber-600">
                  No job folder yet — create it from the job page before
                  uploading.
                </span>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {targetsForMode(group, mode).map((target) =>
                renderTile(group, target),
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
