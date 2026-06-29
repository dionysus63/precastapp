export const SESSION_COOKIE_NAME = "precastapp_session";

export const ALL_PERMISSION_KEYS = [
  "CUSTOMERS_VIEW",
  "CUSTOMERS_MANAGE",
  "PRODUCTS_VIEW",
  "PRODUCTS_MANAGE",
  "STRUCTURES_VIEW",
  "STRUCTURES_MANAGE",
  "JOBS_VIEW",
  "JOBS_MANAGE",
  "QUOTES_VIEW",
  "QUOTES_MANAGE",
  "PRODUCTION_VIEW",
  "PRODUCTION_MANAGE",
  "INVOICES_VIEW",
  "INVOICES_MANAGE",
  "DELIVERY_VIEW",
  "DELIVERY_MANAGE",
  "INVENTORY_VIEW",
  "INVENTORY_MANAGE",
  "FILES_VIEW",
  "FILES_MANAGE",
  "SETTINGS_VIEW",
  "SETTINGS_MANAGE",
  "USERS_MANAGE",
] as const;

export type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

export const USER_ROLE_KEYS = [
  "ADMIN",
  "MANAGER",
  "ESTIMATOR",
  "DISPATCHER",
  "PRODUCTION",
  "OFFICE",
  "READ_ONLY",
] as const;

export type UserRoleKey = (typeof USER_ROLE_KEYS)[number];

export const ROLE_LABELS: Record<UserRoleKey, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ESTIMATOR: "Estimator",
  DISPATCHER: "Dispatcher",
  PRODUCTION: "Production",
  OFFICE: "Office",
  READ_ONLY: "Read Only",
};

export const USER_ROLE_OPTIONS = USER_ROLE_KEYS.map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

const VIEW_PERMISSIONS = ALL_PERMISSION_KEYS.filter((permission) =>
  permission.endsWith("_VIEW"),
);

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRoleKey, PermissionKey[]> = {
  ADMIN: [...ALL_PERMISSION_KEYS],
  MANAGER: ALL_PERMISSION_KEYS.filter(
    (permission) => permission !== "USERS_MANAGE",
  ),
  ESTIMATOR: [
    "CUSTOMERS_VIEW",
    "CUSTOMERS_MANAGE",
    "PRODUCTS_VIEW",
    "STRUCTURES_VIEW",
    "STRUCTURES_MANAGE",
    "JOBS_VIEW",
    "JOBS_MANAGE",
    "QUOTES_VIEW",
    "QUOTES_MANAGE",
    "FILES_VIEW",
    "SETTINGS_VIEW",
  ],
  DISPATCHER: [
    "CUSTOMERS_VIEW",
    "JOBS_VIEW",
    "DELIVERY_VIEW",
    "DELIVERY_MANAGE",
    "FILES_VIEW",
  ],
  PRODUCTION: [
    "JOBS_VIEW",
    "PRODUCTION_VIEW",
    "PRODUCTION_MANAGE",
    "INVENTORY_VIEW",
    "FILES_VIEW",
  ],
  OFFICE: [
    "CUSTOMERS_VIEW",
    "CUSTOMERS_MANAGE",
    "JOBS_VIEW",
    "QUOTES_VIEW",
    "INVOICES_VIEW",
    "INVOICES_MANAGE",
    "DELIVERY_VIEW",
    "FILES_VIEW",
  ],
  READ_ONLY: [...VIEW_PERMISSIONS],
};

export function getRolePermissions(role: UserRoleKey): PermissionKey[] {
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [...VIEW_PERMISSIONS];
}

export function getDefaultHomeForRole(role: UserRoleKey): string {
  switch (role) {
    case "DISPATCHER":
      return "/delivery-tickets";
    case "PRODUCTION":
      return "/production";
    case "ESTIMATOR":
      return "/quotes";
    default:
      return "/";
  }
}

export function formatPermissionLabel(permission: PermissionKey): string {
  return permission
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export const PERMISSION_GROUPS: Array<{
  label: string;
  permissions: PermissionKey[];
}> = [
  {
    label: "Customers",
    permissions: ["CUSTOMERS_VIEW", "CUSTOMERS_MANAGE"],
  },
  {
    label: "Products",
    permissions: ["PRODUCTS_VIEW", "PRODUCTS_MANAGE"],
  },
  {
    label: "Structures",
    permissions: ["STRUCTURES_VIEW", "STRUCTURES_MANAGE"],
  },
  {
    label: "Jobs",
    permissions: ["JOBS_VIEW", "JOBS_MANAGE"],
  },
  {
    label: "Quotes",
    permissions: ["QUOTES_VIEW", "QUOTES_MANAGE"],
  },
  {
    label: "Production",
    permissions: ["PRODUCTION_VIEW", "PRODUCTION_MANAGE"],
  },
  {
    label: "Invoices",
    permissions: ["INVOICES_VIEW", "INVOICES_MANAGE"],
  },
  {
    label: "Delivery Hub",
    permissions: ["DELIVERY_VIEW", "DELIVERY_MANAGE"],
  },
  {
    label: "Inventory",
    permissions: ["INVENTORY_VIEW", "INVENTORY_MANAGE"],
  },
  {
    label: "Files",
    permissions: ["FILES_VIEW", "FILES_MANAGE"],
  },
  {
    label: "Settings",
    permissions: ["SETTINGS_VIEW", "SETTINGS_MANAGE"],
  },
  {
    label: "Users",
    permissions: ["USERS_MANAGE"],
  },
];

const ROUTE_PERMISSION_RULES: Array<{
  prefix: string;
  permission: PermissionKey;
}> = [
  { prefix: "/customers", permission: "CUSTOMERS_VIEW" },
  { prefix: "/products", permission: "PRODUCTS_VIEW" },
  { prefix: "/structures", permission: "STRUCTURES_VIEW" },
  { prefix: "/drill-sheets", permission: "STRUCTURES_VIEW" },
  { prefix: "/jobs", permission: "JOBS_VIEW" },
  { prefix: "/quotes", permission: "QUOTES_VIEW" },
  { prefix: "/production", permission: "PRODUCTION_VIEW" },
  { prefix: "/invoices", permission: "INVOICES_VIEW" },
  { prefix: "/delivery-tickets", permission: "DELIVERY_VIEW" },
  { prefix: "/walk-ins", permission: "DELIVERY_VIEW" },
  { prefix: "/inventory", permission: "INVENTORY_VIEW" },
  { prefix: "/files", permission: "FILES_VIEW" },
  { prefix: "/settings/users", permission: "USERS_MANAGE" },
  { prefix: "/settings/roles", permission: "USERS_MANAGE" },
  { prefix: "/settings", permission: "SETTINGS_VIEW" },
];

export function getRequiredPermissionForPath(
  pathname: string,
): PermissionKey | null {
  if (pathname === "/" || pathname === "/profile") {
    return null;
  }

  for (const rule of ROUTE_PERMISSION_RULES) {
    if (
      pathname === rule.prefix ||
      pathname.startsWith(`${rule.prefix}/`)
    ) {
      return rule.permission;
    }
  }

  return null;
}

export function canAccessPathWithPermissions(
  permissions: PermissionKey[],
  pathname: string,
): boolean {
  const requiredPermission = getRequiredPermissionForPath(pathname);
  if (!requiredPermission) {
    return true;
  }

  return permissions.includes(requiredPermission);
}

export function getEffectivePermissionsForUser(input: {
  role: UserRoleKey;
  grantedPermissions: PermissionKey[];
  deniedPermissions: PermissionKey[];
  roleDefaults?: Record<UserRoleKey, PermissionKey[]>;
}): PermissionKey[] {
  const roleDefaults = input.roleDefaults ?? DEFAULT_ROLE_PERMISSIONS;

  if (input.role === "ADMIN") {
    return [...ALL_PERMISSION_KEYS];
  }

  const rolePermissions = new Set(roleDefaults[input.role] ?? VIEW_PERMISSIONS);
  for (const permission of input.grantedPermissions) {
    rolePermissions.add(permission);
  }
  for (const permission of input.deniedPermissions) {
    rolePermissions.delete(permission);
  }

  return ALL_PERMISSION_KEYS.filter((permission) =>
    rolePermissions.has(permission),
  );
}
