"use client";

import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import type {
  Application,
  ApplicationDraft,
  DraftSections,
  DraftReview,
  Grant,
} from "@/lib/types/db";
import { DRAFT_SECTION_KEYS } from "@/lib/types/db";
import { generateDraft, reviewDraft, saveDraftSections } from "./actions";

const SECTION_LABELS: Record<keyof DraftSections, string> = {
  need_statement: "Statement of Need",
  goals: "Goals & Measurable Objectives",
  approach: "Approach / Program Design",
  budget_narrative: "Budget Narrative",
  sustainability: "Sustainability",
};

type Props = {
  applications: Application[];
  grantMap: Record<string, Grant>;
  funderNames: Record<string, string>;
  draftMap: Record<string, ApplicationDraft>;
};

// ---------------------------------------------------------------------------
// Top-level: guards empty state, then delegates all stateful work to ShellEditor
// ---------------------------------------------------------------------------

export function ShellClient({ applications, grantMap, funderNames, draftMap }: Props) {
  if (applications.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="No applications yet"
        description="Add a grant to your pipeline first — then come back here to draft and review your narrative."
      />
    );
  }

  return (
    <ShellEditor
      applications={applications}
      grantMap={grantMap}
      funderNames={funderNames}
      draftMap={draftMap}
    />
  );
}

// ---------------------------------------------------------------------------
// Editor: all React hooks live here, no early returns before them
// ---------------------------------------------------------------------------

function ShellEditor({ applications, grantMap, funderNames, draftMap }: Props) {
  const [selectedId, setSelectedId] = useState<string>(applications[0].id);
  const [drafts, setDrafts] = useState<Record<string, ApplicationDraft>>(draftMap);
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedApp = applications.find((a) => a.id === selectedId) ?? applications[0];
  const currentDraft = drafts[selectedApp.id];
  const sections: DraftSections = currentDraft?.sections ?? {};
  const review: DraftReview | null = currentDraft?.review ?? null;
  const grant = grantMap[selectedApp.grant_id];
  const funderName = grant ? (funderNames[grant.funder_id] ?? "Unknown funder") : "Unknown funder";
  const hasSections = Object.values(sections).some((v) => v && v.trim().length > 0);
  const isLocked = generating || reviewing;

  const updateSection = useCallback(
    (appId: string, orgId: string, key: keyof DraftSections, value: string) => {
      setDrafts((prev) => {
        const existing = prev[appId];
        const updated: ApplicationDraft = {
          ...(existing ?? {
            application_id: appId,
            org_id: orgId,
            review: null,
            updated_at: new Date().toISOString(),
          }),
          sections: {
            ...(existing?.sections ?? {}),
            [key]: value,
          },
        };
        return { ...prev, [appId]: updated };
      });

      // Debounced auto-save (1.5s after last keystroke)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setDrafts((prev) => {
          const latestDraft = prev[appId];
          const latestSections: DraftSections = {
            ...(latestDraft?.sections ?? {}),
            [key]: value,
          };
          void saveDraftSections(appId, latestSections).then((result) => {
            if (!result.ok) {
              toast.error(result.error ?? "Auto-save failed");
            }
          });
          return prev;
        });
      }, 1500);
    },
    [],
  );

  const handleGenerate = async () => {
    // Cancel any pending autosave so a stale debounced write can't land after
    // (and overwrite) the freshly generated draft.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setGenerating(true);
    toast.loading("Generating draft…", { id: "generate" });
    const result = await generateDraft(selectedApp.id);
    setGenerating(false);
    toast.dismiss("generate");
    if (result.ok) {
      setDrafts((prev) => ({
        ...prev,
        [selectedApp.id]: {
          application_id: selectedApp.id,
          org_id: selectedApp.org_id,
          sections: result.data,
          review: prev[selectedApp.id]?.review ?? null,
          updated_at: new Date().toISOString(),
        },
      }));
      toast.success("Draft generated — review and edit below.");
    } else {
      toast.error(result.error ?? "Generation failed");
    }
  };

  const handleSave = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    const result = await saveDraftSections(selectedApp.id, sections);
    setSaving(false);
    if (result.ok) {
      toast.success("Draft saved.");
    } else {
      toast.error(result.error ?? "Save failed");
    }
  };

  const handleReview = async () => {
    setReviewing(true);
    toast.loading("Reviewing draft as funder…", { id: "review" });
    const result = await reviewDraft(selectedApp.id);
    setReviewing(false);
    toast.dismiss("review");
    if (result.ok) {
      setDrafts((prev) => ({
        ...prev,
        [selectedApp.id]: {
          ...(prev[selectedApp.id] ?? {
            application_id: selectedApp.id,
            org_id: selectedApp.org_id,
            sections: {},
            updated_at: new Date().toISOString(),
          }),
          review: result.data,
        },
      }));
      toast.success("Review complete.");
    } else {
      toast.error(result.error ?? "Review failed");
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Application picker */}
      <div className="space-y-1.5">
        <label
          htmlFor="app-picker"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
        >
          Application
        </label>
        <select
          id="app-picker"
          value={selectedApp.id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={isLocked}
        >
          {applications.map((app) => {
            const g = grantMap[app.grant_id];
            const fn = g ? (funderNames[g.funder_id] ?? "Unknown") : "Unknown";
            return (
              <option key={app.id} value={app.id}>
                {g?.name ?? "Unknown grant"} — {fn}
              </option>
            );
          })}
        </select>
        <p className="text-xs text-muted-foreground">
          {funderName}
          {grant?.deadline ? ` · deadline ${grant.deadline}` : ""}
        </p>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={isLocked}
          onClick={handleGenerate}
          className="bg-gm-purple700 text-white hover:bg-gm-purple700/90"
        >
          {generating ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating…
            </span>
          ) : (
            "✨ Generate draft"
          )}
        </Button>
        {hasSections && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isLocked || saving}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "💾 Save edits"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isLocked}
              onClick={handleReview}
              className="border-gm-purple100 text-gm-purple700 hover:bg-gm-purple50"
            >
              {reviewing ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gm-purple700 border-t-transparent" />
                  Reviewing…
                </span>
              ) : (
                "🔍 Funder's-eye review"
              )}
            </Button>
          </>
        )}
      </div>

      {/* Section editors */}
      {generating ? (
        <div className="space-y-4">
          {DRAFT_SECTION_KEYS.map((key) => (
            <div key={key} className="space-y-1.5">
              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
              <Skeleton className="h-28 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {DRAFT_SECTION_KEYS.map((key) => (
            <div key={key} className="space-y-1.5">
              <label
                htmlFor={`section-${key}`}
                className="text-xs font-semibold"
              >
                {SECTION_LABELS[key]}
              </label>
              <Textarea
                id={`section-${key}`}
                rows={6}
                disabled={isLocked}
                placeholder={
                  hasSections
                    ? "(empty)"
                    : `Click "✨ Generate draft" to auto-fill all sections, or type here to start from scratch.`
                }
                value={sections[key] ?? ""}
                onChange={(e) =>
                  updateSection(selectedApp.id, selectedApp.org_id, key, e.target.value)
                }
                className="resize-y"
              />
            </div>
          ))}
        </div>
      )}

      {/* Funder review panel */}
      {review && (
        <Card className="animate-fade-in border-2 border-gm-purple100 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gm-purple700">
            🔍 Funder&rsquo;s-eye review
          </h3>
          <p className="text-sm text-muted-foreground">{review.summary}</p>
          {review.suggestions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Suggestions
              </h4>
              {review.suggestions.map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gm-purple100 bg-gm-purple50/40 p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gm-purple700">
                      {SECTION_LABELS[s.section as keyof DraftSections] ?? s.section}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Issue: </span>
                    {s.issue}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Fix: </span>
                    {s.fix}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
