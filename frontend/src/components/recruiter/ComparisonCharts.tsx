import type { RecruiterCandidateSummary } from '../../types/recruiter';

const CANDIDATE_PALETTE = [
  { bar: '#2563eb', badge: 'bg-blue-600' },
  { bar: '#059669', badge: 'bg-emerald-600' },
  { bar: '#d97706', badge: 'bg-amber-600' },
  { bar: '#7c3aed', badge: 'bg-violet-600' },
];

interface ComparisonChartsProps {
  candidates: RecruiterCandidateSummary[];
}

export function ComparisonScoreBarsChart({
  candidates,
}: ComparisonChartsProps) {
  const metricGroups: Array<{
    key: 'overall_score' | 'coding_score' | 'ai_efficiency_score' | 'consistency_score';
    label: string;
  }> = [
    { key: 'overall_score', label: 'Verified Assessment Score' },
    { key: 'coding_score', label: 'Coding Score' },
    { key: 'ai_efficiency_score', label: 'Official AI Efficiency Score' },
    { key: 'consistency_score', label: 'Consistency Score' },
  ];

  return (
    <div
      role="img"
      aria-label="Multi-candidate verified score comparison chart"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Verified Score &amp; Consistency Comparison
          </h3>
          <p className="text-xs text-slate-500">
            Side-by-side platform-verified scores (0–100 scale). AI Efficiency Scores are strictly backend-returned.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {candidates.map((cand, idx) => {
            const color = CANDIDATE_PALETTE[idx % CANDIDATE_PALETTE.length];
            return (
              <span
                key={cand.candidate_id}
                className="inline-flex items-center gap-1.5 font-medium text-slate-700"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${color.badge}`}
                  aria-hidden="true"
                />
                <span>{cand.display_name}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {metricGroups.map((group) => (
          <div
            key={group.key}
            className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 space-y-2.5"
          >
            <p className="text-xs font-semibold text-slate-800">
              {group.label}
            </p>
            <div className="space-y-2">
              {candidates.map((cand, idx) => {
                const rawScore = cand[group.key];
                const hasScore =
                  typeof rawScore === 'number' && Number.isFinite(rawScore);
                const clamped = hasScore
                  ? Math.max(0, Math.min(100, Math.round(rawScore)))
                  : 0;
                const color = CANDIDATE_PALETTE[idx % CANDIDATE_PALETTE.length];

                return (
                  <div key={`${group.key}-${cand.candidate_id}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate">
                        {cand.display_name}
                      </span>
                      <span className="font-bold tabular-nums text-slate-900">
                        {hasScore ? `${clamped} / 100` : 'Pending / N/A'}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <svg
                        viewBox="0 0 100 8"
                        preserveAspectRatio="none"
                        className="h-full w-full block"
                      >
                        <title>
                          {`${cand.display_name} — ${group.label}: ${
                            hasScore ? `${clamped}/100` : 'Pending'
                          }`}
                        </title>
                        <rect
                          x={0}
                          y={0}
                          width={clamped}
                          height={8}
                          rx={4}
                          fill={color.bar}
                        />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComparisonTopicDifficultyCharts({
  candidates,
}: ComparisonChartsProps) {
  const allTopics = Array.from(
    new Set(
      candidates.flatMap((c) => c.topic_performance.map((t) => t.topic))
    )
  ).slice(0, 6);

  const difficulties = ['Easy', 'Medium', 'Hard'];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Topic-wise Comparison */}
      <div
        role="img"
        aria-label="Topic-wise candidate performance comparison chart"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Topic-Wise Performance Evidence
          </h3>
          <p className="text-xs text-slate-500">
            Verified topic scores across completed technical assessments.
          </p>
        </div>

        {allTopics.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No topic-level assessment breakdowns reported yet for the selected candidates.
          </p>
        ) : (
          <div className="space-y-3.5">
            {allTopics.map((topic) => (
              <div
                key={topic}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-2"
              >
                <p className="text-xs font-semibold text-slate-800">{topic}</p>
                <div className="space-y-1.5">
                  {candidates.map((cand, idx) => {
                    const match = cand.topic_performance.find(
                      (t) => t.topic.toLowerCase() === topic.toLowerCase()
                    );
                    const score = match ? Math.round(match.average_score) : null;
                    const color =
                      CANDIDATE_PALETTE[idx % CANDIDATE_PALETTE.length];

                    return (
                      <div
                        key={`${topic}-${cand.candidate_id}`}
                        className="grid grid-cols-12 items-center gap-2 text-xs"
                      >
                        <span className="col-span-4 truncate text-slate-600">
                          {cand.display_name}
                        </span>
                        <div className="col-span-6 h-2 rounded-full bg-slate-200 overflow-hidden">
                          {score !== null && (
                            <div
                              style={{
                                width: `${Math.max(0, Math.min(100, score))}%`,
                                backgroundColor: color.bar,
                              }}
                              className="h-full rounded-full"
                            />
                          )}
                        </div>
                        <span className="col-span-2 text-right font-semibold tabular-nums text-slate-900">
                          {score !== null ? `${score}%` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Difficulty-wise Comparison */}
      <div
        role="img"
        aria-label="Difficulty-wise candidate performance comparison chart"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Difficulty-Wise Performance Evidence
          </h3>
          <p className="text-xs text-slate-500">
            Average verified scores across Easy, Medium, and Hard coding challenges.
          </p>
        </div>

        <div className="space-y-3.5">
          {difficulties.map((level) => (
            <div
              key={level}
              className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-2"
            >
              <p className="text-xs font-semibold text-slate-800">
                {level} Tier
              </p>
              <div className="space-y-1.5">
                {candidates.map((cand, idx) => {
                  const match = cand.difficulty_performance.find(
                    (d) => d.difficulty.toLowerCase() === level.toLowerCase()
                  );
                  const score = match ? Math.round(match.average_score) : null;
                  const color =
                    CANDIDATE_PALETTE[idx % CANDIDATE_PALETTE.length];

                  return (
                    <div
                      key={`${level}-${cand.candidate_id}`}
                      className="grid grid-cols-12 items-center gap-2 text-xs"
                    >
                      <span className="col-span-4 truncate text-slate-600">
                        {cand.display_name}
                      </span>
                      <div className="col-span-6 h-2 rounded-full bg-slate-200 overflow-hidden">
                        {score !== null && (
                          <div
                            style={{
                              width: `${Math.max(0, Math.min(100, score))}%`,
                              backgroundColor: color.bar,
                            }}
                            className="h-full rounded-full"
                          />
                        )}
                      </div>
                      <span className="col-span-2 text-right font-semibold tabular-nums text-slate-900">
                        {score !== null ? `${score}%` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

