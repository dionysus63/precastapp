"use client";

import { useState, useTransition } from "react";
import {
  setInitialPassword,
  signInWithPassword,
  type LoginUserOption,
} from "@/app/login/actions";
import { ROLE_LABELS, type UserRoleKey } from "@/lib/auth/constants";

type LoginFormProps = {
  users: LoginUserOption[];
};

export function LoginForm({ users }: LoginFormProps) {
  const [selectedUser, setSelectedUser] = useState<LoginUserOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const needsPasswordSetup =
    selectedUser &&
    (!selectedUser.hasPassword || selectedUser.mustChangePassword);

  function handleSelectUser(user: LoginUserOption) {
    setSelectedUser(user);
    setError(null);
  }

  function handleBack() {
    setSelectedUser(null);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const result = needsPasswordSetup
        ? await setInitialPassword(formData)
        : await signInWithPassword(formData);

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  if (users.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        No active users found. Run the database seed to create the admin
        account for Nick.
      </div>
    );
  }

  if (!selectedUser) {
    return (
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => handleSelectUser(user)}
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
                {ROLE_LABELS[user.role as UserRoleKey]}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-md">
      <button
        type="button"
        onClick={handleBack}
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Choose a different account
      </button>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            {selectedUser.initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {selectedUser.displayName}
            </p>
            <p className="text-xs text-slate-500">@{selectedUser.username}</p>
          </div>
        </div>

        <form action={handleSubmit} className="mt-6 space-y-4">
          <input type="hidden" name="userId" value={selectedUser.id} />

          {needsPasswordSetup ? (
            <>
              <p className="text-sm text-slate-600">
                {selectedUser.mustChangePassword
                  ? "Your password was reset. Create a new password to continue."
                  : "Create a password for this account. You will stay signed in on this computer until you sign out."}
              </p>
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-slate-700"
                >
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-medium text-slate-700"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </>
          ) : (
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
          )}

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Signing in..."
              : needsPasswordSetup
                ? "Create Password & Sign In"
                : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
