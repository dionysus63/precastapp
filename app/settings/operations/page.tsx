import { redirect } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  SettingsFeedback,
  SettingsField,
  SettingsSubmitButton,
  settingsInputClassName,
  settingsTextareaClassName,
} from "@/components/settings/settings-form-fields";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updateOperationsSettingsFormAction } from "@/app/settings/actions";
import { formatLinesList, getAppSettings } from "@/lib/app-settings";
import { listServerPrinters } from "@/lib/ticket-printing";

type OperationsSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function saveOperationsSettings(formData: FormData) {
  "use server";
  const result = await updateOperationsSettingsFormAction(formData);
  if (result.error) {
    redirect(`/settings/operations?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/operations?success=1");
}

export default async function OperationsSettingsPage({
  searchParams,
}: OperationsSettingsPageProps) {
  const params = await searchParams;
  const settings = await getAppSettings();
  // Printers installed on the machine running the app server. If enumeration
  // fails the dropdown still offers "not configured" plus the saved value.
  const serverPrinters = await listServerPrinters().catch(() => []);
  const installedNames = serverPrinters.map((printer) => printer.name);
  // Keep the saved printer selectable even when it's gone from the server,
  // but label it so it can't be mistaken for an installed printer.
  const savedMissing =
    settings.ticketPrinterName &&
    !installedNames.includes(settings.ticketPrinterName)
      ? settings.ticketPrinterName
      : null;
  const printerOptions = [
    ...(savedMissing
      ? [{ value: savedMissing, label: `${savedMissing} (not installed on server)` }]
      : []),
    ...installedNames.map((name) => ({ value: name, label: name })),
  ];

  return (
    <SettingsShell
      title="Fleet & Crew"
      subtitle="Dropdown options for quotes and delivery tickets."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard title="Shop floor lists">
        <form action={saveOperationsSettings} className="grid max-w-xl gap-4">
          <SettingsField label="Estimators" hint="One name per line.">
            <textarea
              name="estimators"
              rows={4}
              defaultValue={formatLinesList(settings.estimators)}
              required
              className={settingsTextareaClassName}
            />
          </SettingsField>
          <SettingsField label="Drivers">
            <textarea
              name="drivers"
              rows={4}
              defaultValue={formatLinesList(settings.drivers)}
              required
              className={settingsTextareaClassName}
            />
          </SettingsField>
          <SettingsField label="Trailers">
            <textarea
              name="trailers"
              rows={4}
              defaultValue={formatLinesList(settings.trailers)}
              required
              className={settingsTextareaClassName}
            />
          </SettingsField>
          <SettingsField label="Default load capacity">
            <input
              name="loadCapacityLabel"
              defaultValue={settings.truckCapacityLabel}
              required
              className={settingsInputClassName}
            />
          </SettingsField>

          <div className="mt-2 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ticket printing
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              When a printer is set, “Print (3 copies)” on the ticket preview
              prints directly from the server — no browser print dialog.
              Printers listed are the ones installed on the server machine.
            </p>
          </div>
          <SettingsField label="Ticket printer">
            <select
              name="ticketPrinterName"
              defaultValue={settings.ticketPrinterName ?? ""}
              className={settingsInputClassName}
            >
              <option value="">Not configured — use browser print dialog</option>
              {printerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SettingsField>
          <SettingsField label="Print color">
            <select
              name="ticketPrintColorMode"
              defaultValue={settings.ticketPrintColorMode}
              className={settingsInputClassName}
            >
              <option value="color">Color</option>
              <option value="monochrome">Black &amp; white</option>
            </select>
          </SettingsField>
          <SettingsSubmitButton>Save</SettingsSubmitButton>
        </form>
      </SectionCard>
    </SettingsShell>
  );
}
