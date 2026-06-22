import Link from "next/link";
import { deactivateUser, reactivateUser } from "@/app/settings/users/actions";
import type { UserRoleKey } from "@/lib/auth/constants";
import { ROLE_LABELS } from "@/lib/auth/constants";

export type UserListRow = {
  id: string;
  username: string;
  displayName: string;
  initials: string;
  role: UserRoleKey;
  isActive: boolean;
  lastLoginAt: string | null;
};

type UsersListProps = {
  users: UserListRow[];
};

export function UsersList({ users }: UsersListProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-xs">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">
              User
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">
              Role
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">
              Status
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">
              Last login
            </th>
            <th className="px-4 py-3 text-right font-semibold text-slate-600">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                    {user.initials}
                  </div>
                  <div>
                    <Link
                      href={`/settings/users/${user.id}`}
                      className="font-semibold text-slate-900 hover:text-slate-700"
                    >
                      {user.displayName}
                    </Link>
                    <p className="text-slate-500">@{user.username}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-700">
                {ROLE_LABELS[user.role]}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    user.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {user.lastLoginAt ?? "Never"}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/settings/users/${user.id}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </Link>
                  {user.isActive ? (
                    <form action={deactivateUser}>
                      <input type="hidden" name="id" value={user.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50"
                      >
                        Deactivate
                      </button>
                    </form>
                  ) : (
                    <form action={reactivateUser}>
                      <input type="hidden" name="id" value={user.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-emerald-200 px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        Reactivate
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
