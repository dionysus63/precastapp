"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { customerInputClassName } from "@/components/customers/customer-form";
import {
  formatPermissionLabel,
  getEffectivePermissionsForUser,
  getRolePermissions,
  PERMISSION_GROUPS,
  ROLE_LABELS,
  USER_ROLE_OPTIONS,
  type PermissionKey,
  type UserRoleKey,
} from "@/lib/auth/constants";

export type UserPermissionsFormValues = {
  id?: string;
  username?: string;
  displayName: string;
  initials: string;
  email: string;
  role: UserRoleKey;
  isActive: boolean;
  grantedPermissions: PermissionKey[];
  deniedPermissions: PermissionKey[];
};

type UserPermissionsFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  submitLabel: string;
  defaultValues: UserPermissionsFormValues;
  showUsernameField?: boolean;
};

export function UserPermissionsForm({
  action,
  cancelHref,
  submitLabel,
  defaultValues,
  showUsernameField = false,
}: UserPermissionsFormProps) {
  const [role, setRole] = useState(defaultValues.role);
  const [grantedPermissions, setGrantedPermissions] = useState<PermissionKey[]>(
    defaultValues.grantedPermissions,
  );
  const [deniedPermissions, setDeniedPermissions] = useState<PermissionKey[]>(
    defaultValues.deniedPermissions,
  );

  const effectivePermissions = useMemo(() => {
    return getEffectivePermissionsForUser({
      role,
      grantedPermissions,
      deniedPermissions,
    });
  }, [deniedPermissions, grantedPermissions, role]);

  function toggleGranted(permission: PermissionKey) {
    setGrantedPermissions((current) =>
      current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission],
    );
  }

  function toggleDenied(permission: PermissionKey) {
    setDeniedPermissions((current) =>
      current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission],
    );
  }

  return (
    <form action={action} className="space-y-6">
      {defaultValues.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {showUsernameField ? (
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-slate-700"
            >
              Username *
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              placeholder="jane.doe"
              className={customerInputClassName}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Lowercase letters, numbers, dots, dashes, and underscores only.
            </p>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="displayName"
            className="block text-xs font-medium text-slate-700"
          >
            Display Name *
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            defaultValue={defaultValues.displayName}
            className={customerInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="initials"
            className="block text-xs font-medium text-slate-700"
          >
            Initials *
          </label>
          <input
            id="initials"
            name="initials"
            type="text"
            required
            maxLength={3}
            defaultValue={defaultValues.initials}
            className={customerInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues.email}
            className={customerInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="role"
            className="block text-xs font-medium text-slate-700"
          >
            Role *
          </label>
          <select
            id="role"
            name="role"
            required
            value={role}
            onChange={(event) => setRole(event.target.value as UserRoleKey)}
            className={customerInputClassName}
          >
            {USER_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={defaultValues.isActive}
              className="rounded border-slate-300"
            />
            Active account
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
        <p className="font-medium text-slate-900">Password login coming soon</p>
        <p className="mt-1">
          Users sign in by choosing their account for now. Password fields will
          be added here later.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Permission overrides
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Role preset: {ROLE_LABELS[role]} ({getRolePermissions(role).length}{" "}
          permissions). Grant or deny individual permissions below.
        </p>

        <div className="mt-4 space-y-4">
          {PERMISSION_GROUPS.map((group) => (
            <div
              key={group.label}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </p>
              <div className="mt-3 space-y-2">
                {group.permissions.map((permission) => (
                  <div
                    key={permission}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"
                  >
                    <span className="text-xs font-medium text-slate-800">
                      {formatPermissionLabel(permission)}
                    </span>
                    <div className="flex items-center gap-4 text-[11px]">
                      <label className="flex items-center gap-1.5 text-emerald-700">
                        <input
                          type="checkbox"
                          checked={grantedPermissions.includes(permission)}
                          onChange={() => toggleGranted(permission)}
                        />
                        Grant
                      </label>
                      <label className="flex items-center gap-1.5 text-red-700">
                        <input
                          type="checkbox"
                          checked={deniedPermissions.includes(permission)}
                          onChange={() => toggleDenied(permission)}
                        />
                        Deny
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {grantedPermissions.map((permission) => (
        <input
          key={`grant-${permission}`}
          type="hidden"
          name="grantedPermissions"
          value={permission}
        />
      ))}
      {deniedPermissions.map((permission) => (
        <input
          key={`deny-${permission}`}
          type="hidden"
          name="deniedPermissions"
          value={permission}
        />
      ))}

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Effective permissions
        </p>
        <p className="mt-2 text-xs text-slate-600">
          {effectivePermissions.length} permission
          {effectivePermissions.length === 1 ? "" : "s"} after role preset and
          overrides.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {effectivePermissions.map((permission) => (
            <span
              key={permission}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
            >
              {formatPermissionLabel(permission)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <Link
          href={cancelHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
