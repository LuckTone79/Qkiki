export default function AdminPanelLoading() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-72 max-w-full animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-[32rem] max-w-full animate-pulse rounded bg-slate-100" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-8 w-24 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-3 w-32 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
