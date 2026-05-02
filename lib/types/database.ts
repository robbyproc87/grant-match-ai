/**
 * Database type for Supabase clients.
 *
 * Phase 2 TODO: replace with `supabase gen types typescript` output.
 * For now we list each table with permissive Row/Insert/Update so call sites
 * compile without per-call casts.
 */
/* eslint-disable */
type AnyTable = {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
  Relationships: [];
};

type Tables = {
  orgs: AnyTable;
  org_members: AnyTable;
  org_profiles: AnyTable;
  funders: AnyTable;
  grants: AnyTable;
  match_scores: AnyTable;
  messages: AnyTable;
};

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
