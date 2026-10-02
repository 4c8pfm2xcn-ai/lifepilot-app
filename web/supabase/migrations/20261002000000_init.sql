-- DAYZERO initial schema
-- Every user-owned table carries user_id and is protected by row-level
-- security: a user can only ever read or write rows where user_id = auth.uid().

create extension if not exists pgcrypto;

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── profiles ───────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  email       text,
  timezone    text not null default 'UTC' check (char_length(timezone) <= 64),
  preferences jsonb not null default '{}'::jsonb,
  onboarded   boolean not null default false,
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── goals ──────────────────────────────────────────────────────────────────

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  category    text not null default 'personal' check (category in ('personal','school','work','business','health','other')),
  target_date date,
  status      text not null default 'active' check (status in ('active','completed','archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index goals_user_idx on public.goals (user_id, status);
create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

create table public.goal_milestones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  goal_id    uuid not null,
  title      text not null check (char_length(title) between 1 and 200),
  completed  boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  -- composite FK guarantees a milestone can only attach to the owner's goal
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);
create index goal_milestones_goal_idx on public.goal_milestones (goal_id, position);
create index goal_milestones_user_idx on public.goal_milestones (user_id);

-- ─── inbox_items ────────────────────────────────────────────────────────────

create table public.inbox_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  original_content  text not null default '' check (char_length(original_content) <= 20000),
  content_type      text not null default 'text' check (content_type in ('text','image','voice','note','paste')),
  attachment_url    text,
  extracted_data    jsonb,
  processing_status text not null default 'pending' check (processing_status in ('pending','processing','needs_review','processed','failed')),
  resolution        text check (resolution in ('organized','note','dismissed')),
  error             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id)
);
create index inbox_items_user_created_idx on public.inbox_items (user_id, created_at desc);
create index inbox_items_status_idx on public.inbox_items (user_id, processing_status);
create trigger inbox_items_updated_at before update on public.inbox_items
  for each row execute function public.set_updated_at();

-- ─── tasks ──────────────────────────────────────────────────────────────────

create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 200),
  description       text check (char_length(description) <= 4000),
  category          text not null default 'other' check (category in ('personal','school','work','business','health','other')),
  priority          text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status            text not null default 'todo' check (status in ('todo','done')),
  due_at            timestamptz,
  due_all_day       boolean not null default false,
  estimated_minutes integer check (estimated_minutes between 1 and 1440),
  scheduled_start   timestamptz,
  scheduled_end     timestamptz,
  goal_id           uuid,
  subtasks          jsonb not null default '[]'::jsonb,
  source_inbox_id   uuid,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start),
  check (jsonb_typeof(subtasks) = 'array'),
  -- links may only point at the same user's goal / inbox item
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id),
  foreign key (source_inbox_id, user_id) references public.inbox_items (id, user_id) on delete set null (source_inbox_id)
);
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_at);
create index tasks_user_scheduled_idx on public.tasks (user_id, scheduled_start) where scheduled_start is not null;
create index tasks_user_completed_idx on public.tasks (user_id, completed_at) where completed_at is not null;
create index tasks_goal_idx on public.tasks (goal_id) where goal_id is not null;
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ─── events ─────────────────────────────────────────────────────────────────

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  location    text check (char_length(location) <= 300),
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  all_day     boolean not null default false,
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_at > start_at)
);
create index events_user_range_idx on public.events (user_id, start_at, end_at);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- ─── conversations & messages ───────────────────────────────────────────────

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'New conversation' check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index conversations_user_idx on public.conversations (user_id, updated_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null check (char_length(content) <= 20000),
  actions         jsonb not null default '[]'::jsonb,
  source          text check (source in ('ai','offline')),
  created_at      timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.conversations (id, user_id) on delete cascade
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_user_idx on public.messages (user_id);

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.goals           enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.inbox_items     enable row level security;
alter table public.tasks           enable row level security;
alter table public.events          enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;

create policy "profiles: owner can read"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner can insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: owner can update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['goals','goal_milestones','inbox_items','tasks','events','conversations','messages'] loop
    execute format('create policy "%1$s: owner can read"   on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner can insert" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner can update" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner can delete" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- anon gets nothing
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
