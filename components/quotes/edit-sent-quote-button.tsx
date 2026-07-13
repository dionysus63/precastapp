"use client";

import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm-dialog";

type EditSentQuoteButtonProps = {
  quoteId: string;
  className: string;
};

/**
 * Edit link for a quote that has already been sent: confirms before opening
 * the editor, since in-place edits change the quote without a revision and
 * the customer's copy will no longer match until it is re-sent.
 */
export function EditSentQuoteButton({
  quoteId,
  className,
}: EditSentQuoteButtonProps) {
  const router = useRouter();
  const confirm = useConfirm();

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const ok = await confirm({
          title: "Edit sent quote?",
          message:
            "This quote was already sent to the customer. Editing changes it in place without creating a revision, so the customer's copy won't match until you re-send it. Use Revise Quote instead to keep a record of what was sent.",
          confirmLabel: "Edit without revision",
          variant: "danger",
        });
        if (ok) {
          router.push(`/quotes/${quoteId}/edit`);
        }
      }}
    >
      Edit Quote
    </button>
  );
}
