export type ProductType =
  | "STOCK"
  | "CONFIGURABLE"
  | "CUSTOM_STRUCTURE"
  | "SERVICE"
  | "MATERIAL";

export type ProductRow = {
  id: string;
  productCode: string;
  productName: string;
  productType: ProductType;
  productTypeLabel: string;
  productTypeVariant: "success" | "info" | "warning" | "neutral";
  category: string;
  subcategory: string;
  categoryVariant: "info" | "neutral" | "default";
  unit: string;
  defaultPrice: string;
  weight: string;
  yards: string;
  trackInventory: boolean;
  status: string;
  statusVariant: "success" | "neutral" | "warning";
  submittalCount: number;
  isCasting?: boolean;
};

export const productTypeLabels: Record<ProductType, string> = {
  STOCK: "Stock",
  CONFIGURABLE: "Configurable",
  CUSTOM_STRUCTURE: "Custom Structure",
  SERVICE: "Service",
  MATERIAL: "Material",
};

export const productTypeFilterOptions = [
  "All",
  "Stock",
  "Configurable",
  "Custom Structure",
  "Service",
  "Material",
];

export const productTypeFormOptions: { value: ProductType; label: string }[] = [
  { value: "STOCK", label: "STOCK — Stock" },
  { value: "CONFIGURABLE", label: "CONFIGURABLE — Configurable" },
  { value: "CUSTOM_STRUCTURE", label: "CUSTOM_STRUCTURE — Custom Structure" },
  { value: "SERVICE", label: "SERVICE — Service" },
  { value: "MATERIAL", label: "MATERIAL — Material" },
];

export const productTypeHelperText: Record<ProductType, string> = {
  STOCK:
    "Standard products made the same way each time and kept in inventory.",
  CONFIGURABLE:
    "Reusable product templates that need job-specific cut sheets and openings.",
  CUSTOM_STRUCTURE:
    "Custom job-specific structure templates with their own submittals and cut sheets.",
  SERVICE: "Labor or service items billed without standard inventory tracking.",
  MATERIAL: "Raw materials or supply items used in production or quoting.",
};

export const productCategoryFilterOptions = [
  "All",
  "Vaults",
  "Manholes",
  "Walls",
  "Slabs",
  "Drainage",
  "Accessories",
];

export const productSubcategoryFilterOptions = [
  "All",
  "Traffic Rated",
  "Standard Duty",
  "Light Duty",
  "Riser",
  "H8 Panel",
  "Catch Basin",
  "Sanitary Sewer",
  "Equipment Pad",
  "Lifting Hardware",
];

export const productStatusFilterOptions = [
  "All",
  "Active",
  "Inactive",
  "Discontinued",
];

export const productInventoryFilterOptions = ["All", "Yes", "No"];

export const productSubmittalsFilterOptions = [
  "All",
  "Has submittals",
  "Missing submittals",
];

export const productCategoryFormOptions = [
  "Vaults",
  "Manholes",
  "Walls",
  "Slabs",
  "Drainage",
  "Accessories",
];

export const productSubcategoryFormOptions = [
  "Traffic Rated",
  "Standard Duty",
  "Light Duty",
  "Riser",
  "Cone",
  "Base Section",
  "H6 Panel",
  "H8 Panel",
  "Corner Panel",
  "Catch Basin",
  "Sanitary Sewer",
  "Equipment Pad",
  "Sidewalk Slab",
  "Lifting Hardware",
  "Connection Hardware",
];

export const productUnitFormOptions = ["EA", "LF", "SF", "CY", "Ton"];

export const productStatusFormOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

function productTypeVariant(
  productType: ProductType,
): ProductRow["productTypeVariant"] {
  switch (productType) {
    case "STOCK":
      return "success";
    case "CONFIGURABLE":
      return "info";
    case "CUSTOM_STRUCTURE":
      return "warning";
    default:
      return "neutral";
  }
}

export const placeholderProducts: ProductRow[] = [
  {
    id: "1",
    productCode: "CB-4x4",
    productName: "4'x4' Catch Basin",
    productType: "STOCK",
    productTypeLabel: productTypeLabels.STOCK,
    productTypeVariant: productTypeVariant("STOCK"),
    category: "Drainage",
    subcategory: "Catch Basin",
    categoryVariant: "neutral",
    unit: "EA",
    defaultPrice: "$620.00",
    weight: "1,850 lb",
    yards: "0.4",
    trackInventory: true,
    submittalCount: 0,
    status: "Active",
    statusVariant: "success",
  },
  {
    id: "2",
    productCode: "MH-SC-SS",
    productName: "Suffolk County Sanitary Sewer Manhole",
    productType: "CONFIGURABLE",
    productTypeLabel: productTypeLabels.CONFIGURABLE,
    productTypeVariant: productTypeVariant("CONFIGURABLE"),
    category: "Manholes",
    subcategory: "Sanitary Sewer",
    categoryVariant: "default",
    unit: "EA",
    defaultPrice: "$2,400.00",
    weight: "—",
    yards: "—",
    trackInventory: false,
    submittalCount: 0,
    status: "Active",
    statusVariant: "success",
  },
  {
    id: "3",
    productCode: "CST-TEMPLATE",
    productName: "Custom Structure Template",
    productType: "CUSTOM_STRUCTURE",
    productTypeLabel: productTypeLabels.CUSTOM_STRUCTURE,
    productTypeVariant: productTypeVariant("CUSTOM_STRUCTURE"),
    category: "Manholes",
    subcategory: "Sanitary Sewer",
    categoryVariant: "default",
    unit: "EA",
    defaultPrice: "—",
    weight: "—",
    yards: "—",
    trackInventory: false,
    submittalCount: 0,
    status: "Active",
    statusVariant: "success",
  },
  {
    id: "4",
    productCode: "VLT-48x72",
    productName: "48x72 Utility Vault",
    productType: "STOCK",
    productTypeLabel: productTypeLabels.STOCK,
    productTypeVariant: productTypeVariant("STOCK"),
    category: "Vaults",
    subcategory: "Traffic Rated",
    categoryVariant: "info",
    unit: "EA",
    defaultPrice: "$4,850.00",
    weight: "8,400 lb",
    yards: "2.4",
    trackInventory: true,
    submittalCount: 0,
    status: "Active",
    statusVariant: "success",
  },
  {
    id: "5",
    productCode: "RW-8-H8",
    productName: "8' Retaining Wall Panel H8",
    productType: "STOCK",
    productTypeLabel: productTypeLabels.STOCK,
    productTypeVariant: productTypeVariant("STOCK"),
    category: "Walls",
    subcategory: "H8 Panel",
    categoryVariant: "neutral",
    unit: "LF",
    defaultPrice: "$185.00",
    weight: "420 lb/LF",
    yards: "0.08",
    trackInventory: true,
    submittalCount: 0,
    status: "Active",
    statusVariant: "success",
  },
  {
    id: "6",
    productCode: "ACC-LIF-001",
    productName: "Cast Iron Lifting Pin Set",
    productType: "STOCK",
    productTypeLabel: productTypeLabels.STOCK,
    productTypeVariant: productTypeVariant("STOCK"),
    category: "Accessories",
    subcategory: "Lifting Hardware",
    categoryVariant: "default",
    unit: "EA",
    defaultPrice: "$48.00",
    weight: "12 lb",
    yards: "—",
    trackInventory: true,
    submittalCount: 0,
    status: "Inactive",
    statusVariant: "neutral",
  },
];

export function getProductById(id: string): ProductRow | undefined {
  return placeholderProducts.find((product) => product.id === id);
}

export const productInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export type BulkProductPasteRow = {
  lineNumber: number;
  productCode: string;
  productName: string;
  category: string;
  subcategory: string;
  unit: string;
  defaultPrice: string;
  weight: string;
  yards: string;
  trackInventory: string;
  isDrainRing: string;
  ringDiameterFeet: string;
  heightFeet: string;
  ringStyle: string;
  isValid: boolean;
  issues: string[];
};

export const bulkPasteColumnHeaders = [
  "Product Code",
  "Product Name",
  "Category",
  "Subcategory",
  "Unit",
  "Default Price",
  "Weight",
  "Yards",
  "Track Inventory",
  "Ring",
  "Ring Diameter (ft)",
  "Ring Height (ft)",
  "Style (DRAIN/SAN/SOL)",
];

export const bulkPasteExample = `VLT-60x84\t60x84 Utility Vault\tVaults\tTraffic Rated\tEach\t6200.00\t10200 lb\t3.1\tYes
MH-48-R\t48" Manhole Riser\tManholes\tRiser\tEach\t980.00\t1650 lb\t0.5\tYes
RW-6-H6\t6' Retaining Wall H6\tWalls\tH6 Panel\tLF\t142.00\t310 lb/LF\t0.06\tYes
R-10-4-DRAIN\t10' Ring 4' tall\tRings\t10' dia\tEach\t850.00\t4200 lb\t0.8\tYes\tYes\t10\t4\tDRAIN
R-10-4-SAN\t10' Ring 4' sanitary\tRings\t10' dia\tEach\t920.00\t4300 lb\t0.8\tYes\tYes\t10\t4\tSAN
R-10-4-SOL\t10' Ring 4' solid\tRings\t10' dia\tEach\t900.00\t4150 lb\t0.8\tYes\tYes\t10\t4\tSOL
R-8-2.5-SAN\t8' Ring 2.5' sanitary\tRings\t8' dia\tEach\t680.00\t2200 lb\t0.4\tYes\tYes\t8\t2.5\tSAN`;
