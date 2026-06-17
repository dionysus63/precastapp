export type ProductRow = {
  id: string;
  productCode: string;
  productName: string;
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
};

export const productCategoryFilterOptions = [
  "All",
  "Vaults",
  "Manholes",
  "Walls",
  "Slabs",
  "Accessories",
];

export const productSubcategoryFilterOptions = [
  "All",
  "Traffic Rated",
  "Standard Duty",
  "Light Duty",
  "Riser",
  "H8 Panel",
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

export const productCategoryFormOptions = [
  "Vaults",
  "Manholes",
  "Walls",
  "Slabs",
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
  "Equipment Pad",
  "Sidewalk Slab",
  "Lifting Hardware",
  "Connection Hardware",
];

export const productUnitFormOptions = ["Each", "LF", "SF", "CY", "Ton"];

export const placeholderProducts: ProductRow[] = [
  {
    id: "1",
    productCode: "VLT-48x72",
    productName: "48x72 Utility Vault",
    category: "Vaults",
    subcategory: "Traffic Rated",
    categoryVariant: "info",
    unit: "Each",
    defaultPrice: "$4,850.00",
    weight: "8,400 lb",
    yards: "2.4",
    trackInventory: true,
    status: "Active",
    statusVariant: "success",
  },
  {
    id: "2",
    productCode: "MH-60-R",
    productName: "60\" Manhole Riser",
    category: "Manholes",
    subcategory: "Riser",
    categoryVariant: "default",
    unit: "Each",
    defaultPrice: "$1,240.00",
    weight: "2,100 lb",
    yards: "0.6",
    trackInventory: true,
    status: "Active",
    statusVariant: "success",
  },
  {
    id: "3",
    productCode: "RW-8-H8",
    productName: "8' Retaining Wall Panel H8",
    category: "Walls",
    subcategory: "H8 Panel",
    categoryVariant: "neutral",
    unit: "LF",
    defaultPrice: "$185.00",
    weight: "420 lb/LF",
    yards: "0.08",
    trackInventory: true,
    status: "Active",
    statusVariant: "success",
  },
  {
    id: "4",
    productCode: "SLB-24x24",
    productName: "24x24 Equipment Pad",
    category: "Slabs",
    subcategory: "Equipment Pad",
    categoryVariant: "neutral",
    unit: "Each",
    defaultPrice: "$320.00",
    weight: "980 lb",
    yards: "0.3",
    trackInventory: false,
    status: "Active",
    statusVariant: "success",
  },
  {
    id: "5",
    productCode: "ACC-LIF-001",
    productName: "Cast Iron Lifting Pin Set",
    category: "Accessories",
    subcategory: "Lifting Hardware",
    categoryVariant: "default",
    unit: "Each",
    defaultPrice: "$48.00",
    weight: "12 lb",
    yards: "—",
    trackInventory: true,
    status: "Inactive",
    statusVariant: "neutral",
  },
  {
    id: "6",
    productCode: "VLT-36x48-L",
    productName: "36x48 Light Duty Vault (Legacy)",
    category: "Vaults",
    subcategory: "Light Duty",
    categoryVariant: "info",
    unit: "Each",
    defaultPrice: "$3,100.00",
    weight: "5,600 lb",
    yards: "1.6",
    trackInventory: false,
    status: "Discontinued",
    statusVariant: "warning",
  },
];

export const productInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";
