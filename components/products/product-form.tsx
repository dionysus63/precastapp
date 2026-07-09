"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { CastingSupplierOrigin, ProductKind, ProductType } from "@/app/generated/prisma/client";
import {
  productInputClassName,
  productStatusFormOptions,
  productTypeFormOptions,
  productTypeHelperText,
  productUnitFormOptions,
} from "@/components/products/product-utils";
import {
  productKindFormOptions,
} from "@/lib/product-kinds";
import {
  defaultKindForType,
  isCastingProductType,
  isPipeProductType,
  productKindsForType,
} from "@/lib/product-types";
import {
  adsPipeJointTypeFormOptions,
  normalizeAdsPipeJointType,
} from "@/lib/ads-pipe-utils";
import {
  type DrainRingStyle,
  formatSanitaryDrainRingDiametersLabel,
  getDrainRingStyleOptionsForDiameter,
} from "@/lib/drain-ring-utils";
import {
  castingAssemblyBomRoleOrder,
  castingAssemblyOptionalBomRoles,
  castingPieceRoleFormOptions,
  formatCastingPieceRoleLabel,
  formatCastingSupplierOriginLabel,
  type CastingPieceRole,
  type CastingRole,
} from "@/lib/casting-utils";
import type { PriceListOption } from "@/lib/price-list-service";
import {
  getCategoriesForProductType,
  getSubcategoriesForCategoryId,
  suggestedKindForCategoryId,
  type ProductTaxonomyCategory,
} from "@/lib/product-taxonomy";

export type ProductFormValues = {
  productCode?: string;
  productName?: string;
  productType?: ProductType;
  productKind?: ProductKind;
  categoryId?: string;
  subcategoryId?: string;
  description?: string;
  unit?: string;
  status?: string;
  unitPrice?: string;
  priceListId?: string;
  weight?: string;
  yards?: string;
  currentStockQuantity?: string;
  reorderLevel?: string;
  isDrainRing?: "yes" | "no";
  heightFeet?: string;
  ringDiameterFeet?: string;
  drainRingStyle?: DrainRingStyle;
  isCasting?: "yes" | "no";
  castingRole?: CastingRole | "";
  castingPieceRole?: CastingPieceRole | "";
  castingSupplierId?: string;
  manufacturerCode?: string;
  castingSoldAsUnit?: boolean;
  castingHeightFeet?: string;
  pipeDiameterInches?: string;
  pipeLengthFeet?: string;
  pipeClass?: string;
  pipeJointType?: string;
  castingBom?: Array<{
    pieceRole: CastingPieceRole;
    componentId: string;
    quantity: number;
  }>;
  notes?: string;
};

export type CastingComponentPickerOption = {
  id: string;
  productCode: string;
  name: string;
  castingPieceRole: CastingPieceRole | null;
  weight?: number | null;
  unitPrice?: number | null;
};

export type CastingSupplierOption = {
  id: string;
  name: string;
  origin: CastingSupplierOrigin;
};

const drainRingDiameterOptions = ["4", "6", "8", "10", "12"];

type ProductFormProps = {
  action: (formData: FormData) => Promise<{ error: string } | void>;
  cancelHref: string;
  submitLabel: string;
  taxonomy: ProductTaxonomyCategory[];
  castingSuppliers?: CastingSupplierOption[];
  castingComponents?: CastingComponentPickerOption[];
  priceLists?: PriceListOption[];
  defaultValues?: ProductFormValues;
  productId?: string;
  /** ISO updatedAt of the product when the edit page loaded it — rejects
   * stale saves (optimistic concurrency). */
  expectedUpdatedAt?: string;
};

export function ProductForm({
  action,
  cancelHref,
  submitLabel,
  taxonomy,
  castingSuppliers = [],
  castingComponents = [],
  priceLists = [],
  defaultValues,
  productId,
  expectedUpdatedAt,
}: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [productType, setProductType] = useState<ProductType>(
    defaultValues?.productType ?? "STOCK_PRECAST",
  );
  const categoryOptions = useMemo(
    () => getCategoriesForProductType(taxonomy, productType),
    [taxonomy, productType],
  );
  const initialCategoryId =
    defaultValues?.categoryId &&
    categoryOptions.some((category) => category.id === defaultValues.categoryId)
      ? defaultValues.categoryId
      : (categoryOptions[0]?.id ?? "");
  const initialSubcategories = getSubcategoriesForCategoryId(
    taxonomy,
    initialCategoryId,
  );
  const initialSubcategoryId =
    defaultValues?.subcategoryId &&
    initialSubcategories.some(
      (subcategory) => subcategory.id === defaultValues.subcategoryId,
    )
      ? defaultValues.subcategoryId
      : (initialSubcategories[0]?.id ?? "");

  const resolveInitialProductKind = (): ProductKind => {
    if (defaultValues?.productKind) {
      return defaultValues.productKind;
    }
    if (defaultValues?.isDrainRing === "yes") {
      return "DRAIN_RING";
    }
    if (defaultValues?.castingRole === "ASSEMBLY") {
      return "CASTING_ASSEMBLY";
    }
    if (defaultValues?.castingRole === "COMPONENT") {
      return "CASTING_COMPONENT";
    }
    return "STANDARD";
  };

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [productKind, setProductKind] = useState<ProductKind>(
    resolveInitialProductKind(),
  );
  const kindOptions = useMemo(
    () =>
      productKindFormOptions.filter((option) =>
        productKindsForType(productType).includes(option.value),
      ),
    [productType],
  );
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId);
  const [castingRole, setCastingRole] = useState<CastingRole | "">(
    defaultValues?.castingRole ??
      (resolveInitialProductKind() === "CASTING_ASSEMBLY"
        ? "ASSEMBLY"
        : resolveInitialProductKind() === "CASTING_COMPONENT"
          ? "COMPONENT"
          : defaultValues?.isCasting === "yes"
            ? "ASSEMBLY"
            : ""),
  );
  const [castingPieceRole, setCastingPieceRole] = useState<CastingPieceRole | "">(
    defaultValues?.castingPieceRole ?? "",
  );
  const [castingSupplierId, setCastingSupplierId] = useState(
    defaultValues?.castingSupplierId ?? "",
  );
  const [manufacturerCode, setManufacturerCode] = useState(
    defaultValues?.manufacturerCode ?? "",
  );
  const [castingStockingMode, setCastingStockingMode] = useState<"parts" | "unit">(
    defaultValues?.castingSoldAsUnit ? "unit" : "parts",
  );
  const [bomRows, setBomRows] = useState<
    Array<{ pieceRole: CastingPieceRole; componentId: string; quantity: string }>
  >(() => {
    if (defaultValues?.castingBom?.length) {
      return defaultValues.castingBom.map((row) => ({
        pieceRole: row.pieceRole,
        componentId: row.componentId,
        quantity: String(row.quantity),
      }));
    }
    return [
      { pieceRole: "FRAME", componentId: "", quantity: "1" },
      { pieceRole: "COVER_GRATE", componentId: "", quantity: "1" },
    ];
  });
  const [ringDiameterFeet, setRingDiameterFeet] = useState(
    defaultValues?.ringDiameterFeet ?? "10",
  );
  const [drainRingStyle, setDrainRingStyle] = useState<DrainRingStyle>(
    defaultValues?.drainRingStyle ?? "DRAIN",
  );
  const drainRingStyleOptions = getDrainRingStyleOptionsForDiameter(
    Number(ringDiameterFeet),
  );
  const subcategoryOptions = getSubcategoriesForCategoryId(taxonomy, categoryId);
  const hideInventoryFields =
    productKind === "CASTING_ASSEMBLY" && castingStockingMode === "parts";
  const isPartsAssembly =
    productKind === "CASTING_ASSEMBLY" && castingStockingMode === "parts";
  // Live combined parts weight, shown as the fallback when the assembly's own
  // weight is left blank or 0.
  const bomPartsWeight = useMemo(() => {
    if (!isPartsAssembly) {
      return null;
    }

    let totalWeight = 0;
    let hasSelectedComponent = false;

    for (const row of bomRows) {
      if (!row.componentId) {
        continue;
      }
      hasSelectedComponent = true;
      const component = castingComponents.find(
        (entry) => entry.id === row.componentId,
      );
      if (!component) {
        continue;
      }
      const quantity = Number(row.quantity) || 0;
      totalWeight += quantity * (component.weight ?? 0);
    }

    return hasSelectedComponent ? totalWeight : null;
  }, [isPartsAssembly, bomRows, castingComponents]);

  function handleProductTypeChange(nextType: ProductType) {
    setProductType(nextType);
    const nextCategories = getCategoriesForProductType(taxonomy, nextType);
    const nextCategoryId = nextCategories[0]?.id ?? "";
    setCategoryId(nextCategoryId);
    const nextSubcategories = getSubcategoriesForCategoryId(
      taxonomy,
      nextCategoryId,
    );
    setSubcategoryId(nextSubcategories[0]?.id ?? "");
    const nextKind = defaultKindForType(nextType);
    handleProductKindChange(nextKind);
  }

  function handleRingDiameterChange(nextDiameter: string) {
    setRingDiameterFeet(nextDiameter);
    const nextOptions = getDrainRingStyleOptionsForDiameter(Number(nextDiameter));
    if (!nextOptions.some((option) => option.value === drainRingStyle)) {
      setDrainRingStyle("DRAIN");
    }
  }

  function handleProductKindChange(nextKind: ProductKind) {
    setProductKind(nextKind);
    if (nextKind === "CASTING_ASSEMBLY") {
      setCastingRole("ASSEMBLY");
    } else if (nextKind === "CASTING_COMPONENT") {
      setCastingRole("COMPONENT");
    } else {
      setCastingRole("");
      setCastingPieceRole("");
    }
  }

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    const nextSubcategories = getSubcategoriesForCategoryId(
      taxonomy,
      nextCategoryId,
    );
    setSubcategoryId((current) =>
      nextSubcategories.some((subcategory) => subcategory.id === current)
        ? current
        : (nextSubcategories[0]?.id ?? ""),
    );
    const suggested = suggestedKindForCategoryId(taxonomy, nextCategoryId);
    if (suggested && productKind === "STANDARD") {
      handleProductKindChange(suggested);
    }
  }

  function updateBomRow(
    pieceRole: CastingPieceRole,
    patch: Partial<{ componentId: string; quantity: string }>,
  ) {
    setBomRows((current) =>
      current.map((row) =>
        row.pieceRole === pieceRole ? { ...row, ...patch } : row,
      ),
    );
  }

  function toggleOptionalBomRow(role: CastingPieceRole, enabled: boolean) {
    setBomRows((current) => {
      const hasRole = current.some((row) => row.pieceRole === role);
      if (enabled && !hasRole) {
        return [
          ...current,
          {
            pieceRole: role,
            componentId: "",
            quantity: "1",
          },
        ];
      }
      if (!enabled && hasRole) {
        return current.filter((row) => row.pieceRole !== role);
      }
      return current;
    });
  }

  const showCastingSection = isCastingProductType(productType);
  const showPipeSection = isPipeProductType(productType);
  const selectedSupplier = castingSuppliers.find(
    (supplier) => supplier.id === castingSupplierId,
  );
  const orderedBomRows = castingAssemblyBomRoleOrder
    .map((role) => bomRows.find((row) => row.pieceRole === role))
    .filter((row): row is (typeof bomRows)[number] => row != null);

  async function handleSubmit(formData: FormData) {
    setSubmitError(null);
    if (castingRole === "ASSEMBLY" && castingStockingMode === "parts") {
      formData.set(
        "castingBomPayload",
        JSON.stringify(
          bomRows
            .filter((row) => row.componentId.trim())
            .map((row) => ({
              pieceRole: row.pieceRole,
              componentId: row.componentId,
              quantity: Number(row.quantity) || 1,
            })),
        ),
      );
      formData.set("castingSoldAsUnit", "no");
    } else if (castingRole === "ASSEMBLY") {
      formData.set("castingSoldAsUnit", "yes");
      formData.delete("castingBomPayload");
    }
    if (hideInventoryFields) {
      formData.set("currentStockQuantity", "0");
    }
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        setSubmitError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {productId ? <input type="hidden" name="id" value={productId} /> : null}
      {expectedUpdatedAt ? (
        <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      ) : null}
      <div>
        <label
          htmlFor="productType"
          className="block text-xs font-medium text-slate-700"
        >
          Product Type *
        </label>
        <select
          id="productType"
          name="productType"
          required
          value={productType}
          onChange={(event) =>
            handleProductTypeChange(event.target.value as ProductType)
          }
          className={productInputClassName}
        >
          {productTypeFormOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {productTypeHelperText[productType]}
        </p>
      </div>

      {kindOptions.length > 1 ? (
      <div>
        <label
          htmlFor="productKind"
          className="block text-xs font-medium text-slate-700"
        >
          Product Kind *
        </label>
        <select
          id="productKind"
          name="productKind"
          required
          value={productKind}
          onChange={(event) =>
            handleProductKindChange(event.target.value as ProductKind)
          }
          className={productInputClassName}
        >
          {kindOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-slate-500">
          Physical catalog kind — controls which profile fields apply (rings,
          castings, pipe, or standard stock).
        </p>
      </div>
      ) : (
        <input type="hidden" name="productKind" value={productKind} />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="productCode"
            className="block text-xs font-medium text-slate-700"
          >
            Product Code *
          </label>
          <input
            id="productCode"
            name="productCode"
            type="text"
            required
            defaultValue={defaultValues?.productCode ?? ""}
            placeholder="VLT-48x72"
            className={productInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="productName"
            className="block text-xs font-medium text-slate-700"
          >
            Product Name *
          </label>
          <input
            id="productName"
            name="productName"
            type="text"
            required
            defaultValue={defaultValues?.productName ?? ""}
            placeholder="48x72 Utility Vault"
            className={productInputClassName}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="categoryId"
            className="block text-xs font-medium text-slate-700"
          >
            Category *
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className={productInputClassName}
          >
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        {subcategoryOptions.length > 0 ? (
        <div>
          <label
            htmlFor="subcategoryId"
            className="block text-xs font-medium text-slate-700"
          >
            Subcategory
          </label>
          <select
            id="subcategoryId"
            name="subcategoryId"
            value={subcategoryId}
            onChange={(event) => setSubcategoryId(event.target.value)}
            className={productInputClassName}
          >
            <option value="">None</option>
            {subcategoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-xs font-medium text-slate-700"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaultValues?.description ?? ""}
          placeholder="Optional product notes or marketing description"
          className={productInputClassName}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="unit"
            className="block text-xs font-medium text-slate-700"
          >
            Unit
          </label>
          <select
            id="unit"
            name="unit"
            defaultValue={
              defaultValues?.unit ?? (showPipeSection ? "LF" : "EA")
            }
            className={productInputClassName}
          >
            {productUnitFormOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-xs font-medium text-slate-700"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaultValues?.status ?? "ACTIVE"}
            className={productInputClassName}
          >
            {productStatusFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="priceListId"
            className="block text-xs font-medium text-slate-700"
          >
            Price List
          </label>
          <select
            id="priceListId"
            name="priceListId"
            defaultValue={
              defaultValues?.priceListId ??
              priceLists.find((list) => list.isDefault)?.id ??
              priceLists[0]?.id ??
              ""
            }
            className={productInputClassName}
          >
            {priceLists.length === 0 ? (
              <option value="">No price lists available</option>
            ) : (
              priceLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                  {list.isDefault ? " (default)" : ""}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label
            htmlFor="unitPrice"
            className="block text-xs font-medium text-slate-700"
          >
            {showPipeSection ? "Price per foot" : "Unit Price"}
          </label>
          <input
            id="unitPrice"
            name="unitPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultValues?.unitPrice ?? ""}
            placeholder="4850.00"
            className={productInputClassName}
          />
          {isPartsAssembly ? (
            <p className="mt-1 text-xs text-slate-500">
              Assembly price — component prices are not added in.
            </p>
          ) : null}
        </div>
      </div>

      <div className={`grid gap-5 ${showCastingSection ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
        <div>
          <label
            htmlFor="weight"
            className="block text-xs font-medium text-slate-700"
          >
            Weight
          </label>
          <input
            id="weight"
            name="weight"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultValues?.weight ?? ""}
            placeholder="8400"
            className={productInputClassName}
          />
          {isPartsAssembly ? (
            <p className="mt-1 text-xs text-slate-500">
              Leave blank or 0 to use the combined parts weight
              {bomPartsWeight != null ? ` (currently ${bomPartsWeight} lb)` : ""}.
            </p>
          ) : null}
        </div>

        {!showCastingSection ? (
          <div>
            <label
              htmlFor="yards"
              className="block text-xs font-medium text-slate-700"
            >
              Yards
            </label>
            <input
              id="yards"
              name="yards"
              type="number"
              min="0"
              step="0.0001"
              defaultValue={defaultValues?.yards ?? ""}
              placeholder="2.4"
              className={productInputClassName}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {!hideInventoryFields ? (
          <>
        <div>
          <label
            htmlFor="currentStockQuantity"
            className="block text-xs font-medium text-slate-700"
          >
            {productId ? "Current Stock Quantity" : "Opening Stock Quantity"}
          </label>
          {productId ? (
            <>
              <input
                id="currentStockQuantity"
                type="text"
                readOnly
                value={defaultValues?.currentStockQuantity ?? "0"}
                className={`${productInputClassName} bg-slate-50 text-slate-500`}
              />
              <p className="mt-1 text-xs text-slate-500">
                Stock changes go through Inventory → Adjust so the on-hand count
                stays in sync with the transaction ledger.
              </p>
            </>
          ) : (
            <input
              id="currentStockQuantity"
              name="currentStockQuantity"
              type="number"
              min="0"
              step="1"
              defaultValue={defaultValues?.currentStockQuantity ?? "0"}
              className={productInputClassName}
            />
          )}
        </div>

        <div>
          <label
            htmlFor="reorderLevel"
            className="block text-xs font-medium text-slate-700"
          >
            Reorder Level
          </label>
          <input
            id="reorderLevel"
            name="reorderLevel"
            type="number"
            min="0"
            step="1"
            defaultValue={defaultValues?.reorderLevel ?? "0"}
            className={productInputClassName}
          />
        </div>
          </>
        ) : (
          <p className="sm:col-span-3 text-xs text-slate-600">
            Part-based casting assemblies are not stocked as a unit — inventory
            is tracked on each frame, cover/grate, and other component SKUs.
          </p>
        )}
      </div>

      {productKind === "DRAIN_RING" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <input type="hidden" name="isDrainRing" value="yes" />
          <p className="text-xs font-medium text-slate-700">Drain Ring Profile</p>
          <p className="mt-1 text-xs text-slate-500">
            Rings are quoted by total pool height but stocked and shipped as
            individual rings.
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ringDiameterFeet"
                className="block text-xs font-medium text-slate-700"
              >
                Pool Diameter (ft)
              </label>
              <select
                id="ringDiameterFeet"
                name="ringDiameterFeet"
                value={ringDiameterFeet}
                onChange={(event) => handleRingDiameterChange(event.target.value)}
                className={productInputClassName}
              >
                {drainRingDiameterOptions.map((diameter) => (
                  <option key={diameter} value={diameter}>
                    {diameter}'
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="drainRingStyle"
                className="block text-xs font-medium text-slate-700"
              >
                Style
              </label>
              <select
                id="drainRingStyle"
                name="drainRingStyle"
                value={drainRingStyle}
                onChange={(event) =>
                  setDrainRingStyle(event.target.value as DrainRingStyle)
                }
                className={productInputClassName}
              >
                {drainRingStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Solid is available at all diameters. Sanitary is only available
                for {formatSanitaryDrainRingDiametersLabel()} diameters.
              </p>
            </div>

            <div>
              <label
                htmlFor="heightFeet"
                className="block text-xs font-medium text-slate-700"
              >
                Ring Height (ft)
              </label>
              <input
                id="heightFeet"
                name="heightFeet"
                type="number"
                min="0"
                step="0.5"
                defaultValue={defaultValues?.heightFeet ?? ""}
                placeholder="4"
                className={productInputClassName}
              />
              <p className="mt-2 text-xs text-slate-500">
                Whole-foot heights for most diameters; 8' rings may use 6"
                (0.5') increments.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <input type="hidden" name="isDrainRing" value="no" />
      )}

      {showPipeSection ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-700">Pipe Profile</p>
          <p className="mt-1 text-xs text-slate-500">
            {productType === "ADS_PIPE"
              ? "ADS plastic pipe — diameter, 20' stick length, joint type (WT or ST), and price per foot."
              : "Precast RCP — diameter, 8' stick length, class, O-Ring joint, and price per foot."}
          </p>
          {productType === "PRECAST_PIPE" ? (
            <input type="hidden" name="pipeJointType" value="O-Ring" />
          ) : null}
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pipeDiameterInches"
                className="block text-xs font-medium text-slate-700"
              >
                Pipe Diameter (in) *
              </label>
              <input
                id="pipeDiameterInches"
                name="pipeDiameterInches"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={defaultValues?.pipeDiameterInches ?? ""}
                placeholder="24"
                className={productInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="pipeLengthFeet"
                className="block text-xs font-medium text-slate-700"
              >
                Pipe Length (ft) *
              </label>
              <input
                id="pipeLengthFeet"
                name="pipeLengthFeet"
                type="number"
                min="0"
                step="0.5"
                required
                defaultValue={
                  defaultValues?.pipeLengthFeet ??
                  (productType === "ADS_PIPE" ? "20" : "8")
                }
                placeholder={productType === "ADS_PIPE" ? "20" : "8"}
                className={productInputClassName}
              />
            </div>
            {productType === "ADS_PIPE" ? (
              <div>
                <label
                  htmlFor="pipeJointType"
                  className="block text-xs font-medium text-slate-700"
                >
                  Joint Type *
                </label>
                <select
                  id="pipeJointType"
                  name="pipeJointType"
                  required
                  defaultValue={
                    normalizeAdsPipeJointType(defaultValues?.pipeJointType) ??
                    "ST"
                  }
                  className={productInputClassName}
                >
                  {adsPipeJointTypeFormOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  Watertight (WT) and Soiltight (ST) are separate SKUs. On
                  delivery, WT may ship at the quoted ST price when ST is out of
                  stock.
                </p>
              </div>
            ) : null}
            {productType === "PRECAST_PIPE" ? (
            <div>
              <label
                htmlFor="pipeClass"
                className="block text-xs font-medium text-slate-700"
              >
                Class
              </label>
              <input
                id="pipeClass"
                name="pipeClass"
                type="text"
                defaultValue={defaultValues?.pipeClass ?? ""}
                placeholder="III"
                className={productInputClassName}
              />
            </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showCastingSection ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div>
            <input type="hidden" name="castingRole" value={castingRole} />
            <p className="text-xs font-medium text-slate-700">
              {productKind === "CASTING_ASSEMBLY"
                ? "Casting Assembly"
                : "Casting Component"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {productKind === "CASTING_ASSEMBLY"
                ? "Full casting quoted on jobs and shown on submittals."
                : "Individual frame, cover/grate, or hood piece."}
            </p>
          </div>

          <div>
            <label
              htmlFor="castingSupplierId"
              className="block text-xs font-medium text-slate-700"
            >
              Supplier *
            </label>
            {castingSuppliers.length > 0 ? (
              <>
                <select
                  id="castingSupplierId"
                  name="castingSupplierId"
                  required
                  value={castingSupplierId}
                  onChange={(event) => setCastingSupplierId(event.target.value)}
                  className={productInputClassName}
                >
                  <option value="">Select supplier…</option>
                  {castingSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({formatCastingSupplierOriginLabel(supplier.origin)})
                    </option>
                  ))}
                </select>
                {selectedSupplier ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Origin:{" "}
                    <span className="font-medium text-slate-800">
                      {formatCastingSupplierOriginLabel(selectedSupplier.origin)}
                    </span>
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-1 space-y-2">
                <p className="text-xs text-amber-700">
                  No casting suppliers are set up yet. Add suppliers in{" "}
                  <Link
                    href="/settings/casting-suppliers"
                    className="font-medium underline hover:text-amber-900"
                  >
                    Settings → Casting Suppliers
                  </Link>{" "}
                  before saving a casting product.
                </p>
                <input type="hidden" name="castingSupplierId" value="" />
              </div>
            )}
          </div>

          {castingRole === "ASSEMBLY" ? (
            <div>
              <p className="text-xs font-medium text-slate-700">
                How is this casting stocked?
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="radio"
                    name="castingStockingMode"
                    checked={castingStockingMode === "parts"}
                    onChange={() => setCastingStockingMode("parts")}
                  />
                  Set with interchangeable parts
                </label>
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="radio"
                    name="castingStockingMode"
                    checked={castingStockingMode === "unit"}
                    onChange={() => setCastingStockingMode("unit")}
                  />
                  One-piece unit (never sold separately)
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {castingStockingMode === "parts"
                  ? "Quote and ship as a set; inventory is tracked on each frame, cover/grate, and optional hood."
                  : "Stored, received, and shipped as a single SKU with no part breakdown."}
              </p>
            </div>
          ) : null}

          {castingRole === "COMPONENT" ? (
            <div>
              <label
                htmlFor="castingPieceRole"
                className="block text-xs font-medium text-slate-700"
              >
                Piece Role *
              </label>
              <select
                id="castingPieceRole"
                name="castingPieceRole"
                required
                value={castingPieceRole}
                onChange={(event) =>
                  setCastingPieceRole(event.target.value as CastingPieceRole)
                }
                className={productInputClassName}
              >
                <option value="">Select piece…</option>
                {castingPieceRoleFormOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {castingRole === "ASSEMBLY" ? (
            <>
              <input type="hidden" name="isCasting" value="yes" />
              <div>
                <label
                  htmlFor="manufacturerCode"
                  className="block text-xs font-medium text-slate-700"
                >
                  Manufacturer Code
                </label>
                <input
                  id="manufacturerCode"
                  name="manufacturerCode"
                  type="text"
                  value={manufacturerCode}
                  onChange={(event) => setManufacturerCode(event.target.value)}
                  placeholder="Supplier assembly number from packing slip"
                  className={productInputClassName}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Optional supplier assembly number, shown when receiving
                  castings.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="castingHeightFeet"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Casting Height (ft) *
                  </label>
                  <input
                    id="castingHeightFeet"
                    name="castingHeightFeet"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={defaultValues?.castingHeightFeet ?? ""}
                    placeholder="0.67"
                    className={productInputClassName}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Used on drill sheets — height removed from the wall at the
                    rim.
                  </p>
                </div>
              </div>

              {castingStockingMode === "parts" ? (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700">
                    Bill of Materials
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                    {castingAssemblyOptionalBomRoles.map((role) => (
                      <label
                        key={role}
                        className="flex items-center gap-2 text-xs text-slate-600"
                      >
                        <input
                          type="checkbox"
                          checked={bomRows.some((row) => row.pieceRole === role)}
                          onChange={(event) =>
                            toggleOptionalBomRow(role, event.target.checked)
                          }
                        />
                        Include {formatCastingPieceRoleLabel(role).toLowerCase()}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {orderedBomRows.map((row) => (
                    <div
                      key={row.pieceRole}
                      className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_80px]"
                    >
                      <span className="self-center text-xs font-medium text-slate-700">
                        {formatCastingPieceRoleLabel(row.pieceRole)}
                      </span>
                      <select
                        value={row.componentId}
                        onChange={(event) =>
                          updateBomRow(row.pieceRole, {
                            componentId: event.target.value,
                          })
                        }
                        className={productInputClassName}
                      >
                        <option value="">Select component…</option>
                        {castingComponents
                          .filter(
                            (option) =>
                              !option.castingPieceRole ||
                              option.castingPieceRole === row.pieceRole,
                          )
                          .map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.productCode} — {option.name}
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row.quantity}
                        onChange={(event) =>
                          updateBomRow(row.pieceRole, {
                            quantity: event.target.value,
                          })
                        }
                        className={productInputClassName}
                        aria-label={`${formatCastingPieceRoleLabel(row.pieceRole)} quantity`}
                      />
                    </div>
                  ))}
                </div>
                {castingComponents.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Create frame and cover/grate component products first, then
                    link them here.
                  </p>
                ) : null}
              </div>
              ) : null}
            </>
          ) : (
            <input type="hidden" name="isCasting" value="no" />
          )}
        </div>
      ) : (
        <input type="hidden" name="isCasting" value="no" />
      )}

      <div>
        <label
          htmlFor="notes"
          className="block text-xs font-medium text-slate-700"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={defaultValues?.notes ?? ""}
          placeholder="Production notes, lead time, or quoting guidance..."
          className={productInputClassName}
        />
      </div>

      {submitError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
          {submitError}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <Link
          href={cancelHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
