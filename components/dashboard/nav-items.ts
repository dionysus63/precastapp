import type { PermissionKey } from "@/lib/auth/constants";
import type { NavIconId } from "./nav-icon";

export type NavItem = {
  label: string;
  href: string;
  section: NavSectionId;
  icon: NavIconId;
  requiredPermission?: PermissionKey;
};

export type NavSectionId =
  | "sales"
  | "dispatch"
  | "operations"
  | "purchasing"
  | "catalog"
  | "admin";

export type NavSection = {
  id: NavSectionId;
  label: string;
};

export const navSections: NavSection[] = [
  { id: "sales", label: "Sales" },
  { id: "dispatch", label: "Dispatch" },
  { id: "operations", label: "Operations" },
  { id: "purchasing", label: "Purchasing & Billing" },
  { id: "catalog", label: "Catalog" },
  { id: "admin", label: "Admin" },
];

export const navItems: NavItem[] = [
  {
    label: "Customers",
    href: "/customers",
    section: "sales",
    icon: "users",
    requiredPermission: "CUSTOMERS_VIEW",
  },
  {
    label: "Jobs",
    href: "/jobs",
    section: "sales",
    icon: "briefcase",
    requiredPermission: "JOBS_VIEW",
  },
  {
    label: "Quotes",
    href: "/quotes",
    section: "sales",
    icon: "file-text",
    requiredPermission: "QUOTES_VIEW",
  },
  {
    label: "Shipping Rates",
    href: "/shipping",
    section: "sales",
    icon: "map",
    requiredPermission: "QUOTES_VIEW",
  },
  {
    label: "Delivery Hub",
    href: "/delivery-tickets",
    section: "dispatch",
    icon: "truck",
    requiredPermission: "DELIVERY_VIEW",
  },
  {
    label: "Walk-Ins",
    href: "/walk-ins",
    section: "dispatch",
    icon: "cart",
    requiredPermission: "DELIVERY_VIEW",
  },
  {
    label: "Production",
    href: "/production",
    section: "operations",
    icon: "wrench",
    requiredPermission: "PRODUCTION_VIEW",
  },
  {
    label: "Inventory",
    href: "/inventory",
    section: "operations",
    icon: "box",
    requiredPermission: "INVENTORY_VIEW",
  },
  {
    label: "Receiving",
    href: "/receiving",
    section: "operations",
    icon: "inbox",
    requiredPermission: "INVENTORY_VIEW",
  },
  {
    label: "Purchase Orders",
    href: "/purchase-orders",
    section: "purchasing",
    icon: "clipboard",
    requiredPermission: "INVENTORY_VIEW",
  },
  {
    label: "Invoices",
    href: "/invoices",
    section: "purchasing",
    icon: "dollar",
    requiredPermission: "INVOICES_VIEW",
  },
  {
    label: "Products",
    href: "/products",
    section: "catalog",
    icon: "tag",
    requiredPermission: "PRODUCTS_VIEW",
  },
  {
    label: "Drill Sheet Templates",
    href: "/structures",
    section: "catalog",
    icon: "layers",
    requiredPermission: "STRUCTURES_VIEW",
  },
  {
    label: "Drill Sheet Workbook",
    href: "/drill-sheets",
    section: "catalog",
    icon: "book",
    requiredPermission: "STRUCTURES_VIEW",
  },
  {
    label: "Files",
    href: "/files",
    section: "admin",
    icon: "folder",
    requiredPermission: "FILES_VIEW",
  },
  {
    label: "Settings",
    href: "/settings",
    section: "admin",
    icon: "sliders",
    requiredPermission: "SETTINGS_VIEW",
  },
];
