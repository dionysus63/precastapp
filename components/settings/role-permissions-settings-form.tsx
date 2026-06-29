"use client";

import { useMemo, useState } from "react";
import {
  ALL_PERMISSION_KEYS,
  formatPermissionLabel,
  PERMISSION_GROUPS,
  ROLE_LABELS,
  USER_ROLE_KEYS,
  type PermissionKey,
  type UserRoleKey,
} from "@/lib/auth/constants";
import type { RolePermissionsMap } from "@/lib/role-permissions-settings";

type RolePermissionsSettingsFormProps = {
  action: (formData: FormData) => Promise<void>;
  roleDefaults: RolePermissionsMap;
};

const EDITABLE_ROLES = USER_ROLE_KEYS.filter((role) => role !== "ADMIN");

export function RolePermissionsSettingsForm({
  action,
  roleDefaults,
}: RolePermissionsSettingsFormProps) {
  const [selectedRole, setSelectedRole] = useState<UserRoleKey>("MANAGER");
  const [permissionsByRole, setPermissionsByRole] =
    useState<RolePermissionsMap>(roleDefaults);

  const selectedPermissions = useMemo(
    () => new Set(permissionsByRole[selectedRole] ?? []),
    [permissionsByRole, selectedRole],
  );

  function togglePermission(permission: PermissionKey) {
    setPermissionsByRole((current) => {
      const rolePermissions = new Set(current[selectedRole] ?? []);
      if (rolePermissions.has(permission)) {
        rolePermissions.delete(permission);
      } else {
        rolePermissions.add(permission);
      }

      return {
        ...current,
        [selectedRole]: ALL_PERMISSION_KEYS.filter((key) =>
          rolePermissions.has(key),
        ),
      };
    });
  }

  return (
    <form action={action} className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {EDITABLE_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setSelectedRole(role)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              selectedRole === role
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
        <p className="font-medium text-slate-900">Admin role</p>
        <p className="mt-1">
          Admin always has every permission and cannot be edited here.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {ROLE_LABELS[selectedRole]} defaults
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          These permissions apply to every user with this role unless they have
          personal overrides.
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
                  <label
                    key={permission}
                    className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-slate-800">
                      {formatPermissionLabel(permission)}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.has(permission)}
                        onChange={() => togglePermission(permission)}
                      />
                      Allowed
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {EDITABLE_ROLES.flatMap((role) =>
        (permissionsByRole[role] ?? []).map((permission) => (
          <input
            key={`${role}-${permission}`}
            type="hidden"
            name={`rolePermissions.${role}`}
            value={permission}
          />
        )),
      )}

      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
      >
        Save Role Defaults
      </button>
    </form>
  );
}
