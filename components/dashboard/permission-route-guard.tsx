"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  canAccessPathWithPermissions,
  getDefaultHomeForRole,
  type PermissionKey,
  type UserRoleKey,
} from "@/lib/auth/constants";

type PermissionRouteGuardProps = {
  role: UserRoleKey;
  permissions: PermissionKey[];
};

export function PermissionRouteGuard({
  role,
  permissions,
}: PermissionRouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!canAccessPathWithPermissions(permissions, pathname)) {
      // Fall back to the dashboard when the role's home is off-limits too,
      // or this would bounce forever.
      const home = getDefaultHomeForRole(role);
      router.replace(
        canAccessPathWithPermissions(permissions, home) ? home : "/",
      );
    }
  }, [pathname, permissions, role, router]);

  return null;
}
