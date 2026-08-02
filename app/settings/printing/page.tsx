import { redirect } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  SettingsFeedback,
  SettingsField,
  SettingsSubmitButton,
  settingsInputClassName,
} from "@/components/settings/settings-form-fields";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updatePrintingSettingsFormAction } from "@/app/settings/actions";
import { getAppSettings } from "@/lib/app-settings";
import { listServerPrinters } from "@/lib/ticket-printing";

type PrintingSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function savePrintingSettings(formData: FormData) {
  "use server";
  const result = await updatePrintingSettingsFormAction(formData);
  if (result.error) {
    redirect(`/settings/printing?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/printing?success=1");
}

type PrinterOption = { value: string; label: string };

/**
 * Dropdown options: printers installed on the server host, plus the saved
 * value (labelled) when it's no longer installed so config never silently
 * disappears from the form.
 */
function buildPrinterOptions(
  installedNames: string[],
  savedName: string | null,
): PrinterOption[] {
  const savedMissing =
    savedName && !installedNames.includes(savedName) ? savedName : null;
  return [
    ...(savedMissing
      ? [
          {
            value: savedMissing,
            label: `${savedMissing} (not installed on server)`,
          },
        ]
      : []),
    ...installedNames.map((name) => ({ value: name, label: name })),
  ];
}

function PrinterFields({
  label,
  printerFieldName,
  colorFieldName,
  savedPrinter,
  savedColorMode,
  options,
}: {
  label: string;
  printerFieldName: string;
  colorFieldName: string;
  savedPrinter: string | null;
  savedColorMode: "color" | "monochrome";
  options: PrinterOption[];
}) {
  return (
    <>
      <SettingsField label={label}>
        <select
          name={printerFieldName}
          defaultValue={savedPrinter ?? ""}
          className={settingsInputClassName}
        >
          <option value="">Not configured — use browser print dialog</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </SettingsField>
      <SettingsField label="Print color">
        <select
          name={colorFieldName}
          defaultValue={savedColorMode}
          className={settingsInputClassName}
        >
          <option value="color">Color</option>
          <option value="monochrome">Black &amp; white</option>
        </select>
      </SettingsField>
    </>
  );
}

export default async function PrintingSettingsPage({
  searchParams,
}: PrintingSettingsPageProps) {
  const params = await searchParams;
  const settings = await getAppSettings();
  const serverPrinters = await listServerPrinters().catch(() => []);
  const installedNames = serverPrinters.map((printer) => printer.name);

  return (
    <SettingsShell
      title="Printing"
      subtitle="Direct-print defaults: jobs go straight from the server to the printer, no browser dialog."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard title="Server printers">
        <p className="mb-4 text-xs text-slate-500">
          Printers listed are the ones installed on the machine running the
          app server. Leave a printer unconfigured to fall back to the browser
          print dialog for that document type.
        </p>
        <form action={savePrintingSettings} className="grid max-w-xl gap-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Delivery tickets
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Used by “Print (3 copies)” on the ticket preview — all three
              copies in one job.
            </p>
          </div>
          <PrinterFields
            label="Ticket printer"
            printerFieldName="ticketPrinterName"
            colorFieldName="ticketPrintColorMode"
            savedPrinter={settings.ticketPrinterName}
            savedColorMode={settings.ticketPrintColorMode}
            options={buildPrinterOptions(
              installedNames,
              settings.ticketPrinterName,
            )}
          />

          <div className="mt-2 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Submittal packages
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Used by “Print submittals” on a delivery ticket’s submittal
              preview.
            </p>
          </div>
          <PrinterFields
            label="Submittal printer"
            printerFieldName="submittalPrinterName"
            colorFieldName="submittalPrintColorMode"
            savedPrinter={settings.submittalPrinterName}
            savedColorMode={settings.submittalPrintColorMode}
            options={buildPrinterOptions(
              installedNames,
              settings.submittalPrinterName,
            )}
          />

          <div className="mt-2 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pay-now invoices
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Copies of the invoice printed by “Print Ticket + Invoice” when a
              walk-in pays at the counter. Prints on the ticket printer.
            </p>
          </div>
          <SettingsField label="Invoice copies">
            <input
              name="invoicePrintCopies"
              type="number"
              min="1"
              max="5"
              step="1"
              defaultValue={settings.invoicePrintCopies}
              className={settingsInputClassName}
            />
          </SettingsField>

          <SettingsSubmitButton>Save</SettingsSubmitButton>
        </form>
      </SectionCard>
    </SettingsShell>
  );
}
