import { redirect } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  SettingsFeedback,
  SettingsField,
  settingsInputClassName,
  settingsSubmitClassName,
  settingsTextareaClassName,
} from "@/components/settings/settings-form-fields";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updateBillingSettingsFormAction } from "@/app/settings/actions";
import { formatLinesList as formatList, getAppSettings } from "@/lib/app-settings";

type BillingSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function saveBillingSettings(formData: FormData) {
  "use server";
  const result = await updateBillingSettingsFormAction(formData);
  if (result.error) {
    redirect(`/settings/billing?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/billing?success=1");
}

export default async function BillingSettingsPage({
  searchParams,
}: BillingSettingsPageProps) {
  const params = await searchParams;
  const settings = await getAppSettings();

  return (
    <SettingsShell
      title="Billing & Quotes"
      subtitle="Defaults applied when creating new quotes and invoices."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard title="Billing defaults">
        <form action={saveBillingSettings} className="grid max-w-xl gap-4">
          <SettingsField label="Default sales tax rate (%)">
            <input
              name="defaultTaxRate"
              type="number"
              step="0.001"
              min="0"
              defaultValue={settings.defaultTaxRate}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField
            label="Quote validity (days)"
            hint="Used to pre-fill expiration date on new quotes."
          >
            <input
              name="quoteValidityDays"
              type="number"
              min="1"
              defaultValue={settings.quoteValidityDays}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField
            label="Invoice due (days after issue)"
            hint="Applied when generating invoices from delivery tickets."
          >
            <input
              name="invoiceDueDays"
              type="number"
              min="0"
              defaultValue={settings.invoiceDueDays}
              required
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField label="Default lead time">
            <input
              name="defaultLeadTime"
              defaultValue={settings.defaultLeadTime ?? ""}
              placeholder="e.g. 4–6 weeks ARO"
              className={settingsInputClassName}
            />
          </SettingsField>
          <SettingsField label="Payment terms options" hint="One term per line.">
            <textarea
              name="paymentTerms"
              rows={5}
              defaultValue={formatList(settings.paymentTerms)}
              required
              className={settingsTextareaClassName}
            />
          </SettingsField>
          <button type="submit" className={settingsSubmitClassName}>
            Save
          </button>
        </form>
      </SectionCard>
    </SettingsShell>
  );
}
