import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { getSettingsHubStatus } from "@/app/settings/actions";

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
    href: "/settings/price-lists",
    title: "Price Lists",
    description: "Product pricing for quotes and walk-in delivery tickets.",
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
          {settingSections.map((section) => (
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
