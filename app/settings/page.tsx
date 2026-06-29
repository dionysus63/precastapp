import Link from "next/link";
import { AppPermission } from "@/app/generated/prisma/client";
import { SectionCard } from "@/components/dashboard/section-card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { getSettingsHubStatus } from "@/app/settings/actions";
import { getCurrentUser, getUserPermissions } from "@/lib/auth/session";

const settingSections = [
  {
    href: "/settings/company",
    title: "Company & Branding",
    description: "Letterhead, contact info, app title, and quote PDF footer.",
  },
  {
    href: "/settings/billing",
    title: "Billing & Quotes",
    description: "Default tax rate, payment terms, quote validity, and invoice due days.",
  },
  {
    href: "/settings/files",
    title: "Files & Folders",
    description: "Jobs root path, PDF output folders, and folder template preview.",
  },
  {
    href: "/settings/operations",
    title: "Fleet & Crew",
    description: "Estimators, trucks, drivers, trailers, and capacity defaults.",
  },
  {
    href: "/settings/system",
    title: "System & Maintenance",
    description: "Document numbering preview, file sync, and sequence setup.",
  },
  {
    href: "/settings/data-reset",
    title: "Data Reset",
    description: "Clear all products or customers. Requires reset password.",
  },
  {
    href: "/settings/price-lists",
    title: "Price Lists",
    description: "Product pricing for quotes and walk-in delivery tickets.",
  },
  {
    href: "/settings/products",
    title: "Product Catalog",
    description: "Product categories and subcategories used on the catalog forms.",
  },
  {
    href: "/settings/rings",
    title: "Ring Builder",
    description: "Top and bottom slab options shown per ring diameter and style.",
  },
  {
    href: "/settings/diameters",
    title: "Structure Diameters",
    description: "Mold limits, key heights, and wall pricing per inside diameter.",
  },
  {
    href: "/settings/casting-suppliers",
    title: "Casting Suppliers",
    description: "Domestic and imported vendors for cast iron casting products.",
  },
  {
    href: "/settings/roles",
    title: "Roles & Permissions",
    description: "Default permissions for each role across the app.",
    adminOnly: true,
  },
  {
    href: "/settings/users",
    title: "Users & Access",
    description: "Manage user accounts, roles, and permission overrides.",
    adminOnly: true,
  },
];

function StatusChip({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold ${ok ? "text-emerald-700" : "text-amber-700"}`}
      >
        {ok ? "OK" : "Check"}
      </p>
      <p className="text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

export default async function SettingsPage() {
  const status = await getSettingsHubStatus();
  const user = await getCurrentUser();
  const permissions = user ? await getUserPermissions(user) : [];
  const canManageUsers = permissions.includes(AppPermission.USERS_MANAGE);
  const visibleSections = settingSections.filter((section) => {
    if ("adminOnly" in section && section.adminOnly) {
      return canManageUsers;
    }

    return true;
  });

  return (
    <SettingsShell
      title="Settings"
      subtitle="Application configuration and shop defaults."
      showBackLink={false}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusChip
          label="Database"
          ok={status.databaseOk}
          detail={status.databaseOk ? "App settings loaded" : "Could not reach database"}
        />
        <StatusChip
          label="Jobs folder"
          ok={status.jobsFolderOk}
          detail={status.jobsFolderOk ? "Path is reachable" : "Path missing or inaccessible"}
        />
        <StatusChip
          label="Next job #"
          ok={status.databaseOk}
          detail={status.nextJobNumber}
        />
        <StatusChip
          label="Indexed files"
          ok={status.indexedFiles > 0}
          detail={`${status.indexedFiles} file record(s)`}
        />
      </div>

      <SectionCard title="Configuration">
        <ul className="grid gap-4 sm:grid-cols-2">
          {visibleSections.map((section) => (
            <li
              key={section.href}
              className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
            >
              <Link
                href={section.href}
                className="text-sm font-semibold text-slate-900 hover:text-slate-700"
              >
                {section.title}
              </Link>
              <p className="mt-1 text-xs text-slate-500">{section.description}</p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </SettingsShell>
  );
}
