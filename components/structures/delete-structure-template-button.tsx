"use client";

import { deleteStructureTemplate } from "@/app/structures/actions";

type DeleteStructureTemplateButtonProps = {
  templateId: string;
};

export function DeleteStructureTemplateButton({
  templateId,
}: DeleteStructureTemplateButtonProps) {
  const action = deleteStructureTemplate.bind(null, templateId);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Delete this template? Drill sheets that used it keep their saved values. This cannot be undone.",
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
        Delete Template
      </button>
    </form>
  );
}
