import type { PermissionKey } from "@/lib/auth/constants";

export type NavItem = {
  label: string;
  href: string;
  requiredPermission?: PermissionKey;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  {
    label: "Customers",
    href: "/customers",
    requiredPermission: "CUSTOMERS_VIEW",
  },
  {
    label: "Products",
    href: "/products",
    requiredPermission: "PRODUCTS_VIEW",
  },
  {
    label: "Structures",
    href: "/structures",
    requiredPermission: "STRUCTURES_VIEW",
  },
  {
    label: "Drill Sheet Workbook",
    href: "/drill-sheets",
    requiredPermission: "STRUCTURES_VIEW",
  },
  {
    label: "Jobs",
    href: "/jobs",
    requiredPermission: "JOBS_VIEW",
  },
  {
    label: "Quotes",
    href: "/quotes",
    requiredPermission: "QUOTES_VIEW",
  },
  {
    label: "Production",
    href: "/production",
    requiredPermission: "PRODUCTION_VIEW",
  },
  {
    label: "Invoices",
    href: "/invoices",
    requiredPermission: "INVOICES_VIEW",
  },
  {
    label: "Delivery Hub",
    href: "/delivery-tickets",
    requiredPermission: "DELIVERY_VIEW",
  },
  {
    label: "Walk-Ins",
    href: "/walk-ins",
    requiredPermission: "DELIVERY_VIEW",
  },
  {
    label: "Inventory",
    href: "/inventory",
    requiredPermission: "INVENTORY_VIEW",
  },
  {
    label: "Files",
    href: "/files",
    requiredPermission: "FILES_VIEW",
  },
  {
    label: "Settings",
    href: "/settings",
    requiredPermission: "SETTINGS_VIEW",
  },
];
