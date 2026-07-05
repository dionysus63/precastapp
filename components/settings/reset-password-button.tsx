"use client";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";

type ResetPasswordButtonProps = {
  userId: string;
  action: (formData: FormData) => Promise<void>;
};

export function ResetPasswordButton({
  userId,
  action,
}: ResetPasswordButtonProps) {
  const confirm = useConfirm();

  return (
    <form
      className="mt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const ok = await confirm({
          title: "Reset password?",
          message:
            "This user will be signed out and must create a new password on next sign-in.",
          confirmLabel: "Reset password",
          variant: "danger",
        });
        if (!ok) {
          return;
        }
        await action(new FormData(event.currentTarget));
      }}
    >
      <input type="hidden" name="id" value={userId} />
      <SubmitButton variant="danger" pendingLabel="Resetting…">
        Reset Password
      </SubmitButton>
    </form>
  );
}
