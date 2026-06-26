import { redirect } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";
import { RingBuilderSettingsForm } from "@/components/settings/ring-builder-settings-form";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updateRingBuilderSettingsFormAction } from "@/app/settings/actions";
import { getAppSettings } from "@/lib/app-settings";
import { getAllSubcategories } from "@/lib/product-catalog-settings";
import { getProductCatalog } from "@/lib/product-catalog-settings.server";

type RingBuilderSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function saveRingBuilderSettings(formData: FormData) {
  "use server";
  const result = await updateRingBuilderSettingsFormAction(formData);
  if (result.error) {
    redirect(`/settings/rings?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/rings?success=1");
}

export default async function RingBuilderSettingsPage({
  searchParams,
}: RingBuilderSettingsPageProps) {
  const params = await searchParams;
  const [settings, catalog] = await Promise.all([
    getAppSettings(),
    getProductCatalog(),
  ]);
  const subcategoryOptions = getAllSubcategories(catalog);

  return (
    <SettingsShell
      title="Ring Builder"
      subtitle="Default ring pricing and Other product options per diameter and style."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard
        title="Ring builder defaults"
        description="Set a default price per foot for each ring diameter and style (Drain, Sanitary, Solid). For Drain and Sanitary rows, choose which product subcategories appear as Other options in the quote builder."
      >
        <RingBuilderSettingsForm
          initialConfig={settings.ringBuilderConfig}
          subcategoryOptions={subcategoryOptions}
          action={saveRingBuilderSettings}
        />
      </SectionCard>
    </SettingsShell>
  );
}
