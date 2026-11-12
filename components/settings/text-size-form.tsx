import type { CSSProperties } from "react";
import { updateMyTextSize } from "@/app/settings/users/actions";
import { ActionForm } from "@/components/ui/action-form";
import {
  TEXT_SIZE_OPTIONS,
  TEXT_SIZE_SCALE,
  type TextSizeValue,
} from "@/lib/text-size";

/**
 * The signed-in user's own choice of how big the app's screen text is.
 * Shown under Settings → My Preferences and on My Profile (for roles that
 * can't open Settings). Each choice previews itself: its sample line is
 * drawn at that size whatever the current setting is.
 */
export function TextSizeForm({ current }: { current: TextSizeValue }) {
  return (
    <ActionForm action={updateMyTextSize} className="max-w-xl">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-slate-700">Text size</legend>
        {TEXT_SIZE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 has-[:checked]:border-slate-400 has-[:checked]:bg-slate-50"
          >
            <input
              type="radio"
              name="textSize"
              value={option.value}
              defaultChecked={option.value === current}
              className="mt-0.5"
            />
            <span>
              <span className="block text-xs font-semibold text-slate-900">
                {option.label}
              </span>
              <span className="block text-2xs text-slate-500">
                {option.hint}
              </span>
              <span
                className="mt-1 block text-xs text-slate-700"
                style={
                  {
                    "--text-scale": TEXT_SIZE_SCALE[option.value],
                  } as CSSProperties
                }
              >
                Sample: 26-014 Main Street Drainage, Rim 101.10
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="mt-3 text-2xs text-slate-500">
        Only the letters change size. Column widths, PDF previews and printed
        PDFs stay the same. If you used Zoom In before, set it back with View,
        Actual Size.
      </p>

      <div className="mt-4 flex justify-start">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Save
        </button>
      </div>
    </ActionForm>
  );
}
