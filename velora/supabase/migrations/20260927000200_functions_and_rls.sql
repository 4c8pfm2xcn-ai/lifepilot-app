-- Velora: Row Level Security, column privileges, and transactional credit functions.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.generations enable row level security;
alter table public.favorites enable row level security;
alter table public.credits enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.rate_limits enable row level security;

-- Anonymous users get nothing.
revoke all on public.profiles, public.projects, public.generations, public.favorites,
  public.credits, public.credit_transactions, public.rate_limits from anon;

-- Authenticated users: explicit, minimal grants (RLS narrows rows further).
revoke all on public.profiles, public.projects, public.generations, public.favorites,
  public.credits, public.credit_transactions, public.rate_limits from authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

grant select, delete on public.projects to authenticated;
grant insert (name, description, cover_url, user_id) on public.projects to authenticated;
grant update (name, description, cover_url) on public.projects to authenticated;

-- Generations are created/updated by the server (service role) through functions below.
-- Users may read, delete, and move a generation between their own projects.
grant select, delete on public.generations to authenticated;
grant update (project_id) on public.generations to authenticated;

grant select, delete on public.favorites to authenticated;
grant insert (generation_id, user_id) on public.favorites to authenticated;

grant select on public.credits to authenticated;
grant select on public.credit_transactions to authenticated;
-- rate_limits: no grants to authenticated.

-- Policies ------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy projects_select_own on public.projects
  for select to authenticated using (user_id = (select auth.uid()));
create policy projects_insert_own on public.projects
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy projects_update_own on public.projects
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy projects_delete_own on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

create policy generations_select_own on public.generations
  for select to authenticated using (user_id = (select auth.uid()));
create policy generations_update_own on public.generations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy generations_delete_own on public.generations
  for delete to authenticated using (user_id = (select auth.uid()));

create policy favorites_select_own on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_insert_own on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy favorites_delete_own on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

create policy credits_select_own on public.credits
  for select to authenticated using (user_id = (select auth.uid()));

create policy credit_transactions_select_own on public.credit_transactions
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile + zero-balance credit account.
-- Signup credits are granted by the app via grant_signup_credits() so the
-- amount stays configurable (VELORA_SIGNUP_CREDITS) without a migration.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_name is not null then
    v_name := left(v_name, 80);
  end if;

  insert into public.profiles (user_id, display_name)
  values (new.id, v_name)
  on conflict (user_id) do nothing;

  insert into public.credits (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- grant_signup_credits: idempotent one-time grant. Returns the current balance.
-- ---------------------------------------------------------------------------
create or replace function public.grant_signup_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted uuid;
  v_balance integer;
begin
  insert into public.credits (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  -- Serialize with any concurrent charge/refund for this user.
  select balance into v_balance from public.credits where user_id = p_user_id for update;

  if p_amount > 0 then
    insert into public.credit_transactions (user_id, amount, type, description)
    values (p_user_id, p_amount, 'signup_grant', 'Welcome credits')
    on conflict do nothing
    returning id into v_inserted;

    if v_inserted is not null then
      update public.credits set balance = balance + p_amount
      where user_id = p_user_id
      returning balance into v_balance;
    end if;
  end if;

  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_generation_with_charge
-- Atomically: idempotency check -> balance check -> insert generation -> debit
-- -> ledger entry. Replays with the same idempotency key return the existing
-- generation without charging again.
-- Raises SQLSTATE 'VL402' when the balance is insufficient.
-- ---------------------------------------------------------------------------
create or replace function public.create_generation_with_charge(
  p_user_id uuid,
  p_idempotency_key text,
  p_cost integer,
  p_provider text,
  p_model text,
  p_mode public.generation_mode,
  p_prompt text,
  p_enhanced_prompt text,
  p_final_prompt text,
  p_style text,
  p_camera_movement text,
  p_input_image_url text,
  p_thumbnail_url text,
  p_duration integer,
  p_aspect_ratio text,
  p_project_id uuid
)
returns table (generation_id uuid, created boolean, balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_existing uuid;
  v_generation_id uuid;
begin
  if p_cost is null or p_cost < 0 then
    raise exception 'invalid cost' using errcode = '22023';
  end if;

  insert into public.credits (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  -- Lock the user's credit row: serializes concurrent generate requests per user.
  select c.balance into v_balance from public.credits c where c.user_id = p_user_id for update;

  select g.id into v_existing
  from public.generations g
  where g.user_id = p_user_id and g.idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return query select v_existing, false, v_balance;
    return;
  end if;

  if v_balance < p_cost then
    raise exception 'insufficient credits' using errcode = 'VL402';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects p where p.id = p_project_id and p.user_id = p_user_id
  ) then
    raise exception 'project not found' using errcode = 'VL404';
  end if;

  insert into public.generations (
    user_id, project_id, provider, model, mode, prompt, enhanced_prompt, final_prompt,
    style, camera_movement, input_image_url, thumbnail_url, duration, aspect_ratio,
    status, credits_charged, idempotency_key
  ) values (
    p_user_id, p_project_id, p_provider, p_model, p_mode, p_prompt, p_enhanced_prompt, p_final_prompt,
    p_style, p_camera_movement, p_input_image_url, p_thumbnail_url, p_duration, p_aspect_ratio,
    'queued', p_cost, p_idempotency_key
  )
  returning id into v_generation_id;

  if p_cost > 0 then
    update public.credits c set balance = c.balance - p_cost
    where c.user_id = p_user_id
    returning c.balance into v_balance;

    insert into public.credit_transactions (user_id, amount, type, generation_id, description)
    values (p_user_id, -p_cost, 'generation_charge', v_generation_id,
            left(format('Video generation (%s / %s, %ss)', p_provider, p_model, p_duration), 300));
  end if;

  return query select v_generation_id, true, v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- refund_generation: idempotent. Returns true only when a refund was issued.
-- ---------------------------------------------------------------------------
create or replace function public.refund_generation(p_generation_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_charged integer;
  v_inserted uuid;
begin
  select g.user_id, g.credits_charged into v_user_id, v_charged
  from public.generations g where g.id = p_generation_id;

  if v_user_id is null or v_charged is null or v_charged <= 0 then
    return false;
  end if;

  -- Only refund what was actually charged.
  if not exists (
    select 1 from public.credit_transactions t
    where t.generation_id = p_generation_id and t.type = 'generation_charge'
  ) then
    return false;
  end if;

  perform 1 from public.credits c where c.user_id = v_user_id for update;

  insert into public.credit_transactions (user_id, amount, type, generation_id, description)
  values (v_user_id, v_charged, 'generation_refund', p_generation_id,
          left(coalesce(p_reason, 'Generation refund'), 300))
  on conflict do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return false;
  end if;

  update public.credits c set balance = c.balance + v_charged where c.user_id = v_user_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_generation_sync: single-flight lease for provider status polling.
-- Returns the row only if this caller acquired the lease.
-- ---------------------------------------------------------------------------
create or replace function public.claim_generation_sync(p_generation_id uuid, p_lease_seconds integer)
returns setof public.generations
language sql
security definer
set search_path = ''
as $$
  update public.generations g
  set sync_lease_until = now() + make_interval(secs => greatest(p_lease_seconds, 1))
  where g.id = p_generation_id
    and g.status in ('queued', 'processing')
    and (g.sync_lease_until is null or g.sync_lease_until < now())
  returning g.*;
$$;

-- ---------------------------------------------------------------------------
-- check_rate_limit: fixed-window counter. Returns true when the call is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  -- Opportunistic cleanup of stale windows (cheap, indexed).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_count <= p_limit;
end;
$$;

-- Functions are callable only by the server (service role).
revoke all on function public.grant_signup_credits(uuid, integer) from public, anon, authenticated;
revoke all on function public.create_generation_with_charge(
  uuid, text, integer, text, text, public.generation_mode, text, text, text, text, text, text, text, integer, text, uuid
) from public, anon, authenticated;
revoke all on function public.refund_generation(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_generation_sync(uuid, integer) from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.grant_signup_credits(uuid, integer) to service_role;
grant execute on function public.create_generation_with_charge(
  uuid, text, integer, text, text, public.generation_mode, text, text, text, text, text, text, text, integer, text, uuid
) to service_role;
grant execute on function public.refund_generation(uuid, text) to service_role;
grant execute on function public.claim_generation_sync(uuid, integer) to service_role;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
