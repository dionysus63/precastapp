"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import {
  removeProductGroupMemberFormAction,
  reorderProductGroupMembers,
} from "@/app/settings/product-groups/actions";

type MemberRow = {
  id: string;
  productCode: string;
  name: string;
};

/**
 * Vertical member list with drag-to-reorder (same native-drag pattern as the
 * quote line-items table): grab ⋮⋮, drop above/below a row, order persists.
 */
export function GroupMemberReorderTable({
  groupId,
  members,
}: {
  groupId: string;
  members: MemberRow[];
}) {
  const [rows, setRows] = useState(members);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragInfoRef = useRef<{ id: string; index: number } | null>(null);
  const [, startSaveTransition] = useTransition();

  // Server refreshes (adds, removals, other clients) reset the local order.
  const memberKey = members.map((member) => member.id).join("|");
  useEffect(() => {
    setRows(members);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey]);

  function clearDrag() {
    dragInfoRef.current = null;
    setDragId(null);
    setDropIndex(null);
  }

  /** Insertion slot: above the row's top half, below its bottom half. */
  function insertionIndexFor(
    event: DragEvent<HTMLElement>,
    rowIndex: number,
  ): number {
    const row = (event.currentTarget as HTMLElement).closest("li");
    if (!row) {
      return rowIndex;
    }
    const rect = row.getBoundingClientRect();
    return event.clientY - rect.top < rect.height / 2 ? rowIndex : rowIndex + 1;
  }

  function onHandleDragStart(
    event: DragEvent<HTMLElement>,
    rowIndex: number,
    memberId: string,
  ) {
    dragInfoRef.current = { id: memberId, index: rowIndex };
    setDragId(memberId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", memberId);
    const row = (event.currentTarget as HTMLElement).closest("li");
    if (row) {
      event.dataTransfer.setDragImage(row, 16, row.clientHeight / 2);
    }
  }

  function onRowDragOver(event: DragEvent<HTMLElement>, rowIndex: number) {
    if (!dragInfoRef.current) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropIndex(insertionIndexFor(event, rowIndex));
  }

  function onRowDrop(event: DragEvent<HTMLElement>, rowIndex: number) {
    const drag = dragInfoRef.current;
    if (!drag) {
      return;
    }
    event.preventDefault();
    const insertAt = insertionIndexFor(event, rowIndex);
    // Removing the dragged row first shifts later slots up by one.
    const target = insertAt > drag.index ? insertAt - 1 : insertAt;
    clearDrag();
    if (target === drag.index) {
      return;
    }
    setRows((current) => {
      const next = [...current];
      const [moved] = next.splice(drag.index, 1);
      next.splice(target, 0, moved!);
      startSaveTransition(async () => {
        await reorderProductGroupMembers(
          groupId,
          next.map((row) => row.id),
        );
      });
      return next;
    });
  }

  if (rows.length === 0) {
    return <p className="text-xs text-slate-400">No products yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {rows.map((row, index) => {
        const isDragging = dragId === row.id;
        const edge =
          dropIndex === index ? "top" : dropIndex === index + 1 ? "bottom" : null;
        return (
          <li
            key={row.id}
            onDragOver={(event) => onRowDragOver(event, index)}
            onDrop={(event) => onRowDrop(event, index)}
            className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
              isDragging ? "opacity-40" : ""
            } ${
              edge === "top"
                ? "border-t-2 !border-t-sky-500"
                : edge === "bottom"
                  ? "border-b-2 !border-b-sky-500"
                  : ""
            }`}
          >
            <span
              draggable
              onDragStart={(event) => onHandleDragStart(event, index, row.id)}
              onDragEnd={clearDrag}
              title="Drag to reorder"
              aria-label={`Drag ${row.productCode} to reorder`}
              className="inline-flex h-6 w-4 shrink-0 cursor-grab select-none items-center justify-center rounded text-[13px] leading-none text-slate-300 hover:bg-slate-200/70 hover:text-slate-600 active:cursor-grabbing"
            >
              ⋮⋮
            </span>
            <span className="w-6 shrink-0 text-right text-slate-400">
              {index + 1}
            </span>
            <span className="w-28 shrink-0 truncate font-medium text-slate-900">
              {row.productCode}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-600" title={row.name}>
              {row.name}
            </span>
            <form action={removeProductGroupMemberFormAction}>
              <input type="hidden" name="id" value={row.id} />
              <button
                type="submit"
                aria-label={`Remove ${row.productCode}`}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[13px] text-red-500 hover:bg-red-50 hover:text-red-700"
              >
                ✕
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
