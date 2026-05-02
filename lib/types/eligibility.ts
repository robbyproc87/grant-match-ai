import { z } from "zod";

export const GrantEligibilitySchema = z.object({
  requires_501c3: z.boolean(),
  min_org_years: z.number().int().min(0).optional(),
  min_org_budget: z.number().nonnegative().optional(),
  max_org_budget: z.number().nonnegative().optional(),
  allowed_org_types: z
    .array(z.enum(["nonprofit", "school", "government", "tribal"]))
    .optional(),
  allowed_geographies: z.array(z.string()).optional(),
  excluded_geographies: z.array(z.string()).optional(),
  custom_rules: z.array(z.string()).optional(),
});

export type GrantEligibility = z.infer<typeof GrantEligibilitySchema>;
