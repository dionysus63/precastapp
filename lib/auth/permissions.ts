import {
  AppPermission,
  type User,
  UserRole,
} from "@/app/generated/prisma/client";
import {
  canAccessPathWithPermissions,
  getDefaultHomeForRole,
  getEffectivePermissionsForUser,
  getRequiredPermissionForPath,
  type PermissionKey,
  type UserRoleKey,
} from "@/lib/auth/constants";

export type AuthUser = User;

export function getEffectivePermissions(user: AuthUser): AppPermission[] {
  return getEffectivePermissionsForUser({
    role: user.role as UserRoleKey,
    grantedPermissions: user.grantedPermissions as PermissionKey[],
    deniedPermissions: user.deniedPermissions as PermissionKey[],
  }) as AppPermission[];
}

export function hasPermission(
  user: AuthUser,
  permission: AppPermission,
): boolean {
  return getEffectivePermissions(user).includes(permission);
}

export function getDefaultHome(user: AuthUser): string {
  return getDefaultHomeForRole(user.role);
}

export {
  getRequiredPermissionForPath,
  canAccessPathWithPermissions,
};

export function canAccessPath(user: AuthUser, pathname: string): boolean {
  return canAccessPathWithPermissions(getEffectivePermissions(user), pathname);
}

export function filterNavItems<
  T extends { href: string; requiredPermission?: AppPermission },
>(items: T[], user: AuthUser): T[] {
  const permissions = getEffectivePermissions(user);
  return items.filter((item) => {
    if (!item.requiredPermission) {
      return true;
    }

    return permissions.includes(item.requiredPermission);
  });
}
