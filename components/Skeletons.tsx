export function ParagraphSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-2" aria-hidden="true">
      <div className="h-4 w-full rounded bg-line/60" />
      <div className="h-4 w-11/12 rounded bg-line/60" />
      <div className="h-4 w-4/5 rounded bg-line/60" />
      <div className="h-4 w-2/3 rounded bg-line/60" />
    </div>
  );
}

export function BranchCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-line bg-card p-5"
          aria-hidden="true"
        >
          <div className="h-5 w-3/4 rounded bg-line/60" />
          <div className="mt-4 space-y-2">
            <div className="h-3.5 w-full rounded bg-line/50" />
            <div className="h-3.5 w-5/6 rounded bg-line/50" />
          </div>
          <div className="mt-5 h-3.5 w-2/3 rounded bg-line/50" />
        </div>
      ))}
    </div>
  );
}
