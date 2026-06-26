"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CastingSupplierOrigin, ProductKind } from "@/app/generated/prisma/client";
import {
  type ProductType,
  productInputClassName,
  productStatusFormOptions,
  productTypeFormOptions,
  productTypeHelperText,
  productUnitFormOptions,
} from "@/components/products/product-utils";
import {
  productKindFormOptions,
  suggestedKindForCategory,
} from "@/lib/product-kinds";
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
import {
  getCategoryNames,
  getSubcategoriesForCategory,
  mergeCatalogWithInUseValues,
  type ProductCatalogCategory,
} from "@/lib/product-catalog-settings";

export type ProductFormValues = {
  productCode?: string;
  productName?: string;
  productType?: ProductType;
  productKind?: ProductKind;
  category?: string;
  subcategory?: string;
  unit?: string;
  status?: string;
  defaultPrice?: string;
  weight?: string;
  yards?: string;
  trackInventory?: "yes" | "no";
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
  castingHeightFeet?: string;
  castingClearOpeningInches?: string;
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
};

export type CastingSupplierOption = {
  id: string;
  name: string;
  origin: CastingSupplierOrigin;
};

const drainRingDiameterOptions = ["4", "6", "8", "10", "12"];

type ProductFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  submitLabel: string;
  catalog: ProductCatalogCategory[];
  castingSuppliers?: CastingSupplierOption[];
  castingComponents?: CastingComponentPickerOption[];
  defaultValues?: ProductFormValues;
  productId?: string;
};

export function ProductForm({
  action,
  cancelHref,
  submitLabel,
  catalog,
  castingSuppliers = [],
  castingComponents = [],
  defaultValues,
  productId,
}: ProductFormProps) {
  const mergedCatalog = useMemo(
    () =>
      mergeCatalogWithInUseValues(catalog, [
        {
          category: defaultValues?.category ?? "",
          subcategory: defaultValues?.subcategory ?? "",
        },
      ]),
    [catalog, defaultValues?.category, defaultValues?.subcategory],
  );
  const categoryNames = getCategoryNames(mergedCatalog);
  const initialCategory =
    defaultValues?.category && categoryNames.includes(defaultValues.category)
      ? defaultValues.category
      : (categoryNames[0] ?? "Vaults");
  const initialSubcategories = getSubcategoriesForCategory(
    mergedCatalog,
    initialCategory,
  );
  const initialSubcategory =
    defaultValues?.subcategory &&
    initialSubcategories.includes(defaultValues.subcategory)
      ? defaultValues.subcategory
      : (initialSubcategories[0] ?? "");

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

  const [productKind, setProductKind] = useState<ProductKind>(
    resolveInitialProductKind(),
  );
  const [productType, setProductType] = useState<ProductType>(
    defaultValues?.productType ?? "STOCK",
  );
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState(initialSubcategory);
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
  const subcategoryOptions = getSubcategoriesForCategory(mergedCatalog, category);

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

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    const nextSubcategories = getSubcategoriesForCategory(
      mergedCatalog,
      nextCategory,
    );
    setSubcategory((current) =>
      nextSubcategories.includes(current)
        ? current
        : (nextSubcategories[0] ?? ""),
    );
    const suggested = suggestedKindForCategory(nextCategory);
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

  const showCastingSection =
    productKind === "CASTING_ASSEMBLY" || productKind === "CASTING_COMPONENT";
  const orderedBomRows = castingAssemblyBomRoleOrder
    .map((role) => bomRows.find((row) => row.pieceRole === role))
    .filter((row): row is (typeof bomRows)[number] => row != null);

  function handleSubmit(formData: FormData) {
    if (castingRole === "ASSEMBLY") {
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
    }
    return action(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {productId ? <input type="hidden" name="id" value={productId} /> : null}
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
            setProductType(event.target.value as ProductType)
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
          {productKindFormOptions.map((option) => (
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
            htmlFor="category"
            className="block text-xs font-medium text-slate-700"
          >
            Category
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className={productInputClassName}
          >
            {categoryNames.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="subcategory"
            className="block text-xs font-medium text-slate-700"
          >
            Subcategory
          </label>
          <select
            id="subcategory"
            name="subcategory"
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
            className={productInputClassName}
          >
            {subcategoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
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
            defaultValue={defaultValues?.unit ?? "EA"}
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

      <div>
        <label
          htmlFor="defaultPrice"
          className="block text-xs font-medium text-slate-700"
        >
          Default Price
        </label>
        <input
          id="defaultPrice"
          name="defaultPrice"
          type="number"
          min="0"
          step="0.01"
          defaultValue={defaultValues?.defaultPrice ?? ""}
          placeholder="4850.00"
          className={productInputClassName}
        />
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
        <div>
          <label
            htmlFor="trackInventory"
            className="block text-xs font-medium text-slate-700"
          >
            Track Inventory
          </label>
          <select
            id="trackInventory"
            name="trackInventory"
            defaultValue={defaultValues?.trackInventory ?? "yes"}
            className={productInputClassName}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

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

      {productKind === "PIPE" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-700">Pipe Profile</p>
          <p className="mt-1 text-xs text-slate-500">
            Stock pipe SKUs sold and tracked by diameter, length, and class.
          </p>
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
                defaultValue={defaultValues?.pipeLengthFeet ?? ""}
                placeholder="8"
                className={productInputClassName}
              />
            </div>
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
            <div>
              <label
                htmlFor="pipeJointType"
                className="block text-xs font-medium text-slate-700"
              >
                Joint Type
              </label>
              <input
                id="pipeJointType"
                name="pipeJointType"
                type="text"
                defaultValue={defaultValues?.pipeJointType ?? ""}
                placeholder="RCP"
                className={productInputClassName}
              />
            </div>
          </div>
        </div>
      ) : null}

      {showCastingSection ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div>
            <label
              htmlFor="castingRole"
              className="block text-xs font-medium text-slate-700"
            >
              Casting Role *
            </label>
            <input type="hidden" name="castingRole" value={castingRole} />
            <p className="mt-1 text-xs text-slate-600">
              {productKind === "CASTING_ASSEMBLY"
                ? "Assembly — full casting (quoted & drill sheet)"
                : "Component — frame, cover/grate, hood, or throat piece"}
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
              <select
                id="castingSupplierId"
                name="castingSupplierId"
                required
                defaultValue={defaultValues?.castingSupplierId ?? ""}
                className={productInputClassName}
              >
                <option value="">Select supplier…</option>
                {castingSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({formatCastingSupplierOriginLabel(supplier.origin)})
                  </option>
                ))}
              </select>
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

                <div>
                  <label
                    htmlFor="castingClearOpeningInches"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Clear Opening (in)
                  </label>
                  <input
                    id="castingClearOpeningInches"
                    name="castingClearOpeningInches"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={defaultValues?.castingClearOpeningInches ?? ""}
                    placeholder="24"
                    className={productInputClassName}
                  />
                </div>
              </div>

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

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <Link
          href={cancelHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
