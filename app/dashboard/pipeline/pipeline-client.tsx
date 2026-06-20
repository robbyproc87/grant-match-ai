"use client";

import { useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { formatDeadline } from "@/lib/utils";
import type { Application, Grant, MatchScore } from "@/lib/types/db";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  updateApplicationStatus,
  removeFromPipeline,
  setApplicationChecklist,
  recordOutcome,
} from "./actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Identical to the constant in checklist/page.tsx — keep in sync if changed.
const CHECKLIST = [
  {
    section: "Before You Write",
    items: [
      "Read funder guidelines end-to-end",
      "Confirm eligibility (geography, org type, mission)",
      "Note all word/page limits",
      "Set deadline reminder (work backward 5 days)",
    ],
  },
  {
    section: "Required Documents",
    items: [
      "IRS 501(c)(3) determination letter",
      "Most recent 990 or audited financials",
      "Current year organizational budget",
      "Grant-specific project budget",
      "Board of Directors list with affiliations",
      "Letters of support from hospital partners",
      "W-9",
    ],
  },
  {
    section: "Narrative Quality",
    items: [
      "Statement of need includes at least one data point",
      "Goals are specific and measurable",
      "Budget narrative matches the numbers exactly",
      "Sustainability section included",
      "Spell-check complete — funder name spelled correctly",
    ],
  },
  {
    section: "Submission",
    items: [
      "All files named per funder convention",
      "PDF vs. Word format confirmed",
      "Portal login tested",
      "Submitted 48 hrs early (portals crash)",
      "Confirmation email saved to grants folder",
    ],
  },
];

const TOTAL_CHECKLIST_ITEMS = CHECKLIST.reduce((a, s) => a + s.items.length, 0);

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  identified: "Identified",
  drafting: "Drafting",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
  declined: "Declined",
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  identified: "bg-gm-purple50 text-gm-purple700",
  drafting: "bg-blue-50 text-blue-700",
  submitted: "bg-yellow-50 text-yellow-700",
  won: "bg-green-50 text-green-700",
  lost: "bg-red-50 text-red-700",
  declined: "bg-gray-100 text-gray-600",
};

const OUTCOME_STATUSES: ApplicationStatus[] = ["won", "lost", "declined"];

// Win-rate band boundaries (inclusive lower, inclusive upper)
type Band = { label: string; min: number; max: number };
const SCORE_BANDS: Band[] = [
  { label: "80–100", min: 80, max: 100 },
  { label: "60–79", min: 60, max: 79 },
  { label: "40–59", min: 40, max: 59 },
  { label: "<40", min: 0, max: 39 },
];

type Props = {
  applications: Application[];
  grantMap: Record<string, Grant>;
  funderNames: Record<string, string>;
  matchScores: MatchScore[];
};

export function PipelineClient({ applications, grantMap, funderNames, matchScores }: Props) {
  const [apps, setApps] = useState<Application[]>(applications);

  if (apps.length === 0) {
    return (
      <EmptyState
        title="Pipeline is empty"
        description='Browse Grants and click "Save to pipeline" on any opportunity to track it here.'
        icon="🗂"
      />
    );
  }

  const grouped = APPLICATION_STATUSES.reduce<Record<ApplicationStatus, Application[]>>(
    (acc, status) => {
      acc[status] = apps.filter((a) => a.status === status);
      return acc;
    },
    {} as Record<ApplicationStatus, Application[]>,
  );

  return (
    <div className="animate-fade-in space-y-6">
      <p className="px-1 text-xs text-muted-foreground">
        {apps.length} application{apps.length !== 1 ? "s" : ""} tracked
      </p>

      <WinRateTable apps={apps} grantMap={grantMap} matchScores={matchScores} />

      {APPLICATION_STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          applications={grouped[status]}
          grantMap={grantMap}
          funderNames={funderNames}
          onStatusChange={(id, newStatus) => {
            setApps((prev) =>
              prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
            );
          }}
          onRemove={(id) => {
            setApps((prev) => prev.filter((a) => a.id !== id));
          }}
          onChecklistChange={(id, checklist) => {
            setApps((prev) =>
              prev.map((a) => (a.id === id ? { ...a, checklist } : a)),
            );
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Win-rate readout (WS4)
// ---------------------------------------------------------------------------

function WinRateTable({
  apps,
  grantMap,
  matchScores,
}: {
  apps: Application[];
  grantMap: Record<string, Grant>;
  matchScores: MatchScore[];
}) {
  // Build score lookup: grant_id → score_total
  const scoreByGrant = new Map<string, number | null>(
    matchScores.map((s) => [s.grant_id, s.score_total]),
  );

  // Only decided apps count toward win-rate stats
  const decided = apps.filter((a) => OUTCOME_STATUSES.includes(a.status));
  if (decided.length === 0) return null;

  // Bucket into bands
  type BandStats = { applied: number; won: number };
  const bandStats = new Map<string, BandStats>(
    SCORE_BANDS.map((b) => [b.label, { applied: 0, won: 0 }]),
  );

  for (const app of decided) {
    const score = scoreByGrant.get(app.grant_id) ?? null;
    if (score === null) continue;
    const band = SCORE_BANDS.find((b) => score >= b.min && score <= b.max);
    if (!band) continue;
    const stats = bandStats.get(band.label)!;
    stats.applied += 1;
    if (app.status === "won") stats.won += 1;
  }

  // Filter to bands that have at least one decided app
  const rows = SCORE_BANDS.filter((b) => (bandStats.get(b.label)?.applied ?? 0) > 0);
  if (rows.length === 0) return null;

  return (
    <Card className="border border-gm-purple100 bg-gm-purple50/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gm-purple700">
          Win rate by fit-score band
        </h3>
        <span className="text-xs text-muted-foreground italic">
          Early data — low sample size
        </span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gm-purple100 text-left text-muted-foreground">
            <th className="pb-1.5 font-medium">Score band</th>
            <th className="pb-1.5 font-medium text-right">Applied</th>
            <th className="pb-1.5 font-medium text-right">Won</th>
            <th className="pb-1.5 font-medium text-right">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((band) => {
            const stats = bandStats.get(band.label)!;
            const rate =
              stats.applied > 0
                ? Math.round((stats.won / stats.applied) * 100)
                : 0;
            return (
              <tr
                key={band.label}
                className="border-b border-gm-purple100/40 last:border-0"
              >
                <td className="py-1.5 font-mono">{band.label}</td>
                <td className="py-1.5 text-right tabular-nums">{stats.applied}</td>
                <td className="py-1.5 text-right tabular-nums">{stats.won}</td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-gm-purple700">
                  {rate}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Kanban column
// ---------------------------------------------------------------------------

function KanbanColumn({
  status,
  applications,
  grantMap,
  funderNames,
  onStatusChange,
  onRemove,
  onChecklistChange,
}: {
  status: ApplicationStatus;
  applications: Application[];
  grantMap: Record<string, Grant>;
  funderNames: Record<string, string>;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onRemove: (id: string) => void;
  onChecklistChange: (id: string, checklist: Record<string, boolean>) => void;
}) {
  return (
    <section aria-label={`${STATUS_LABELS[status]} column`}>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="text-xs text-muted-foreground">
          {applications.length}
        </span>
      </div>
      {applications.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          No applications
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const grant = grantMap[app.grant_id];
            return (
              <ApplicationCard
                key={app.id}
                app={app}
                grant={grant}
                funderName={grant ? (funderNames[grant.funder_id] ?? "Unknown funder") : "Unknown funder"}
                onStatusChange={onStatusChange}
                onRemove={onRemove}
                onChecklistChange={onChecklistChange}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Application card
// ---------------------------------------------------------------------------

function ApplicationCard({
  app,
  grant,
  funderName,
  onStatusChange,
  onRemove,
  onChecklistChange,
}: {
  app: Application;
  grant: Grant | undefined;
  funderName: string;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onRemove: (id: string) => void;
  onChecklistChange: (id: string, checklist: Record<string, boolean>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState<"won" | "lost" | "declined" | null>(null);

  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    if (newStatus === app.status) return;

    // For terminal outcome statuses, show the outcome dialog
    if (OUTCOME_STATUSES.includes(newStatus)) {
      setShowOutcomeDialog(newStatus as "won" | "lost" | "declined");
      return;
    }

    setChangingStatus(true);
    // Optimistic
    onStatusChange(app.id, newStatus);
    const result = await updateApplicationStatus(app.id, newStatus);
    setChangingStatus(false);
    if (result.ok) {
      toast.success(`Moved to ${STATUS_LABELS[newStatus]}`);
    } else {
      // Revert
      onStatusChange(app.id, app.status);
      toast.error(result.error ?? "Failed to update status");
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    // Optimistic
    onRemove(app.id);
    const result = await removeFromPipeline(app.id);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to remove");
    } else {
      toast.success("Removed from pipeline");
    }
    setRemoving(false);
  };

  return (
    <Card className="border-2 border-transparent p-4 transition-all hover:border-gm-purple100">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {grant?.name ?? "Unknown grant"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{funderName}</div>
          {(app.deadline ?? grant?.deadline) && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              📅 {formatDeadline(app.deadline ?? grant?.deadline)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={changingStatus}
                aria-label={`Change status, currently ${STATUS_LABELS[app.status]}`}
                className="h-7 px-2 text-xs"
              >
                <span
                  className={`mr-1.5 inline-block h-2 w-2 rounded-full ${STATUS_COLORS[app.status].split(" ")[0]}`}
                />
                {STATUS_LABELS[app.status]} ▾
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {APPLICATION_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onSelect={() => handleStatusChange(s)}
                  className={s === app.status ? "font-semibold" : ""}
                  aria-current={s === app.status ? "true" : undefined}
                >
                  {STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Remove */}
          <Button
            variant="ghost"
            size="sm"
            disabled={removing}
            onClick={handleRemove}
            aria-label="Remove from pipeline"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            Remove
          </Button>
        </div>
      </div>

      {/* Outcome dialog (inline) */}
      {showOutcomeDialog && (
        <OutcomeDialog
          status={showOutcomeDialog}
          onConfirm={async (amount) => {
            setShowOutcomeDialog(null);
            setChangingStatus(true);
            // Optimistic
            onStatusChange(app.id, showOutcomeDialog);
            const result = await recordOutcome(app.id, showOutcomeDialog, amount);
            setChangingStatus(false);
            if (result.ok) {
              toast.success(`Outcome recorded: ${STATUS_LABELS[showOutcomeDialog]}`);
            } else {
              onStatusChange(app.id, app.status);
              toast.error(result.error ?? "Failed to record outcome");
            }
          }}
          onCancel={() => setShowOutcomeDialog(null)}
        />
      )}

      {/* Checklist toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={expanded}
        aria-label="Toggle application checklist"
      >
        <ChecklistSummary checklist={app.checklist} />
        <span className="ml-auto">{expanded ? "▲ Hide checklist" : "▼ Show checklist"}</span>
      </button>

      {expanded && (
        <ChecklistPanel
          applicationId={app.id}
          checklist={app.checklist}
          onChange={(next) => onChecklistChange(app.id, next)}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Outcome dialog (inline card)
// ---------------------------------------------------------------------------

function OutcomeDialog({
  status,
  onConfirm,
  onCancel,
}: {
  status: "won" | "lost" | "declined";
  onConfirm: (amount?: number | null) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    const parsed = amount.trim() ? Number(amount.trim()) : null;
    onConfirm(status === "won" ? parsed : null);
  };

  return (
    <div className="mb-3 rounded-lg border border-gm-purple100 bg-gm-purple50/40 p-3 space-y-2">
      <p className="text-xs font-semibold text-gm-purple700">
        Record outcome: {status === "won" ? "Won 🎉" : status === "lost" ? "Lost" : "Declined"}
      </p>
      {status === "won" && (
        <div className="space-y-1">
          <label htmlFor="outcome-amount" className="text-xs text-muted-foreground">
            Award amount (optional)
          </label>
          <Input
            id="outcome-amount"
            type="number"
            min={0}
            placeholder="e.g. 25000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={submitting}
          onClick={handleConfirm}
          className="h-7 text-xs bg-gm-purple700 text-white hover:bg-gm-purple700/90"
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist helpers (unchanged from original)
// ---------------------------------------------------------------------------

function ChecklistSummary({ checklist }: { checklist: Record<string, boolean> }) {
  const done = Object.values(checklist).filter(Boolean).length;
  const pct = TOTAL_CHECKLIST_ITEMS > 0
    ? Math.round((done / TOTAL_CHECKLIST_ITEMS) * 100)
    : 0;
  return (
    <div className="flex flex-1 items-center gap-2">
      <Progress value={pct} className="h-1.5 flex-1" />
      <span className="shrink-0 tabular-nums">
        {done}/{TOTAL_CHECKLIST_ITEMS}
      </span>
    </div>
  );
}

function ChecklistPanel({
  applicationId,
  checklist,
  onChange,
}: {
  applicationId: string;
  checklist: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  // Debounce persist: clear any in-flight timer before setting a new one
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle = useCallback(
    (key: string, value: boolean) => {
      const next = { ...checklist, [key]: value };
      onChange(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const result = await setApplicationChecklist(applicationId, next);
        if (!result.ok) {
          toast.error(result.error ?? "Failed to save checklist");
        }
      }, 500);
    },
    [applicationId, checklist, onChange],
  );

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {CHECKLIST.map((section) => (
        <div key={section.section}>
          <h4 className="mb-1.5 text-xs font-semibold">{section.section}</h4>
          <div className="space-y-1.5">
            {section.items.map((item) => {
              const key = `${section.section}-${item}`;
              const isChecked = !!checklist[key];
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-2 text-xs"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(c) => handleToggle(key, Boolean(c))}
                    className="mt-0.5"
                  />
                  <span
                    className={
                      isChecked ? "text-muted-foreground line-through" : ""
                    }
                  >
                    {item}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
