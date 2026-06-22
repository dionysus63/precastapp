import {
  AppPermission,
  UserRole,
} from "@/app/generated/prisma/client";
import {
  ALL_PERMISSION_KEYS,
  getDefaultHomeForRole,
  getEffectivePermissionsForUser,
  getRolePermissions,
  ROLE_LABELS,
  USER_ROLE_OPTIONS,
  PERMISSION_GROUPS,
  formatPermissionLabel,
  type PermissionKey,
  type UserRoleKey,
} from "@/lib/auth/constants";

export {
  ROLE_LABELS,
  USER_ROLE_OPTIONS,
  PERMISSION_GROUPS,
  formatPermissionLabel,
  getDefaultHomeForRole,
  type PermissionKey,
  type UserRoleKey,
};

export const ALL_APP_PERMISSIONS = Object.values(AppPermission);

export function getRolePermissionsForRole(role: UserRole): AppPermission[] {
  return getRolePermissions(role as UserRoleKey) as AppPermission[];
}

export { getRolePermissionsForRole as getRolePermissions };
