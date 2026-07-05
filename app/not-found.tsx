import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you requested does not exist or may have been moved.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <ButtonLink href="/">Go to dashboard</ButtonLink>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
