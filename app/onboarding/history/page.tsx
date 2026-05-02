"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { saveHistoryAndFinish, searchFundersForTypeahead } from "../actions";
import { toast } from "sonner";

type Row = {
  funder_id: string | null;
  funder_name: string;
  amount: number | null;
  year: number | null;
};

export default function HistoryPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [rows, setRows] = useState<Row[]>([
    { funder_id: null, funder_name: "", amount: null, year: null },
  ]);
  const [suggestions, setSuggestions] = useState<
    Record<number, Array<{ id: string; name: string }>>
  >({});

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    setRows((rs) => [
      ...rs,
      { funder_id: null, funder_name: "", amount: null, year: null },
    ]);
  }
  function remove(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function onName(i: number, value: string) {
    update(i, { funder_name: value, funder_id: null });
    const matches = await searchFundersForTypeahead(value);
    setSuggestions((s) => ({ ...s, [i]: matches }));
  }
  function pick(i: number, m: { id: string; name: string }) {
    update(i, { funder_name: m.name, funder_id: m.id });
    setSuggestions((s) => ({ ...s, [i]: [] }));
  }

  async function finish() {
    setPending(true);
    try {
      const cleaned = rows
        .filter((r) => r.funder_name.trim().length > 0)
        .map((r) => ({
          funder_id: r.funder_id,
          funder_name: r.funder_name.trim(),
          amount: r.amount,
          year: r.year,
        }));
      const res = await saveHistoryAndFinish({ past_grants: cleaned });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Workspace ready! Computing match scores in background…");
      router.push("/dashboard/grants");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <OnboardingProgress step={3} />
        <CardTitle>Past grants (optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          List any prior grants — boosts &ldquo;prior relationship&rdquo; scoring. Skip if
          none.
        </p>
        {rows.map((r, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="relative space-y-1">
              <Label>Funder</Label>
              <Input
                value={r.funder_name}
                onChange={(e) => onName(i, e.target.value)}
                placeholder="Start typing…"
              />
              {suggestions[i] && suggestions[i].length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover shadow-md">
                  {suggestions[i].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pick(i, m)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  value={r.amount ?? ""}
                  onChange={(e) =>
                    update(i, {
                      amount: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={r.year ?? ""}
                  onChange={(e) =>
                    update(i, {
                      year: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(i)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" onClick={add} className="w-full">
          + Add another
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/mission")}
            className="flex-1"
          >
            ← Back
          </Button>
          <Button type="button" onClick={finish} disabled={pending} className="flex-1">
            {pending ? "Finishing…" : "Finish setup"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
