"use client";

import { useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { formatDeadline } from "@/lib/utils";
import type { Application, Grant } from "@/lib/types/db";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  updateApplicationStatus,
  removeFromPipeline,
  setApplicationChecklist,
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

type Props = {
  applications: Application[];
  grantMap: Record<string, Grant>;
  funderNames: Record<string, string>;
};

export function PipelineClient({ applications, grantMap, funderNames }: Props) {
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

  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    if (newStatus === app.status) return;
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
