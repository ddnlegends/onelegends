export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="h-10 w-56 animate-pulse rounded bg-blush" />
      <div className="h-4 max-w-xl animate-pulse rounded bg-blush" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl border border-line bg-blush" />
        <div className="h-28 animate-pulse rounded-xl border border-line bg-blush" />
        <div className="h-28 animate-pulse rounded-xl border border-line bg-blush" />
      </div>
      <div className="h-48 animate-pulse rounded-xl border border-line bg-blush" />
    </div>
  );
}
