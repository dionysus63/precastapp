import { redirect } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";
import { ProductCatalogSettingsForm } from "@/components/settings/product-catalog-settings-form";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updateProductCatalogSettingsFormAction } from "@/app/settings/actions";
import {
  getProductCatalog,
  getProductCatalogUsage,
} from "@/lib/product-catalog-settings.server";

type ProductCatalogSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function saveProductCatalogSettings(formData: FormData) {
  "use server";
  const result = await updateProductCatalogSettingsFormAction(formData);
  if (result.error) {
    redirect(`/settings/products?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/settings/products?success=1");
}

export default async function ProductCatalogSettingsPage({
  searchParams,
}: ProductCatalogSettingsPageProps) {
  const params = await searchParams;
  const [catalog, usage] = await Promise.all([
    getProductCatalog(),
    getProductCatalogUsage(),
  ]);

  return (
    <SettingsShell
      title="Product Catalog"
      subtitle="Dropdown options for product category and subcategory."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard
        title="Categories and subcategories"
        description="Each category has its own subcategory list. Product forms show subcategories for the selected category only. Renaming a category or subcategory can update matching products after you confirm. Removing in-use values is still blocked."
      >
        <ProductCatalogSettingsForm
          initialCatalog={catalog}
          usage={usage}
          action={saveProductCatalogSettings}
        />
      </SectionCard>
    </SettingsShell>
  );
}
