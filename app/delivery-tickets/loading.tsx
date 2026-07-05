export default function DeliveryTicketsLoading() {
  return (
    <div className="min-h-screen animate-pulse bg-slate-50/80 pl-60">
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <div className="h-8 w-56 rounded bg-slate-200" />
        <div className="h-4 w-[28rem] max-w-full rounded bg-slate-100" />
        <div className="h-40 rounded-xl bg-white shadow-sm" />
        <div className="h-72 rounded-xl bg-white shadow-sm" />
      </div>
    </div>
  );
}
