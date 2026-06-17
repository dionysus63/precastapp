export type NavItem = {
  label: string;
  href: string;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Customers", href: "/customers" },
  { label: "Jobs", href: "/jobs" },
  { label: "Quotes", href: "/quotes" },
  { label: "Invoices", href: "/invoices" },
  { label: "Delivery Tickets", href: "/delivery-tickets" },
  { label: "Inventory", href: "/inventory" },
  { label: "Files", href: "/files" },
  { label: "Settings", href: "/settings" },
];
