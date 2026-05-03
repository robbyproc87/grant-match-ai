"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FitBadge } from "@/components/fit-badge";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/browser";
import { recomputeAllForOrg, recomputeOneScore } from "@/lib/scoring/actions";
import { formatCurrency, formatDeadline, cn } from "@/lib/utils";
import type { Grant, MatchScore, ScoreBreakdown } from "@/lib/types/db";
import { toast } from "sonner";

type Props = {
  orgId: string;
  grants: Grant[];
  initialScores: MatchScore[];
  funderNames: Record<string, string>;
};

export function GrantsClient({ orgId, grants, initialScores, funderNames }: Props) {
  const [scores, setScores] = useState<MatchScore[]>(initialScores);
  const [selected, setSelected] = useState<string | null>(null);

  const scoreMap = useMemo(() => {
    const m = new Map<string, MatchScore>();
    for (const s of scores) m.set(s.grant_id, s);
    return m;
  }, [scores]);

  const sorted = useMemo(() => {
    return [...grants].sort((a, b) => {
      const sa = scoreMap.get(a.id)?.score_total ?? -1;
      const sb = scoreMap.get(b.id)?.score_total ?? -1;
      return sb - sa;
    });
  }, [grants, scoreMap]);

  const hasInflight = scores.some(
    (s) => s.status === "pending" || s.status === "computing",
  );

  const refetch = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from("match_scores")
      .select("*")
      .eq("org_id", orgId);
    if (data) setScores(data as MatchScore[]);
  }, [orgId]);

  useEffect(() => {
    if (!hasInflight) return;
    const id = setInterval(refetch, 2000);
    return () => clearInterval(id);
  }, [hasInflight, refetch]);

  if (grants.length === 0) {
    return (
      <EmptyState
        title="No grants yet"
        description="Run `npm run seed` to populate funders and grants."
        icon="📭"
      />
    );
  }

  return (
    <div className="animate-fade-in space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          Sorted by fit score • {sorted.length} opportunities
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={hasInflight}
          onClick={async () => {
            await recomputeAllForOrg(orgId);
            toast.success("Recomputing all scores…");
            setTimeout(refetch, 500);
          }}
        >
          Recompute all scores
        </Button>
      </div>
      {sorted.map((g) => {
        const s = scoreMap.get(g.id);
        const isSelected = selected === g.id;
        return (
          <div key={g.id}>
            <Card
              onClick={() => setSelected(isSelected ? null : g.id)}
              className={cn(
                "cursor-pointer border-2 p-5 transition-all",
                isSelected
                  ? "border-primary"
                  : "border-transparent hover:border-gm-purple100",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold leading-snug">{g.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {funderNames[g.funder_id] ?? "Unknown funder"}
                  </div>
                </div>
                <ScoreCell
                  status={s?.status}
                  score={s?.score_total}
                  onRetry={async () => {
                    await recomputeOneScore(orgId, g.id);
                    toast.success("Retrying…");
                    setTimeout(refetch, 500);
                  }}
                />
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {g.focus_areas.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-gm-purple50 px-2 py-0.5 text-xs text-gm-purple700"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  💰 {formatCurrency(g.amount_min)} – {formatCurrency(g.amount_max)}
                </span>
                <span>
                  📅{" "}
                  {g.deadline_type === "rolling" ? "Rolling" : formatDeadline(g.deadline)}
                </span>
              </div>
            </Card>
            {isSelected && s && s.status === "computed" && s.score_breakdown && (
              <DetailPanel
                grant={g}
                breakdown={s.score_breakdown}
                funderName={funderNames[g.funder_id] ?? "Unknown"}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreCell({
  status,
  score,
  onRetry,
}: {
  status?: MatchScore["status"];
  score?: number | null;
  onRetry: () => void;
}) {
  if (!status || status === "pending" || status === "computing") {
    return <Skeleton className="h-6 w-24" />;
  }
  if (status === "failed") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        className="text-xs text-destructive underline"
      >
        Score unavailable — retrying
      </button>
    );
  }
  return <FitBadge score={score ?? 0} />;
}

function DetailPanel({
  grant,
  breakdown,
  funderName,
}: {
  grant: Grant;
  breakdown: ScoreBreakdown;
  funderName: string;
}) {
  const factors: Array<[string, number, string]> = [
    [
      "Mission alignment",
      breakdown.mission_alignment.score,
      breakdown.mission_alignment.reasoning,
    ],
    ["Geographic fit", breakdown.geographic_fit.score, breakdown.geographic_fit.reasoning],
    ["Budget fit", breakdown.budget_fit.score, breakdown.budget_fit.reasoning],
    ["Eligibility", breakdown.eligibility.score, breakdown.eligibility.reasoning],
    [
      "Population alignment",
      breakdown.population_alignment.score,
      breakdown.population_alignment.reasoning,
    ],
    [
      "Prior relationship",
      breakdown.prior_relationship.score,
      breakdown.prior_relationship.reasoning,
    ],
  ];
  return (
    <Card className="animate-fade-in mt-3 space-y-3 border-2 border-primary p-5">
      <div className="text-sm font-semibold">{grant.name}</div>
      <div className="text-xs text-muted-foreground">{funderName}</div>
      <div className="space-y-2">
        {factors.map(([label, score, reasoning]) => (
          <div key={label} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold">{label}</div>
              <div className="text-xs font-mono">{score}</div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{reasoning}</p>
          </div>
        ))}
      </div>
      {breakdown.eligibility.failed_rules.length > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <div className="mb-1 text-xs font-semibold text-destructive">
            Eligibility issues
          </div>
          <ul className="space-y-0.5 text-xs text-destructive">
            {breakdown.eligibility.failed_rules.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
      {breakdown.eligibility.manual_checks.length > 0 && (
        <ManualReview rules={breakdown.eligibility.manual_checks} />
      )}
      {grant.source_url && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={grant.source_url} target="_blank" rel="noreferrer">
            Visit funder site →
          </a>
        </Button>
      )}
    </Card>
  );
}

function ManualReview({ rules }: { rules: string[] }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  return (
    <div className="rounded-lg border border-gm-purple100 bg-gm-purple50/40 p-3">
      <div className="mb-2 text-xs font-semibold text-gm-purple700">
        Manual review
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        These funder rules can&rsquo;t be auto-evaluated — confirm before applying.
      </p>
      <div className="space-y-1.5">
        {rules.map((r, i) => (
          <label key={i} className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={!!checked[i]}
              onCheckedChange={(c) =>
                setChecked((s) => ({ ...s, [i]: Boolean(c) }))
              }
            />
            <span className={checked[i] ? "text-muted-foreground line-through" : ""}>
              {r}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
