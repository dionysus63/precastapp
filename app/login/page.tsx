import { redirect } from "next/navigation";
import { getActiveLoginUsers } from "@/app/login/actions";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
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
            Choose your account and enter your password. You will stay signed in
            on this computer until you sign out.
          </p>
        </div>

        <LoginForm users={users} />
      </div>
    </div>
  );
}
