import Link from "next/link";

export default function QuotePreviewNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-200 px-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">Quote not found</h1>
        <p className="mt-2 text-sm text-neutral-600">
          This quote may have been removed, or the link may be incorrect.
        </p>
        <Link
          href="/quotes"
          className="mt-6 inline-flex rounded border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          ← Back to Quotes
        </Link>
      </div>
    </div>
  );
}
