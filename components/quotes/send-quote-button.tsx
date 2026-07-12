"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  getSendQuoteDefaults,
  openQuoteInOutlook,
  type SendQuoteRecipientOption,
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
  /** Open the send dialog on mount (used by the form's save-then-send flow). */
  defaultOpen?: boolean;
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
  defaultOpen = false,
}: SendQuoteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen && !disabled);
  const [pending, startTransition] = useTransition();
  const [loadingDefaults, setLoadingDefaults] = useState(defaultOpen && !disabled);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contacts, setContacts] = useState<SendQuoteRecipientOption[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(
    new Set(),
  );
  const [extraTo, setExtraTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function openDialog() {
    setLoadingDefaults(true);
    setError(null);
    setSuccess(null);
    setCc("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void getSendQuoteDefaults(quoteId).then((result) => {
      if (cancelled) {
        return;
      }

      if ("error" in result) {
        setContacts([]);
        setSelectedContactIds(new Set());
        setExtraTo(contactEmail);
        setSubject(
          projectName.trim()
            ? `Quote ${quoteNumber} — ${projectName.trim()}`
            : `Quote ${quoteNumber}`,
        );
        setMessage("");
        setError(result.error);
      } else {
        setContacts(result.contacts);
        // Preselect the quote's contact when it matches a customer contact;
        // otherwise fall back to the primary contact. An unmatched default
        // address goes into the free-entry field instead.
        const defaultEmail = result.to.trim().toLowerCase();
        const matching = result.contacts.filter(
          (contact) => contact.email.toLowerCase() === defaultEmail,
        );
        const preselected =
          matching.length > 0
            ? matching
            : result.contacts.filter((contact) => contact.isPrimary);
        setSelectedContactIds(
          new Set(preselected.map((contact) => contact.id)),
        );
        setExtraTo(
          defaultEmail && matching.length === 0 ? result.to.trim() : "",
        );
        setSubject(result.subject);
        setMessage(result.message);
      }

      setLoadingDefaults(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, quoteId, contactEmail, contactName, projectName, quoteNumber]);

  function toggleContact(contactId: string) {
    setSelectedContactIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }

  const selectedEmails = contacts
    .filter((contact) => selectedContactIds.has(contact.id))
    .map((contact) => contact.email);
  const combinedTo = [selectedEmails.join(", "), extraTo.trim()]
    .filter(Boolean)
    .join(", ");

  function handleClose() {
    if (pending) {
      return;
    }
    setOpen(false);
    setError(null);
    setSuccess(null);
  }

  function handleOpenInOutlook() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await openQuoteInOutlook(quoteId, {
        to: combinedTo,
        cc: cc.trim() || undefined,
        subject: subject.trim() || undefined,
        message: message.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(
        `Outlook draft opened for ${result.to}. Review and hit Send in Outlook.`,
      );
      router.refresh();
      window.setTimeout(() => {
        setOpen(false);
        setSuccess(null);
      }, 2500);
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || pending}
        title={disabled ? disabledReason : undefined}
        onClick={openDialog}
        className={buttonClassName}
      >
        {pending ? "Preparing..." : "Send Quote"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-900">Send Quote</h3>
            <p className="mt-1 text-xs text-slate-500">
              Pick who to send quote {quoteNumber} to. An Outlook draft opens
              with the PDF attached — review it and hit Send there. The quote
              is marked Sent when the draft is created.
            </p>

            {loadingDefaults ? (
              <p className="mt-4 text-xs text-slate-500">Loading defaults...</p>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="block text-xs font-medium text-slate-700">
                    Send to
                  </p>
                  {contacts.length > 0 ? (
                    <div className="mt-1 space-y-1 rounded-lg border border-slate-200 p-2">
                      {contacts.map((contact) => (
                        <label
                          key={contact.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-800 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedContactIds.has(contact.id)}
                            onChange={() => toggleContact(contact.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          <span className="font-medium">{contact.name}</span>
                          {contact.title ? (
                            <span className="text-slate-500">
                              {contact.title}
                            </span>
                          ) : null}
                          <span className="ml-auto text-slate-500">
                            {contact.email}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      No customer contacts with an email address — enter one
                      below.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Other recipients (optional)
                  </label>
                  <input
                    type="text"
                    value={extraTo}
                    onChange={(event) => setExtraTo(event.target.value)}
                    placeholder="someone@example.com, another@example.com"
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
                onClick={handleOpenInOutlook}
                disabled={pending || loadingDefaults || !combinedTo.trim()}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Preparing draft..." : "Open in Outlook"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
