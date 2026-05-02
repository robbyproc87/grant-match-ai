"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { MissionSchema, saveMission } from "../actions";
import { toast } from "sonner";

const FormSchema = MissionSchema.extend({
  focus_areas_csv: z.string().min(2),
  populations_csv: z.string().min(2),
}).omit({ focus_areas: true, populations_served: true });

type FormValues = z.infer<typeof FormSchema>;

export default function MissionPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { mission: "", focus_areas_csv: "", populations_csv: "" },
  });

  async function onSubmit(v: FormValues) {
    setPending(true);
    try {
      const res = await saveMission({
        mission: v.mission,
        focus_areas: v.focus_areas_csv.split(",").map((s) => s.trim()).filter(Boolean),
        populations_served: v.populations_csv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push("/onboarding/history");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <OnboardingProgress step={2} />
        <CardTitle>Mission &amp; focus</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mission">Mission statement</Label>
            <Textarea id="mission" rows={4} {...register("mission")} />
            {errors.mission && (
              <p className="text-xs text-destructive">{errors.mission.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="focus_areas_csv">Focus areas (comma-separated)</Label>
            <Input
              id="focus_areas_csv"
              placeholder="Pediatric Health, Comfort Care, Family Support"
              {...register("focus_areas_csv")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="populations_csv">Populations served (comma-separated)</Label>
            <Input
              id="populations_csv"
              placeholder="Hospitalized children, Families, Underserved communities"
              {...register("populations_csv")}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/onboarding/basics")}
              className="flex-1"
            >
              ← Back
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Saving…" : "Next →"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
