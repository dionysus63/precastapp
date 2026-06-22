"use client";

import { deleteDrillSheet } from "@/app/drill-sheets/actions";

type DeleteDrillSheetButtonProps = {
  drillSheetId: string;
};

export function DeleteDrillSheetButton({
  drillSheetId,
}: DeleteDrillSheetButtonProps) {
  const action = deleteDrillSheet.bind(null, drillSheetId);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Delete this drill sheet? This cannot be undone.",
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
    </form>
  );
}
