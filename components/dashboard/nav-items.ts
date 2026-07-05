import type { PermissionKey } from "@/lib/auth/constants";

export type NavItem = {
  label: string;
  href: string;
  section: NavSectionId;
  requiredPermission?: PermissionKey;
};

export type NavSectionId =
  | "overview"
  | "sales"
  | "operations"
  | "catalog"
  | "admin";

export type NavSection = {
  id: NavSectionId;
  label: string;
};

export const navSections: NavSection[] = [
  { id: "overview", label: "Overview" },
  { id: "sales", label: "Sales" },
  { id: "operations", label: "Operations" },
  { id: "catalog", label: "Catalog" },
  { id: "admin", label: "Admin" },
];

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", section: "overview" },
  {
    label: "Customers",
    href: "/customers",
    section: "sales",
    requiredPermission: "CUSTOMERS_VIEW",
  },
  {
    label: "Jobs",
    href: "/jobs",
    section: "sales",
    requiredPermission: "JOBS_VIEW",
  },
  {
    label: "Quotes",
    href: "/quotes",
    section: "sales",
    requiredPermission: "QUOTES_VIEW",
  },
  {
    label: "Production",
    href: "/production",
    section: "operations",
    requiredPermission: "PRODUCTION_VIEW",
  },
  {
    label: "Invoices",
    href: "/invoices",
    section: "operations",
    requiredPermission: "INVOICES_VIEW",
  },
  {
    label: "Delivery Hub",
    href: "/delivery-tickets",
    section: "operations",
    requiredPermission: "DELIVERY_VIEW",
  },
  {
    label: "Walk-Ins",
    href: "/walk-ins",
    section: "operations",
    requiredPermission: "DELIVERY_VIEW",
  },
  {
    label: "Inventory",
    href: "/inventory",
    section: "operations",
    requiredPermission: "INVENTORY_VIEW",
  },
  {
    label: "Products",
    href: "/products",
    section: "catalog",
    requiredPermission: "PRODUCTS_VIEW",
  },
  {
    label: "Structures",
    href: "/structures",
    section: "catalog",
    requiredPermission: "STRUCTURES_VIEW",
  },
  {
    label: "Drill Sheet Workbook",
    href: "/drill-sheets",
    section: "catalog",
    requiredPermission: "STRUCTURES_VIEW",
  },
  {
    label: "Files",
    href: "/files",
    section: "admin",
    requiredPermission: "FILES_VIEW",
  },
  {
    label: "Settings",
    href: "/settings",
    section: "admin",
    requiredPermission: "SETTINGS_VIEW",
  },
];
