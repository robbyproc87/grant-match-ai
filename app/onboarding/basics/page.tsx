"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { BasicsSchema, saveBasics } from "../actions";
import { toast } from "sonner";

const FormSchema = BasicsSchema.extend({
  geographies_csv: z.string().min(2, "Add at least one geography."),
}).omit({ geographies: true });

type FormValues = z.infer<typeof FormSchema>;

export default function BasicsPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      org_name: "",
      ein: "",
      org_type: "nonprofit",
      has_501c3: true,
      years_operating: 0,
      annual_budget: 0,
      geographies_csv: "",
    },
  });

  async function onSubmit(v: FormValues) {
    setPending(true);
    try {
      const geographies = v.geographies_csv
        .split(",")
        .map((g) => g.trim().toUpperCase())
        .filter(Boolean);
      const res = await saveBasics({
        org_name: v.org_name,
        ein: v.ein,
        org_type: v.org_type,
        has_501c3: v.has_501c3,
        years_operating: v.years_operating,
        annual_budget: v.annual_budget,
        geographies,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push("/onboarding/mission");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <OnboardingProgress step={1} />
        <CardTitle>The basics</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org_name">Organization name</Label>
            <Input id="org_name" {...register("org_name")} />
            {errors.org_name && (
              <p className="text-xs text-destructive">{errors.org_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ein">EIN (optional)</Label>
              <Input id="ein" placeholder="XX-XXXXXXX" {...register("ein")} />
              {errors.ein && (
                <p className="text-xs text-destructive">{errors.ein.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="org_type">Org type</Label>
              <select
                id="org_type"
                {...register("org_type")}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="nonprofit">Nonprofit</option>
                <option value="school">School</option>
                <option value="government">Government</option>
                <option value="tribal">Tribal</option>
              </select>
            </div>
          </div>
          <Controller
            control={control}
            name="has_501c3"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(Boolean(c))}
                />
                We have an active 501(c)(3) determination
              </label>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="years_operating">Years operating</Label>
              <Input
                id="years_operating"
                type="number"
                min={0}
                {...register("years_operating")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual_budget">Annual budget ($)</Label>
              <Input
                id="annual_budget"
                type="number"
                min={0}
                step={1000}
                {...register("annual_budget")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="geographies_csv">Geographies (state codes, comma-separated)</Label>
            <Input
              id="geographies_csv"
              placeholder="AZ, NV, CA — or 'NATIONAL'"
              {...register("geographies_csv")}
            />
            {errors.geographies_csv && (
              <p className="text-xs text-destructive">{errors.geographies_csv.message}</p>
            )}
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Next →"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
