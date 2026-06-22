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
      router.replace(getDefaultHomeForRole(role));
    }
  }, [pathname, permissions, role, router]);

  return null;
}
