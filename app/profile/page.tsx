import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { customerInputClassName } from "@/components/customers/customer-form";
import {
  changeMyPassword,
  updateMyProfile,
} from "@/app/settings/users/actions";
import { requireAuth } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/constants";

export default async function ProfilePage() {
  const user = await requireAuth();

  return (
    <DashboardShell
      title="My Profile"
      subtitle="Update how your name appears across the app."
    >
      <SectionCard title="Profile Details">
        <form action={updateMyProfile} className="max-w-xl space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Username
            </label>
            <p className="mt-1 text-sm text-slate-900">@{user.username}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Role
            </label>
            <p className="mt-1 text-sm text-slate-900">
              {ROLE_LABELS[user.role]}
            </p>
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="block text-xs font-medium text-slate-700"
            >
              Display Name *
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              defaultValue={user.displayName}
              className={customerInputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="initials"
              className="block text-xs font-medium text-slate-700"
            >
              Initials *
            </label>
            <input
              id="initials"
              name="initials"
              type="text"
              required
              maxLength={3}
              defaultValue={user.initials}
              className={customerInputClassName}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Role and permission changes are managed by an admin in Settings.
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Save Profile
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Change Password">
        <form action={changeMyPassword} className="max-w-xl space-y-5">
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-xs font-medium text-slate-700"
            >
              Current Password *
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className={customerInputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-xs font-medium text-slate-700"
            >
              New Password *
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              className={customerInputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-medium text-slate-700"
            >
              Confirm New Password *
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              className={customerInputClassName}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Change Password
            </button>
          </div>
        </form>
      </SectionCard>
    </DashboardShell>
  );
}
