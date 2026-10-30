interface SkeletonProps {
  label?: string;
}

export function AnalyticsDashboardSkeleton({
  label = 'Loading analytics dashboard...',
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6 animate-pulse"
    >
      <span className="sr-only">{label}</span>

      {/* Top KPI Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={`kpi-skel-a-${idx}`}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-7 w-20 rounded bg-slate-200" />
            <div className="h-2.5 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Secondary KPI Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={`kpi-skel-b-${idx}`}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-6 w-16 rounded bg-slate-200" />
            <div className="h-2.5 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Charts Grid Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={`chart-skel-${idx}`}
            className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
          >
            <div className="h-4 w-44 rounded bg-slate-200" />
            <div className="h-48 w-full rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistoryTableSkeleton({
  label = 'Loading assessment history...',
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 animate-pulse"
    >
      <span className="sr-only">{label}</span>
      <div className="h-4 w-48 rounded bg-slate-200" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={`hist-row-${idx}`}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-100 p-4"
          >
            <div className="space-y-2">
              <div className="h-4 w-56 rounded bg-slate-200" />
              <div className="h-3 w-32 rounded bg-slate-100" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-16 rounded bg-slate-200" />
              <div className="h-6 w-20 rounded bg-slate-100" />
              <div className="h-8 w-24 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfilePageSkeleton({
  label = 'Loading student profile...',
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6 animate-pulse"
    >
      <span className="sr-only">{label}</span>
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4">
        <div className="h-6 w-52 rounded bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-100" />
        <div className="h-16 w-full rounded-lg bg-slate-100" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="h-24 w-full rounded bg-slate-100" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="h-24 w-full rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function RecruiterDashboardSkeleton({
  label = 'Loading recruiter dashboard...',
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6 animate-pulse"
    >
      <span className="sr-only">{label}</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={`rec-kpi-${idx}`}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-7 w-16 rounded bg-slate-200" />
            <div className="h-2.5 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="h-4 w-44 rounded bg-slate-200" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={`rec-cand-${idx}`}
                className="h-20 w-full rounded-lg bg-slate-100"
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="h-40 w-full rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function CandidateDiscoverySkeleton({
  label = 'Loading candidate search results...',
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="grid gap-5 md:grid-cols-2 animate-pulse"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={`disc-skel-${idx}`}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-5 w-44 rounded bg-slate-200" />
              <div className="h-3.5 w-60 rounded bg-slate-100" />
            </div>
            <div className="h-7 w-20 rounded-md bg-slate-200" />
          </div>
          <div className="h-12 w-full rounded bg-slate-100" />
          <div className="flex flex-wrap gap-2">
            <div className="h-5 w-16 rounded bg-slate-200" />
            <div className="h-5 w-20 rounded bg-slate-200" />
            <div className="h-5 w-24 rounded bg-slate-100" />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="h-14 rounded-lg bg-slate-100" />
            <div className="h-14 rounded-lg bg-slate-100" />
            <div className="h-14 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CandidateComparisonSkeleton({
  label = 'Loading candidate comparison matrix...',
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6 animate-pulse"
    >
      <span className="sr-only">{label}</span>
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="h-5 w-52 rounded bg-slate-200" />
        <div className="h-48 w-full rounded-lg bg-slate-100" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={`cmp-row-${idx}`}
            className="h-10 w-full rounded bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}
