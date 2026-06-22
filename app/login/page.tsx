import { redirect } from "next/navigation";
import { signInAsUser } from "@/app/login/actions";
import { getActiveLoginUsers } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/constants";
import { getAppSettings } from "@/lib/app-settings";

export default async function LoginPage() {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  const [users, settings] = await Promise.all([
    getActiveLoginUsers(),
    getAppSettings(),
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {settings.appTitle}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Choose your user account to continue. Password login is coming
            soon.
          </p>
        </div>

        {users.length === 0 ? (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            No active users found. Run the database seed to create the admin
            account for Nick.
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {users.map((user) => (
              <form key={user.id} action={signInAsUser}>
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {user.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-slate-500">@{user.username}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {ROLE_LABELS[user.role]}
                    </p>
                  </div>
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
