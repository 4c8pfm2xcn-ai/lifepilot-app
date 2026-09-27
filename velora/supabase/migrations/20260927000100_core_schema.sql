-- Velora core schema: profiles, projects, generations, favorites, credits ledger.
-- All user-owned tables carry user_id and are protected by RLS (see 0002).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.generation_status as enum (
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

create type public.generation_mode as enum ('text_to_video', 'image_to_video');

create type public.credit_transaction_type as enum (
  'signup_grant',
  'generation_charge',
  'generation_refund',
  'adjustment'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  -- Storage object path inside the private `thumbnails` bucket (never a public URL).
  cover_url text check (cover_url is null or char_length(cover_url) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Enables composite FKs that guarantee cross-table ownership consistency.
  unique (id, user_id)
);

create index projects_user_created_idx on public.projects (user_id, created_at desc);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- generations
-- ---------------------------------------------------------------------------
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid,
  provider text not null check (char_length(provider) between 1 and 40),
  model text not null check (char_length(model) between 1 and 80),
  mode public.generation_mode not null,
  -- The user's original prompt.
  prompt text not null check (char_length(prompt) between 1 and 2000),
  -- LLM-enhanced prompt, if enhancement was used.
  enhanced_prompt text check (enhanced_prompt is null or char_length(enhanced_prompt) <= 4000),
  -- The exact text sent to the provider (base prompt + style/camera instructions).
  final_prompt text not null check (char_length(final_prompt) between 1 and 4000),
  style text check (style is null or char_length(style) <= 120),
  camera_movement text check (camera_movement is null or char_length(camera_movement) <= 40),
  -- Storage object paths (private buckets). Signed URLs are created server-side on demand.
  input_image_url text check (input_image_url is null or char_length(input_image_url) <= 300),
  output_video_url text check (output_video_url is null or char_length(output_video_url) <= 300),
  thumbnail_url text check (thumbnail_url is null or char_length(thumbnail_url) <= 300),
  duration integer not null check (duration between 1 and 60),
  aspect_ratio text not null check (char_length(aspect_ratio) between 3 and 20),
  status public.generation_status not null default 'queued',
  progress real check (progress is null or (progress >= 0 and progress <= 1)),
  provider_task_id text check (provider_task_id is null or char_length(provider_task_id) <= 200),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  credits_charged integer not null default 0 check (credits_charged >= 0),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  -- Lease used to make provider status sync single-flight across instances.
  sync_lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, user_id),
  unique (user_id, idempotency_key),
  unique (provider, provider_task_id),
  -- A generation can only belong to a project owned by the same user.
  constraint generations_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on delete set null (project_id)
);

create index generations_user_created_idx on public.generations (user_id, created_at desc);
create index generations_user_status_idx on public.generations (user_id, status, created_at desc);
create index generations_project_idx on public.generations (project_id, created_at desc) where project_id is not null;
create index generations_active_idx on public.generations (status, created_at)
  where status in ('queued', 'processing');

create trigger generations_set_updated_at
before update on public.generations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, generation_id),
  -- Users can only favorite their own generations.
  constraint favorites_generation_owner_fk
    foreign key (generation_id, user_id)
    references public.generations (id, user_id)
    on delete cascade
);

create index favorites_user_created_idx on public.favorites (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- credits (balance) + credit_transactions (append-only ledger)
-- ---------------------------------------------------------------------------
create table public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create trigger credits_set_updated_at
before update on public.credits
for each row execute function public.set_updated_at();

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),
  type public.credit_transaction_type not null,
  generation_id uuid references public.generations (id) on delete set null,
  description text check (description is null or char_length(description) <= 300),
  created_at timestamptz not null default now(),
  constraint credit_tx_sign check (
    (type = 'generation_charge' and amount < 0)
    or (type in ('generation_refund', 'signup_grant') and amount > 0)
    or type = 'adjustment'
  )
);

create index credit_transactions_user_created_idx on public.credit_transactions (user_id, created_at desc);

-- Ledger idempotency: at most one charge and one refund per generation, one signup grant per user.
create unique index credit_tx_one_charge_per_generation
  on public.credit_transactions (generation_id) where type = 'generation_charge';
create unique index credit_tx_one_refund_per_generation
  on public.credit_transactions (generation_id) where type = 'generation_refund';
create unique index credit_tx_one_signup_grant
  on public.credit_transactions (user_id) where type = 'signup_grant';

-- ---------------------------------------------------------------------------
-- rate_limits (fixed-window counters; service role only)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);
