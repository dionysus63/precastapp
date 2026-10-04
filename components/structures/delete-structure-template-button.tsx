"use client";

import { useTransition } from "react";
import { deleteStructureTemplate } from "@/app/structures/actions";

type DeleteStructureTemplateButtonProps = {
  templateId: string;
};

export function DeleteStructureTemplateButton({
  templateId,
}: DeleteStructureTemplateButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          "Delete this template? This cannot be undone.",
        );
        if (!confirmed) {
          return;
        }
        startTransition(async () => {
          // Success redirects to the list; a template still used by drill
          // sheets comes back as an error.
          const result = await deleteStructureTemplate(templateId);
          if (result?.error) {
            window.alert(result.error);
          }
        });
      }}
      className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete Template"}
    </button>
  );
}
