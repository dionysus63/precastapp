"use client";

import { useMemo, useState } from "react";
import {
  settingsInputClassName,
  settingsSubmitClassName,
  settingsTextareaClassName,
} from "@/components/settings/settings-form-fields";
import {
  getAllRingBuilderInstances,
  isTopLevelRingStyle,
  mergeRingBuilderConfigWithDefaults,
  type RingBuilderConfig,
  type RingSlabMapping,
} from "@/lib/ring-builder-settings";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellClassName,
  tableWrapperClassName,
} from "@/lib/table-styles";
type RingBuilderSettingsFormProps = {
  initialConfig: RingBuilderConfig;
  subcategoryOptions: string[];
  priceLists: { id: string; name: string }[];
  action: (formData: FormData) => Promise<void>;
};

type EditableMapping = Omit<RingSlabMapping, "pricePerFootByPriceList"> & {
  id: string;
  extraOtherText: string;
  /** Per-price-list $/ft as input strings; blank means "use the base rate". */
  priceListOverrides: Record<string, string>;
};

function createMappingId() {
  return `mapping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseExtraSubcategoriesText(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildEditableFromConfig(
  config: RingBuilderConfig,
  subcategoryOptions: string[],
): EditableMapping[] {
  const catalogKeys = new Set(
    subcategoryOptions.map((entry) => entry.toLowerCase()),
  );
  const merged = mergeRingBuilderConfigWithDefaults(config);

  return merged.map((mapping) => {
    const otherCatalog: string[] = [];
    const otherExtra: string[] = [];
    for (const entry of mapping.otherSubcategories) {
      if (catalogKeys.has(entry.toLowerCase())) {
        otherCatalog.push(entry);
      } else {
        otherExtra.push(entry);
      }
    }

    return {
      diameterFeet: mapping.diameterFeet,
      style: mapping.style,
      otherSubcategories: otherCatalog,
      defaultPricePerFoot: mapping.defaultPricePerFoot,
      id: createMappingId(),
      extraOtherText: otherExtra.join("\n"),
      priceListOverrides: Object.fromEntries(
        Object.entries(mapping.pricePerFootByPriceList).map(
          ([priceListId, price]) => [priceListId, String(price)],
        ),
      ),
    };
  });
}

function SubcategoryPicker({
  label,
  options,
  selected,
  extraText,
  onToggle,
  onExtraTextChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  extraText: string;
  onToggle: (subcategory: string) => void;
  onExtraTextChange: (value: string) => void;
}) {
  const selectedKeys = useMemo(
    () => new Set(selected.map((entry) => entry.toLowerCase())),
    [selected],
  );

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-slate-700">{label}</p>
      {options.length > 0 ? (
        <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-slate-200 bg-white p-2">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 text-[11px] text-slate-700"
            >
              <input
                type="checkbox"
                checked={selectedKeys.has(option.toLowerCase())}
                onChange={() => onToggle(option)}
                className="rounded border-slate-300"
              />
              {option}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          No catalog subcategories yet. Add custom values below.
        </p>
      )}
      <textarea
        value={extraText}
        onChange={(event) => onExtraTextChange(event.target.value)}
        rows={2}
        placeholder="Additional subcategories (one per line)"
        className={settingsTextareaClassName}
      />
    </div>
  );
}

export function RingBuilderSettingsForm({
  initialConfig,
  subcategoryOptions,
  priceLists,
  action,
}: RingBuilderSettingsFormProps) {
  const instances = useMemo(() => getAllRingBuilderInstances(), []);
  const [mappings, setMappings] = useState<EditableMapping[]>(() =>
    buildEditableFromConfig(initialConfig, subcategoryOptions),
  );

  function updatePriceListOverride(
    id: string,
    priceListId: string,
    value: string,
  ) {
    setMappings((current) =>
      current.map((mapping) =>
        mapping.id === id
          ? {
              ...mapping,
              priceListOverrides: {
                ...mapping.priceListOverrides,
                [priceListId]: value,
              },
            }
          : mapping,
      ),
    );
  }

  function updateMapping(
    id: string,
    updates: Partial<
      Pick<EditableMapping, "otherSubcategories" | "extraOtherText" | "defaultPricePerFoot">
    >,
  ) {
    setMappings((current) =>
      current.map((mapping) =>
        mapping.id === id ? { ...mapping, ...updates } : mapping,
      ),
    );
  }

  function toggleOtherSubcategory(id: string, subcategory: string) {
    setMappings((current) =>
      current.map((mapping) => {
        if (mapping.id !== id) {
          return mapping;
        }
        const key = subcategory.toLowerCase();
        const exists = mapping.otherSubcategories.some(
          (entry) => entry.toLowerCase() === key,
        );
        return {
          ...mapping,
          otherSubcategories: exists
            ? mapping.otherSubcategories.filter(
                (entry) => entry.toLowerCase() !== key,
              )
            : [...mapping.otherSubcategories, subcategory],
        };
      }),
    );
  }

  const serializedConfig = useMemo(
    () =>
      JSON.stringify(
        mappings.map((mapping) => {
          const pricePerFootByPriceList: Record<string, number> = {};
          for (const [priceListId, raw] of Object.entries(
            mapping.priceListOverrides,
          )) {
            const trimmed = raw.trim();
            const parsed = Number(trimmed);
            if (trimmed && Number.isFinite(parsed) && parsed >= 0) {
              pricePerFootByPriceList[priceListId] = parsed;
            }
          }
          return {
            diameterFeet: mapping.diameterFeet,
            style: mapping.style,
            otherSubcategories: isTopLevelRingStyle(mapping.style)
              ? [
                  ...mapping.otherSubcategories,
                  ...parseExtraSubcategoriesText(mapping.extraOtherText),
                ]
              : [],
            defaultPricePerFoot: mapping.defaultPricePerFoot,
            pricePerFootByPriceList,
          };
        }),
      ),
    [mappings],
  );

  return (
    <form action={action} className="space-y-4">
      <p className="text-xs text-slate-600">
        For each ring diameter and style, set a base price per foot and choose
        which product subcategories assigned on the product&apos;s Subcategory
        field appear as Other options in the quote builder. Each price list can
        override the $/ft — a blank cell falls back to the base rate. Other
        products are configured per diameter and top-level style (Drain or
        Sanitary).
      </p>

      <div className={tableWrapperClassName}>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>Diameter / Style</th>
              <th className={`${tableHeaderCellClassName} min-w-[120px]`}>
                Base price/ft
              </th>
              {priceLists.map((list) => (
                <th
                  key={list.id}
                  className={`${tableHeaderCellClassName} min-w-[120px]`}
                >
                  {list.name} $/ft
                </th>
              ))}
              <th className={`${tableHeaderCellClassName} min-w-[220px]`}>
                Other products
              </th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {mappings.map((mapping) => {
              const instance = instances.find(
                (entry) =>
                  entry.diameterFeet === mapping.diameterFeet &&
                  entry.style === mapping.style,
              );
              const showOtherPicker = isTopLevelRingStyle(mapping.style);

              return (
                <tr key={mapping.id} className="align-top">
                  <td className={`${tableCellClassName} font-medium text-slate-900`}>
                    {instance?.label ??
                      `${mapping.diameterFeet}' ${mapping.style}`}
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={mapping.defaultPricePerFoot}
                      onChange={(event) =>
                        updateMapping(mapping.id, {
                          defaultPricePerFoot: Number(event.target.value) || 0,
                        })
                      }
                      className={settingsInputClassName}
                    />
                  </td>
                  {priceLists.map((list) => (
                    <td key={list.id} className={tableCellClassName}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={mapping.priceListOverrides[list.id] ?? ""}
                        placeholder={String(mapping.defaultPricePerFoot)}
                        onChange={(event) =>
                          updatePriceListOverride(
                            mapping.id,
                            list.id,
                            event.target.value,
                          )
                        }
                        aria-label={`${list.name} price per foot`}
                        className={settingsInputClassName}
                      />
                    </td>
                  ))}
                  <td className={tableCellClassName}>
                    {showOtherPicker ? (
                      <SubcategoryPicker
                        label="Other"
                        options={subcategoryOptions}
                        selected={mapping.otherSubcategories}
                        extraText={mapping.extraOtherText}
                        onToggle={(subcategory) =>
                          toggleOtherSubcategory(mapping.id, subcategory)
                        }
                        onExtraTextChange={(value) =>
                          updateMapping(mapping.id, { extraOtherText: value })
                        }
                      />
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Solid rings use the default price only.
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <input type="hidden" name="ringBuilderConfig" value={serializedConfig} />

      <button type="submit" className={settingsSubmitClassName}>
        Save
      </button>
    </form>
  );
}
