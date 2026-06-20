"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ensureYearSequencesAction,
  syncAllJobFilesFromSettingsAction,
  testJobsRootWriteAccessAction,
  testStockSubmittalsRootWriteAccessAction,
} from "@/app/settings/actions";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";

export function JobsRootTestButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await testJobsRootWriteAccessAction();
            setMessage(result);
          })
        }
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Testing…" : "Test write access"}
      </button>
      <SettingsFeedback error={message.error} success={message.success} />
    </div>
  );
}

export function StockSubmittalsRootTestButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await testStockSubmittalsRootWriteAccessAction();
            setMessage(result);
          })
        }
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Testing…" : "Test submittals folder"}
      </button>
      <SettingsFeedback error={message.error} success={message.success} />
    </div>
  );
}

export function SystemMaintenancePanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result);
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(syncAllJobFilesFromSettingsAction)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Sync all job files from disk
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(ensureYearSequencesAction)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Ensure {new Date().getFullYear()} sequences
        </button>
      </div>
      <SettingsFeedback error={message.error} success={message.success} />
    </div>
  );
}
