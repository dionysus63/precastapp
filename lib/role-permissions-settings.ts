import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  USER_ROLE_KEYS,
  type PermissionKey,
  type UserRoleKey,
} from "@/lib/auth/constants";

const PERMISSION_KEY_SET = new Set<string>(ALL_PERMISSION_KEYS);
const USER_ROLE_KEY_SET = new Set<string>(USER_ROLE_KEYS);

function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

function isUserRoleKey(value: string): value is UserRoleKey {
  return USER_ROLE_KEY_SET.has(value);
}

export function parseRolePermissionsFromStorage(
  value: unknown,
): Record<UserRoleKey, PermissionKey[]> {
  const result: Record<UserRoleKey, PermissionKey[]> = {
    ...DEFAULT_ROLE_PERMISSIONS,
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }

  for (const [roleKey, permissions] of Object.entries(value)) {
    if (!isUserRoleKey(roleKey) || roleKey === "ADMIN") {
      continue;
    }

    if (!Array.isArray(permissions)) {
      continue;
    }

    const parsed = permissions
      .filter((entry): entry is string => typeof entry === "string")
      .filter(isPermissionKey);

    if (parsed.length > 0) {
      result[roleKey] = parsed;
    }
  }

  result.ADMIN = [...ALL_PERMISSION_KEYS];

  return result;
}

export function parseRolePermissionsFromFormData(
  formData: FormData,
): Record<UserRoleKey, PermissionKey[]> {
  const result: Record<UserRoleKey, PermissionKey[]> = {
    ...DEFAULT_ROLE_PERMISSIONS,
  };

  for (const role of USER_ROLE_KEYS) {
    if (role === "ADMIN") {
      result.ADMIN = [...ALL_PERMISSION_KEYS];
      continue;
    }

    const permissions = formData
      .getAll(`rolePermissions.${role}`)
      .map((value) => String(value))
      .filter(isPermissionKey);

    result[role] = permissions;
  }

  return result;
}

export type RolePermissionsMap = Record<UserRoleKey, PermissionKey[]>;
