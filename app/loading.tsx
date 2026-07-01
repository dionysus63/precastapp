/**
 * Root route-transition skeleton: mirrors the DashboardShell layout (fixed
 * sidebar + header) so navigations paint immediately instead of showing a
 * blank screen while server data loads.
 */
export default function RootLoading() {
  return (
    <div className="min-h-screen bg-slate-50/80 pl-60">
      <div className="fixed inset-y-0 left-0 w-60 border-r border-slate-200 bg-white p-4">
        <div className="h-8 w-36 animate-pulse rounded bg-slate-200" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-6 w-full animate-pulse rounded bg-slate-100"
            />
          ))}
        </div>
      </div>
      <div className="flex min-h-screen min-w-0 flex-col">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="h-6 w-64 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-96 animate-pulse rounded bg-slate-100" />
        </div>
        <main className="flex-1 px-5 py-5">
          <div className="mx-auto max-w-7xl space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
                />
              ))}
            </div>
            <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />
          </div>
        </main>
      </div>
    </div>
  );
}
