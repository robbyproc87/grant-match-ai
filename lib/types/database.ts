/**
 * Database type for Supabase clients.
 *
 * Phase 2 TODO: replace with `supabase gen types typescript` output once the
 * schema is stable. For now we list each table with permissive (but typed)
 * Row/Insert/Update so call sites compile without per-call casts and we still
 * keep the typed-client wrapper happy.
 */
type AnyTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
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
  programs: AnyTable;
  applications: AnyTable;
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
