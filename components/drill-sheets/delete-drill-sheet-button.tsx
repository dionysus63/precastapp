"use client";

import { useTransition } from "react";
import { deleteDrillSheet } from "@/app/drill-sheets/actions";

type DeleteDrillSheetButtonProps = {
  drillSheetId: string;
};

export function DeleteDrillSheetButton({
  drillSheetId,
}: DeleteDrillSheetButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          "Delete this drill sheet? This cannot be undone.",
        );
        if (!confirmed) {
          return;
        }
        startTransition(async () => {
          // Success redirects to the drill-sheet list; a refusal comes back
          // as an error (structures on tickets or in production stay).
          const result = await deleteDrillSheet(drillSheetId);
          if (result?.error) {
            window.alert(result.error);
          }
        });
      }}
      className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
