"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  getSendQuoteDefaults,
  sendQuote,
} from "@/app/quotes/send-actions";
import { quoteInputClassName } from "@/components/quotes/quote-utils";

type SendQuoteButtonProps = {
  quoteId: string;
  quoteNumber: string;
  contactEmail?: string;
  contactName?: string;
  projectName?: string;
  disabled?: boolean;
  disabledReason?: string;
  buttonClassName?: string;
};

export function SendQuoteButton({
  quoteId,
  quoteNumber,
  contactEmail = "",
  contactName = "",
  projectName = "",
  disabled = false,
  disabledReason,
  buttonClassName = "rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
}: SendQuoteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [to, setTo] = useState(contactEmail);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoadingDefaults(true);
    setError(null);
    setSuccess(null);
    setCc("");

    void getSendQuoteDefaults(quoteId).then((result) => {
      if (cancelled) {
        return;
      }

      if ("error" in result) {
        setTo(contactEmail);
        setSubject(
          projectName.trim()
            ? `Quote ${quoteNumber} — ${projectName.trim()}`
            : `Quote ${quoteNumber}`,
        );
        setMessage("");
        setError(result.error);
      } else {
        setTo(result.to || contactEmail);
        setSubject(result.subject);
        setMessage(result.message);
      }

      setLoadingDefaults(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, quoteId, contactEmail, contactName, projectName, quoteNumber]);

  function handleClose() {
    if (pending) {
      return;
    }
    setOpen(false);
    setError(null);
    setSuccess(null);
  }

  function handleSend() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await sendQuote(quoteId, {
        to,
        cc: cc.trim() || undefined,
        subject: subject.trim() || undefined,
        message: message.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(`Quote sent to ${result.sentTo}.`);
      router.refresh();
      window.setTimeout(() => {
        setOpen(false);
        setSuccess(null);
      }, 1200);
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || pending}
        title={disabled ? disabledReason : undefined}
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        {pending ? "Sending..." : "Send Quote"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-900">Send Quote</h3>
            <p className="mt-1 text-xs text-slate-500">
              Email quote {quoteNumber} with the PDF attached. The quote will be
              marked as Sent after delivery.
            </p>

            {loadingDefaults ? (
              <p className="mt-4 text-xs text-slate-500">Loading defaults...</p>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    To
                  </label>
                  <input
                    type="email"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    placeholder="customer@example.com"
                    className={quoteInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    CC (optional)
                  </label>
                  <input
                    type="text"
                    value={cc}
                    onChange={(event) => setCc(event.target.value)}
                    placeholder="estimator@li-precast.com"
                    className={quoteInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className={quoteInputClassName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Message
                  </label>
                  <textarea
                    rows={8}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className={quoteInputClassName}
                  />
                </div>
              </div>
            )}

            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {success}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={pending || loadingDefaults || !to.trim()}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
