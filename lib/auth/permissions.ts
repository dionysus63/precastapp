import {
  AppPermission,
  type User,
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

/**
 * Where to send a user who can't open the page they asked for: their role's
 * home if they can open that, else the dashboard ("/" needs no permission).
 * Redirecting to an inaccessible role home looped forever (e.g. a dispatcher
 * with Delivery view denied).
 */
export function getAccessibleHome(
  user: AuthUser,
  permissions: readonly string[],
): string {
  const home = getDefaultHome(user);
  return canAccessPathWithPermissions(permissions as PermissionKey[], home)
    ? home
    : "/";
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
