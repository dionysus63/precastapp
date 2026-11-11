import { updateMyJobsDefaultTab } from "@/app/settings/users/actions";
import { ActionForm } from "@/components/ui/action-form";
import {
  JOBS_DEFAULT_TAB_OPTIONS,
  type JobsDefaultTabValue,
} from "@/lib/jobs-default-tab";

const OPTION_HINTS: Record<JobsDefaultTabValue, string> = {
  OPEN: "The Open tab: every open job, whoever created it.",
  MY_OPEN: "The My Open tab: only open jobs you created.",
  FAVORITES: "The Favorites tab: the jobs you starred, open or not.",
};

/**
 * The signed-in user's own choice of which Jobs list tab opens when they
 * click Jobs. Shown under Settings → My Preferences and on My Profile (for
 * roles that can't open Settings).
 */
export function JobsDefaultTabForm({
  current,
}: {
  current: JobsDefaultTabValue;
}) {
  return (
    <ActionForm action={updateMyJobsDefaultTab} className="max-w-xl">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-slate-700">
          Default Jobs tab
        </legend>
        {JOBS_DEFAULT_TAB_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 has-[:checked]:border-slate-400 has-[:checked]:bg-slate-50"
          >
            <input
              type="radio"
              name="defaultJobsTab"
              value={option.value}
              defaultChecked={option.value === current}
              className="mt-0.5"
            />
            <span>
              <span className="block text-xs font-semibold text-slate-900">
                {option.label}
              </span>
              <span className="block text-[11px] text-slate-500">
                {OPTION_HINTS[option.value]}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

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
