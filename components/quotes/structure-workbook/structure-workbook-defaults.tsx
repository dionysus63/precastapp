"use client";

import { useMemo } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { structureInputClassName } from "@/components/structures/structure-utils";
import type { StructureWorkbookDefaults, StructureWorkbookOptions } from "@/lib/quotes/structure-workbook";

type StructureWorkbookDefaultsPanelProps = {
  defaults: StructureWorkbookDefaults;
  options: StructureWorkbookOptions;
  onChange: (defaults: StructureWorkbookDefaults) => void;
  onApplyToSelected: () => void;
  selectedCount: number;
};

function uniquePipeMaterials(
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"],
): string[] {
  return [...new Set(pipeOpeningSizes.map((entry) => entry.pipeMaterial))].sort();
}

function pipeSizesForMaterial(
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"],
  material: string,
): number[] {
  return [
    ...new Set(
      pipeOpeningSizes
        .filter((entry) => entry.pipeMaterial === material)
        .map((entry) => entry.pipeSizeInches),
    ),
  ].sort((a, b) => a - b);
}

function pipeTypesForMaterialSize(
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"],
  material: string,
  size: number,
): string[] {
  return [
    ...new Set(
      pipeOpeningSizes
        .filter(
          (entry) =>
            entry.pipeMaterial === material &&
            Math.abs(entry.pipeSizeInches - size) < 1e-6,
        )
        .map((entry) => entry.pipeType),
    ),
  ].sort();
}

export function StructureWorkbookDefaultsPanel({
  defaults,
  options,
  onChange,
  onApplyToSelected,
  selectedCount,
}: StructureWorkbookDefaultsPanelProps) {
  const template = options.templates.find(
    (entry) => entry.id === defaults.templateId,
  );
  const diameters = template?.diameters ?? [];

  const pipeMaterials = useMemo(
    () => uniquePipeMaterials(options.pipeOpeningSizes),
    [options.pipeOpeningSizes],
  );
  const sizes = pipeSizesForMaterial(
    options.pipeOpeningSizes,
    defaults.pipeMaterial,
  );
  const types = pipeTypesForMaterialSize(
    options.pipeOpeningSizes,
    defaults.pipeMaterial,
    Number(defaults.pipeSizeInches),
  );

  function patch(partial: Partial<StructureWorkbookDefaults>) {
    onChange({ ...defaults, ...partial });
  }

  function handleTemplateChange(templateId: string) {
    const nextTemplate = options.templates.find(
      (entry) => entry.id === templateId,
    );
    onChange({
      ...defaults,
      templateId,
      diameterFeet: nextTemplate?.diameters[0]
        ? String(nextTemplate.diameters[0].insideDiameterFeet)
        : "",
      castingProductId: nextTemplate?.defaultCastingProductId ?? "",
    });
  }

  return (
    <SectionCard
      title="Entry defaults"
      description="Defaults apply to newly added rows. Use the button below to fill blank fields on selected rows."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Name prefix
          </label>
          <input
            type="text"
            value={defaults.namePrefix}
            onChange={(event) => patch({ namePrefix: event.target.value })}
            placeholder="MH-"
            className={structureInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Starting number
          </label>
          <input
            type="number"
            min={1}
            value={defaults.startNumber}
            onChange={(event) =>
              patch({
                startNumber: Math.max(
                  1,
                  Number.parseInt(event.target.value, 10) || 1,
                ),
              })
            }
            className={structureInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Default template
          </label>
          <select
            value={defaults.templateId}
            onChange={(event) => handleTemplateChange(event.target.value)}
            className={structureInputClassName}
          >
            {options.templates.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Default diameter (ft)
          </label>
          <select
            value={defaults.diameterFeet}
            onChange={(event) => patch({ diameterFeet: event.target.value })}
            className={structureInputClassName}
          >
            <option value="">—</option>
            {diameters.map((entry) => (
              <option
                key={entry.id}
                value={String(entry.insideDiameterFeet)}
              >
                {entry.insideDiameterFeet}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Default casting
          </label>
          <select
            value={defaults.castingProductId}
            onChange={(event) =>
              patch({ castingProductId: event.target.value })
            }
            className={structureInputClassName}
          >
            <option value="">— Default —</option>
            {options.castings.map((casting) => (
              <option key={casting.id} value={casting.id}>
                {casting.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Default pipe material
          </label>
          <select
            value={defaults.pipeMaterial}
            onChange={(event) =>
              patch({
                pipeMaterial: event.target.value,
                pipeSizeInches: "",
                pipeType: "",
              })
            }
            className={structureInputClassName}
          >
            <option value="">—</option>
            {pipeMaterials.map((material) => (
              <option key={material} value={material}>
                {material}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Default pipe size
          </label>
          <select
            value={defaults.pipeSizeInches}
            onChange={(event) =>
              patch({ pipeSizeInches: event.target.value, pipeType: "" })
            }
            className={structureInputClassName}
          >
            <option value="">—</option>
            {sizes.map((size) => (
              <option key={size} value={String(size)}>
                {size}&quot;
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Default pipe type
          </label>
          <select
            value={defaults.pipeType}
            onChange={(event) => patch({ pipeType: event.target.value })}
            className={structureInputClassName}
          >
            <option value="">—</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Default boots
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={defaults.bootCount}
            onChange={(event) => patch({ bootCount: event.target.value })}
            className={structureInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Default qty
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={defaults.qty}
            onChange={(event) => patch({ qty: event.target.value })}
            className={structureInputClassName}
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={onApplyToSelected}
          disabled={selectedCount === 0}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Apply defaults to selected rows ({selectedCount})
        </button>
      </div>
    </SectionCard>
  );
}
