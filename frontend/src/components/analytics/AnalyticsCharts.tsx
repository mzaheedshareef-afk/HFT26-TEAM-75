import type {
  AssessmentHistoryItem,
  DifficultyPerformanceMetric,
  ScoreTrendPoint,
  TopicPerformanceMetric,
} from '../../types/analytics';

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatShortDate(rawDate: string, fallbackIndex: number): string {
  if (!rawDate) return `#${fallbackIndex + 1}`;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return `#${fallbackIndex + 1}`;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/* ============================================================================
   1. SCORE TREND OVER TIME CHART
   ============================================================================ */
export function ScoreTrendChart({ data }: { data: ScoreTrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">
        Complete assessments to visualize your score trend over time.
      </div>
    );
  }

  const width = 520;
  const height = 190;
  const padLeft = 36;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points = data.map((item, idx) => {
    const xRatio = data.length === 1 ? 0.5 : idx / (data.length - 1);
    const x = padLeft + xRatio * plotW;
    const score = clampPercentage(item.overall_score);
    const y = padTop + plotH - (score / 100) * plotH;
    return { x, y, score, item, idx };
  });

  const linePath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
          padTop + plotH
        ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(
          1
        )} Z`
      : '';

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Score trend over time chart"
        className="w-full h-48 overflow-visible"
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padTop + plotH - (tick / 100) * plotH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={tick === 0 ? undefined : '3 3'}
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {areaPath && (
          <path d={areaPath} fill="rgba(37, 99, 235, 0.1)" stroke="none" />
        )}

        <path
          d={linePath}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((pt) => (
          <g key={pt.item.assessment_id}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={4.5}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={2.5}
            >
              <title>
                {`${pt.item.assessment_title}: ${Math.round(pt.score)} / 100`}
              </title>
            </circle>
            <text
              x={pt.x}
              y={height - 10}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {formatShortDate(pt.item.date, pt.idx)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ============================================================================
   2. TOPIC-WISE PERFORMANCE CHART
   ============================================================================ */
export function TopicPerformanceChart({
  data,
}: {
  data: TopicPerformanceMetric[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">
        No topic-wise evaluation data recorded yet.
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="Topic-wise performance chart"
      className="space-y-3"
    >
      {data.map((item) => {
        const pct = clampPercentage(item.average_score);
        return (
          <div key={item.topic} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">{item.topic}</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {Math.round(pct)}%{' '}
                <span className="font-normal text-slate-400">
                  ({item.assessments_count}{' '}
                  {item.assessments_count === 1 ? 'session' : 'sessions'})
                </span>
              </span>
            </div>
            <svg viewBox="0 0 400 10" className="h-2.5 w-full rounded-full">
              <rect
                x={0}
                y={0}
                width={400}
                height={10}
                rx={5}
                fill="#f1f5f9"
              />
              <rect
                x={0}
                y={0}
                width={(pct / 100) * 400}
                height={10}
                rx={5}
                fill="#0f172a"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
   3. DIFFICULTY-WISE PERFORMANCE CHART
   ============================================================================ */
const difficultyBarColors: Record<string, string> = {
  Easy: '#059669',
  Medium: '#d97706',
  Hard: '#dc2626',
  Adaptive: '#2563eb',
};

export function DifficultyPerformanceChart({
  data,
}: {
  data: DifficultyPerformanceMetric[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">
        No difficulty-wise performance breakdown available yet.
      </div>
    );
  }

  const width = 460;
  const height = 180;
  const padTop = 20;
  const padBottom = 34;
  const padX = 28;
  const plotH = height - padTop - padBottom;
  const colWidth = (width - padX * 2) / Math.max(1, data.length);

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Difficulty-wise performance chart"
        className="w-full h-44"
      >
        <line
          x1={padX}
          y1={padTop + plotH}
          x2={width - padX}
          y2={padTop + plotH}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        {data.map((d, idx) => {
          const pct = clampPercentage(d.average_score);
          const barH = Math.max(4, (pct / 100) * plotH);
          const barW = Math.min(48, colWidth * 0.55);
          const centerX = padX + idx * colWidth + colWidth / 2;
          const y = padTop + plotH - barH;
          const color = difficultyBarColors[d.difficulty] ?? '#2563eb';

          return (
            <g key={d.difficulty}>
              <rect
                x={centerX - barW / 2}
                y={y}
                width={barW}
                height={barH}
                rx={5}
                fill={color}
              >
                <title>
                  {`${d.difficulty}: ${Math.round(pct)}% avg (${d.attempts_count} attempts, ${Math.round(
                    d.pass_rate
                  )}% pass rate)`}
                </title>
              </rect>
              <text
                x={centerX}
                y={y - 6}
                textAnchor="middle"
                className="fill-slate-800 text-[10px] font-semibold"
              >
                {Math.round(pct)}%
              </text>
              <text
                x={centerX}
                y={height - 12}
                textAnchor="middle"
                className="fill-slate-600 text-[11px] font-medium"
              >
                {d.difficulty}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================================
   4. ASSESSMENT COMPLETION HISTORY CHART
   ============================================================================ */
export function CompletionHistoryChart({
  history,
}: {
  history: AssessmentHistoryItem[];
}) {
  if (history.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">
        No assessment completion history recorded yet.
      </div>
    );
  }

  const total = history.length;
  const counts = {
    completed: history.filter((h) => h.completion_status === 'completed')
      .length,
    partially_completed: history.filter(
      (h) => h.completion_status === 'partially_completed'
    ).length,
    in_progress: history.filter((h) => h.completion_status === 'in_progress')
      .length,
    expired: history.filter((h) => h.completion_status === 'expired').length,
  };

  const segments = [
    {
      key: 'completed',
      label: 'Completed',
      count: counts.completed,
      color: '#059669',
    },
    {
      key: 'partially_completed',
      label: 'Partial',
      count: counts.partially_completed,
      color: '#d97706',
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      count: counts.in_progress,
      color: '#2563eb',
    },
    {
      key: 'expired',
      label: 'Expired',
      count: counts.expired,
      color: '#dc2626',
    },
  ];

  let offsetX = 0;

  return (
    <div
      role="img"
      aria-label="Assessment completion history chart"
      className="space-y-4"
    >
      <svg viewBox="0 0 400 22" className="w-full h-5 rounded-lg overflow-hidden">
        <rect x={0} y={0} width={400} height={22} fill="#f1f5f9" />
        {segments.map((seg) => {
          if (seg.count === 0) return null;
          const w = (seg.count / total) * 400;
          const x = offsetX;
          offsetX += w;
          return (
            <rect
              key={seg.key}
              x={x}
              y={0}
              width={w}
              height={22}
              fill={seg.color}
            >
              <title>{`${seg.label}: ${seg.count}`}</title>
            </rect>
          );
        })}
      </svg>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 flex items-center justify-between"
          >
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: seg.color }}
                aria-hidden="true"
              />
              <span>{seg.label}</span>
            </span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   5. CODING SCORE VERSUS AI EFFICIENCY SCORE CHART
   ============================================================================ */
export function CodingVsEfficiencyChart({
  data,
}: {
  data: ScoreTrendPoint[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">
        Complete assessments to compare Coding Score vs Backend AI Efficiency Score.
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="Coding score versus AI efficiency score chart"
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-xs bg-slate-900"
            aria-hidden="true"
          />
          <span>Coding Score</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-xs bg-blue-600"
            aria-hidden="true"
          />
          <span>Backend AI Efficiency Score</span>
        </span>
      </div>

      <div className="space-y-3">
        {data.slice(-5).map((item) => {
          const codingPct = clampPercentage(item.coding_score);
          const hasEff =
            typeof item.ai_efficiency_score === 'number' &&
            Number.isFinite(item.ai_efficiency_score);
          const effPct = hasEff
            ? clampPercentage(item.ai_efficiency_score as number)
            : 0;

          return (
            <div
              key={`cmp-${item.assessment_id}`}
              className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-800 truncate max-w-xs">
                  {item.assessment_title}
                </span>
                <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                  Coding: <strong>{Math.round(codingPct)}</strong> &middot; AI
                  Efficiency:{' '}
                  <strong>
                    {hasEff ? Math.round(effPct) : 'Pending Backend'}
                  </strong>
                </span>
              </div>

              <svg viewBox="0 0 400 18" className="w-full h-4">
                {/* Coding Score Bar */}
                <rect x={0} y={1} width={400} height={6} rx={3} fill="#e2e8f0" />
                <rect
                  x={0}
                  y={1}
                  width={(codingPct / 100) * 400}
                  height={6}
                  rx={3}
                  fill="#0f172a"
                />

                {/* Backend AI Efficiency Score Bar (strictly rendered only if supplied by backend) */}
                <rect
                  x={0}
                  y={10}
                  width={400}
                  height={6}
                  rx={3}
                  fill="#e2e8f0"
                />
                {hasEff && (
                  <rect
                    x={0}
                    y={10}
                    width={(effPct / 100) * 400}
                    height={6}
                    rx={3}
                    fill="#2563eb"
                  />
                )}
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}

