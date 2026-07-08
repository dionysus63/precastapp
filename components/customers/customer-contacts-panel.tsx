"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addCustomerContact,
  deleteCustomerContact,
  setPrimaryCustomerContact,
  setRoleDefaultContact,
  updateCustomerContact,
} from "@/app/customers/contact-actions";
import type { ContactRole } from "@/app/generated/prisma/client";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  contactRoleOptions,
  type ContactRoleValue,
  type CustomerContactRow,
} from "@/components/customers/customer-utils";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

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
  roles: ContactRoleValue[];
};

const emptyForm: ContactFormState = {
  name: "",
  title: "",
  email: "",
  phone: "",
  notes: "",
  roles: [],
};

const roleChipClassNames: Record<ContactRoleValue, string> = {
  ESTIMATING: "bg-sky-100 text-sky-800",
  BILLING: "bg-amber-100 text-amber-800",
  FIELD: "bg-emerald-100 text-emerald-800",
};

function RoleChip({
  role,
  isDefault,
  pending,
  onMakeDefault,
}: {
  role: ContactRoleValue;
  isDefault: boolean;
  pending: boolean;
  onMakeDefault: () => void;
}) {
  const label =
    contactRoleOptions.find((option) => option.value === role)?.label ?? role;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleChipClassNames[role]}`}
    >
      {label}
      {isDefault ? (
        <span title={`Default ${label.toLowerCase()} contact`} aria-hidden>
          ★
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={onMakeDefault}
          title={`Make default ${label.toLowerCase()} contact`}
          className="opacity-40 transition-opacity hover:opacity-100 disabled:opacity-20"
        >
          ☆
        </button>
      )}
    </span>
  );
}

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
      roles: contact.roles,
    });
  }

  function toggleRole(role: ContactRoleValue) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((r) => r !== role)
        : [...current.roles, role],
    }));
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
      const payload = { ...form, roles: form.roles as ContactRole[] };
      const result = editingId
        ? await updateCustomerContact(editingId, payload)
        : await addCustomerContact(customerId, payload);

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
      refresh("Main contact updated.");
    });
  }

  function handleMakeRoleDefault(contactId: string, role: ContactRoleValue) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await setRoleDefaultContact(
        contactId,
        role as ContactRole,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      refresh("Default contact updated.");
    });
  }

  const formVisible = showAddForm || editingId;

  return (
    <SectionCard
      title="Contacts"
      description={`${contacts.length} contact${contacts.length === 1 ? "" : "s"} — ★ marks the default for each role`}
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
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Owner, PM, Office Manager…"
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
              <span className="block text-xs font-medium text-slate-700">
                Handles
              </span>
              <div className="mt-1.5 flex flex-wrap gap-3">
                {contactRoleOptions.map((option) => (
                  <label
                    key={option.value}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={form.roles.includes(option.value)}
                      onChange={() => toggleRole(option.value)}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Estimating gets quotes, Billing gets invoices, Field gets
                delivery tickets.
              </p>
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

      <div className={tableFlushWrapperClassName}>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>Name</th>
              <th className={tableHeaderCellClassName}>Handles</th>
              <th className={tableHeaderCellClassName}>Email</th>
              <th className={tableHeaderCellClassName}>Phone</th>
              <th className={tableHeaderCellClassName}>Actions</th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}
                >
                  No contacts yet. Add the people you quote, bill, and deliver
                  to.
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} className={tableRowClassName}>
                  <td className={tableCellClassName}>
                    <span className="font-medium text-slate-900">
                      {contact.name}
                    </span>
                    {contact.isPrimary ? (
                      <span className="ml-1.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        Main
                      </span>
                    ) : null}
                    {contact.title !== "—" ? (
                      <span className="block text-[11px] text-slate-500">
                        {contact.title}
                      </span>
                    ) : null}
                  </td>
                  <td className={tableCellClassName}>
                    {contact.roles.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {contact.roles.map((role) => (
                          <RoleChip
                            key={role}
                            role={role}
                            isDefault={contact.defaultForRoles.includes(role)}
                            pending={pending}
                            onMakeDefault={() =>
                              handleMakeRoleDefault(contact.id, role)
                            }
                          />
                        ))}
                      </span>
                    )}
                  </td>
                  <td className={`${tableCellClassName} text-slate-600`}>{contact.email}</td>
                  <td className={`${tableCellClassName} text-slate-600`}>{contact.phone}</td>
                  <td className={tableCellClassName}>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => startEdit(contact)}
                        className="text-[11px] font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      {!contact.isPrimary ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleSetPrimary(contact.id)}
                          className="text-[11px] font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                        >
                          Set main
                        </button>
                      ) : null}
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
