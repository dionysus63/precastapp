import {
  AppPermission,
  type User,
  UserRole,
} from "@/app/generated/prisma/client";
import { getRoleDefaults } from "@/lib/app-settings";
import {
  canAccessPathWithPermissions,
  getDefaultHomeForRole,
  getEffectivePermissionsForUser,
  getRequiredPermissionForPath,
  type PermissionKey,
  type UserRoleKey,
} from "@/lib/auth/constants";

export type AuthUser = User;

export async function getEffectivePermissions(
  user: AuthUser,
): Promise<AppPermission[]> {
  const roleDefaults = await getRoleDefaults();

  return getEffectivePermissionsForUser({
    role: user.role as UserRoleKey,
    grantedPermissions: user.grantedPermissions as PermissionKey[],
    deniedPermissions: user.deniedPermissions as PermissionKey[],
    roleDefaults,
  }) as AppPermission[];
}

export async function hasPermission(
  user: AuthUser,
  permission: AppPermission,
): Promise<boolean> {
  const permissions = await getEffectivePermissions(user);
  return permissions.includes(permission);
}

export function getDefaultHome(user: AuthUser): string {
  return getDefaultHomeForRole(user.role);
}

export {
  getRequiredPermissionForPath,
  canAccessPathWithPermissions,
};

export async function canAccessPath(
  user: AuthUser,
  pathname: string,
): Promise<boolean> {
  const permissions = await getEffectivePermissions(user);
  return canAccessPathWithPermissions(permissions, pathname);
}

export async function filterNavItems<
  T extends { href: string; requiredPermission?: AppPermission },
>(items: T[], user: AuthUser): Promise<T[]> {
  const permissions = await getEffectivePermissions(user);
  return items.filter((item) => {
    if (!item.requiredPermission) {
      return true;
    }

    return permissions.includes(item.requiredPermission);
  });
}
