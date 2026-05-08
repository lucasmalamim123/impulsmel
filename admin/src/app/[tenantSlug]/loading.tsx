export default function TenantLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="loading-skeleton h-4 w-24 rounded" />
        <div className="loading-skeleton h-8 w-64 rounded" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5 shadow-sm">
            <div className="loading-skeleton h-3 w-24 rounded" />
            <div className="loading-skeleton mt-4 h-8 w-16 rounded" />
            <div className="loading-skeleton mt-3 h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5 shadow-sm">
        <div className="loading-skeleton h-5 w-44 rounded" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="loading-skeleton h-12 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
