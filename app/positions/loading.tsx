export default function LoadingPositions() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="bg-surface px-6 py-5">
            <div className="h-2.5 w-28 animate-pulse rounded-sm bg-surface-raised" />
            <div className="mt-3 h-7 w-40 animate-pulse rounded-sm bg-surface-raised" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line/70 px-3.5 py-3.5 last:border-b-0">
            <div className="h-2.5 w-10 animate-pulse rounded-sm bg-surface-raised" />
            <div className="h-2.5 w-16 animate-pulse rounded-sm bg-surface-raised" />
            <div className="ml-auto h-2.5 w-24 animate-pulse rounded-sm bg-surface-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
