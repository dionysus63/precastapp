export default function JobsLoading() {
  return (
    <div className="min-h-screen animate-pulse bg-slate-50/80 pl-60">
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-100" />
        <div className="h-64 rounded-xl bg-white shadow-sm" />
      </div>
    </div>
  );
}
