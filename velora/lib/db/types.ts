/**
 * Database types matching supabase/migrations. Keep in sync with the SQL, or
 * regenerate with: npx supabase gen types typescript --linked > lib/db/types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type GenerationStatusDb = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type GenerationModeDb = "text_to_video" | "image_to_video";
export type CreditTransactionTypeDb = "signup_grant" | "generation_charge" | "generation_refund" | "adjustment";

export type ProfileRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

export type GenerationRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  provider: string;
  model: string;
  mode: GenerationModeDb;
  prompt: string;
  enhanced_prompt: string | null;
  final_prompt: string;
  style: string | null;
  camera_movement: string | null;
  input_image_url: string | null;
  output_video_url: string | null;
  thumbnail_url: string | null;
  duration: number;
  aspect_ratio: string;
  status: GenerationStatusDb;
  progress: number | null;
  provider_task_id: string | null;
  error_message: string | null;
  credits_charged: number;
  idempotency_key: string;
  sync_lease_until: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type FavoriteRow = {
  id: string;
  user_id: string;
  generation_id: string;
  created_at: string;
}

export type CreditsRow = {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
}

export type CreditTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  type: CreditTransactionTypeDb;
  generation_id: string | null;
  description: string | null;
  created_at: string;
}

export type RateLimitRow = {
  key: string;
  window_start: string;
  count: number;
}

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "user_id">;
      projects: Table<ProjectRow, "user_id" | "name">;
      generations: Table<
        GenerationRow,
        | "user_id"
        | "provider"
        | "model"
        | "mode"
        | "prompt"
        | "final_prompt"
        | "duration"
        | "aspect_ratio"
        | "idempotency_key"
      >;
      favorites: Table<FavoriteRow, "user_id" | "generation_id">;
      credits: Table<CreditsRow, "user_id">;
      credit_transactions: Table<CreditTransactionRow, "user_id" | "amount" | "type">;
      rate_limits: Table<RateLimitRow, "key" | "window_start">;
    };
    Views: { [_ in never]: never };
    Functions: {
      grant_signup_credits: {
        Args: { p_user_id: string; p_amount: number };
        Returns: number;
      };
      create_generation_with_charge: {
        Args: {
          p_user_id: string;
          p_idempotency_key: string;
          p_cost: number;
          p_provider: string;
          p_model: string;
          p_mode: GenerationModeDb;
          p_prompt: string;
          p_enhanced_prompt: string | null;
          p_final_prompt: string;
          p_style: string | null;
          p_camera_movement: string | null;
          p_input_image_url: string | null;
          p_thumbnail_url: string | null;
          p_duration: number;
          p_aspect_ratio: string;
          p_project_id: string | null;
        };
        Returns: { generation_id: string; created: boolean; balance: number }[];
      };
      refund_generation: {
        Args: { p_generation_id: string; p_reason: string };
        Returns: boolean;
      };
      claim_generation_sync: {
        Args: { p_generation_id: string; p_lease_seconds: number };
        Returns: GenerationRow[];
      };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: {
      generation_status: GenerationStatusDb;
      generation_mode: GenerationModeDb;
      credit_transaction_type: CreditTransactionTypeDb;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
