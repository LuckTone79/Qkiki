type AppRouteLoadingProps = {
  variant?: "list" | "detail" | "workbench";
};

export function AppRouteLoading({ variant = "list" }: AppRouteLoadingProps) {
  const rowCount = variant === "workbench" ? 5 : 6;

  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div>
        <div className="h-4 w-28 animate-pulse rounded bg-stone-200" />
        <div className="mt-3 h-8 w-72 max-w-full animate-pulse rounded bg-stone-200" />
        <div className="mt-3 h-4 w-[34rem] max-w-full animate-pulse rounded bg-stone-100" />
      </div>

      {variant === "workbench" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="rounded-md border border-stone-200 bg-white p-4">
            <div className="h-5 w-36 animate-pulse rounded bg-stone-200" />
            <div className="mt-4 h-44 animate-pulse rounded bg-stone-100" />
            <div className="mt-4 flex gap-2">
              <div className="h-9 w-24 animate-pulse rounded bg-stone-200" />
              <div className="h-9 w-28 animate-pulse rounded bg-stone-100" />
            </div>
          </div>
          <div className="rounded-md border border-stone-200 bg-white p-4">
            <div className="h-5 w-32 animate-pulse rounded bg-stone-200" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: rowCount }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded bg-stone-100" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-stone-200 bg-white p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-stone-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: rowCount }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-10 w-10 flex-none animate-pulse rounded bg-stone-100" />
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-stone-100" />
                  <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {variant === "detail" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="rounded-md border border-stone-200 bg-white p-4"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-stone-100" />
              <div className="mt-4 h-28 animate-pulse rounded bg-stone-100" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
