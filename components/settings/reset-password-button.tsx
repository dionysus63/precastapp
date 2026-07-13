"use client";

import { useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";

type ResetPasswordButtonProps = {
  userId: string;
  action: (formData: FormData) => Promise<{ tempPassword: string }>;
};

export function ResetPasswordButton({
  userId,
  action,
}: ResetPasswordButtonProps) {
  const confirm = useConfirm();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-3">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const ok = await confirm({
            title: "Reset password?",
            message:
              "This user will be signed out everywhere. You'll get a temporary password to hand to them; they pick a new one after signing in with it.",
            confirmLabel: "Reset password",
            variant: "danger",
          });
          if (!ok) {
            return;
          }
          const result = await action(new FormData(form));
          setTempPassword(result.tempPassword);
        }}
      >
        <input type="hidden" name="id" value={userId} />
        <SubmitButton variant="danger" pendingLabel="Resetting…">
          Reset Password
        </SubmitButton>
      </form>

      {tempPassword ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Temporary password:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold">
            {tempPassword}
          </code>
          <span className="mt-1 block text-xs">
            Give this to the user now — it is not shown again. They sign in
            with it and are asked to choose their own password.
          </span>
        </div>
      ) : null}
    </div>
  );
}
