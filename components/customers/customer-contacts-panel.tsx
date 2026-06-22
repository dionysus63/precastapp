"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addCustomerContact,
  deleteCustomerContact,
  setPrimaryCustomerContact,
  updateCustomerContact,
} from "@/app/customers/contact-actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { CustomerContactRow } from "@/components/customers/customer-utils";

type CustomerContactsPanelProps = {
  customerId: string;
  contacts: CustomerContactRow[];
};

type ContactFormState = {
  name: string;
  title: string;
  email: string;
  phone: string;
  notes: string;
};

const emptyForm: ContactFormState = {
  name: "",
  title: "",
  email: "",
  phone: "",
  notes: "",
};

export function CustomerContactsPanel({
  customerId,
  contacts,
}: CustomerContactsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFormState>(emptyForm);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowAddForm(false);
  }

  function startEdit(contact: CustomerContactRow) {
    setEditingId(contact.id);
    setShowAddForm(false);
    setForm({
      name: contact.name,
      title: contact.title === "—" ? "" : contact.title,
      email: contact.email === "—" ? "" : contact.email,
      phone: contact.phone === "—" ? "" : contact.phone,
      notes: contact.notes === "—" ? "" : contact.notes,
    });
  }

  function refresh(message?: string) {
    setError(null);
    if (message) {
      setSuccess(message);
    }
    resetForm();
    router.refresh();
  }

  function handleSave() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = editingId
        ? await updateCustomerContact(editingId, form)
        : await addCustomerContact(customerId, form);

      if (result.error) {
        setError(result.error);
        return;
      }

      refresh(editingId ? "Contact updated." : "Contact added.");
    });
  }

  function handleDelete(contactId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await deleteCustomerContact(contactId);
      if (result.error) {
        setError(result.error);
        return;
      }
      refresh("Contact removed.");
    });
  }

  function handleSetPrimary(contactId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await setPrimaryCustomerContact(contactId);
      if (result.error) {
        setError(result.error);
        return;
      }
      refresh("Primary contact updated.");
    });
  }

  const formVisible = showAddForm || editingId;

  return (
    <SectionCard
      title="Contacts"
      description={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
      action={
        !formVisible ? (
          <button
            type="button"
            onClick={() => {
              setShowAddForm(true);
              setEditingId(null);
              setForm(emptyForm);
            }}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
          >
            Add Contact
          </button>
        ) : null
      }
      noPadding={!formVisible}
    >
      {formVisible ? (
        <div className="space-y-4 border-b border-slate-100 p-4">
          <p className="text-xs font-medium text-slate-900">
            {editingId ? "Edit Contact" : "New Contact"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Role
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Estimator, PM, etc."
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700">
                Notes
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            At least one of email or phone is required.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Saving…" : editingId ? "Save Contact" : "Add Contact"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={resetForm}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 font-semibold">Name</th>
              <th className="px-3 py-2.5 font-semibold">Role</th>
              <th className="px-3 py-2.5 font-semibold">Email</th>
              <th className="px-3 py-2.5 font-semibold">Phone</th>
              <th className="px-3 py-2.5 font-semibold">Primary</th>
              <th className="px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  No contacts yet. Add the people you quote and deliver to.
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {contact.name}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{contact.title}</td>
                  <td className="px-3 py-2.5 text-slate-600">{contact.email}</td>
                  <td className="px-3 py-2.5 text-slate-600">{contact.phone}</td>
                  <td className="px-3 py-2.5">
                    {contact.isPrimary ? (
                      <StatusBadge label="Primary" variant="success" />
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleSetPrimary(contact.id)}
                        className="text-[11px] font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                      >
                        Set primary
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => startEdit(contact)}
                        className="text-[11px] font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleDelete(contact.id)}
                        className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error ? <p className="px-3 py-2 text-xs text-red-600">{error}</p> : null}
      {success ? (
        <p className="px-3 py-2 text-xs text-emerald-700">{success}</p>
      ) : null}
    </SectionCard>
  );
}
