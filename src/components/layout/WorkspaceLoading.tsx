export function WorkspaceLoading() {
  return (
    <div className="min-h-screen bg-[#f3f5f4] lg:pl-[248px]" aria-label="Loading care workspace">
      <div className="h-[68px] border-b border-[#dfe6e4] bg-white/80" />
      <main className="mx-auto w-full max-w-[1540px] space-y-5 px-4 py-6 sm:px-7 sm:py-8 xl:px-10" aria-hidden="true">
        <div className="h-8 w-64 animate-pulse rounded-md bg-[#e2e9e6]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-[#e8eeeb]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-[#e2e9e6] bg-white" />)}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.65fr_.9fr]">
          <div className="h-[360px] animate-pulse rounded-xl border border-[#e2e9e6] bg-white" />
          <div className="h-[360px] animate-pulse rounded-xl border border-[#e2e9e6] bg-white" />
        </div>
      </main>
    </div>
  );
}
