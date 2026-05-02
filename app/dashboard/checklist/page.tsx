"use client";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

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

export default function ChecklistPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const total = useMemo(
    () => CHECKLIST.reduce((a, s) => a + s.items.length, 0),
    [],
  );
  const done = Object.values(checked).filter(Boolean).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="animate-fade-in space-y-3">
      <Card className="bg-primary p-4 text-center text-primary-foreground">
        <div className="text-2xl font-bold">
          {done}/{total}
        </div>
        <div className="mb-2 text-sm opacity-90">items complete</div>
        <Progress value={pct} />
      </Card>
      {CHECKLIST.map((section) => (
        <Card key={section.section} className="p-5">
          <h3 className="mb-3 text-sm font-semibold">{section.section}</h3>
          <div className="space-y-2">
            {section.items.map((item) => {
              const key = `${section.section}-${item}`;
              const isChecked = !!checked[key];
              return (
                <label key={key} className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(c) =>
                      setChecked((s) => ({ ...s, [key]: Boolean(c) }))
                    }
                    className="mt-0.5"
                  />
                  <span
                    className={
                      isChecked
                        ? "text-sm text-muted-foreground line-through"
                        : "text-sm"
                    }
                  >
                    {item}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
