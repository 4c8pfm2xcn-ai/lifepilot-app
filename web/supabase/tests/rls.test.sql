-- Row-level security verification. Any failed assertion aborts with an error.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com', '{"full_name":"Ada"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com', '{"full_name":"Bo"}');

do $$ begin
  assert (select count(*) from public.profiles) = 2, 'signup trigger should create profiles';
  assert (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Ada', 'profile name from metadata';
end $$;

-- ── act as user A ──
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.goals (id, user_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A goal');
insert into public.tasks (user_id, title, goal_id) values ('11111111-1111-1111-1111-111111111111', 'A task', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.events (user_id, title, start_at, end_at) values ('11111111-1111-1111-1111-111111111111', 'A event', now(), now() + interval '1 hour');
insert into public.inbox_items (user_id, original_content) values ('11111111-1111-1111-1111-111111111111', 'secret capture');
insert into public.conversations (id, user_id) values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into public.messages (conversation_id, user_id, role, content) values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'user', 'hello');
insert into public.goal_milestones (user_id, goal_id, title) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'step');
insert into storage.objects (bucket_id, name) values ('captures', '11111111-1111-1111-1111-111111111111/a.png');

-- Column coverage: rows shaped exactly like the app's TypeScript records.
insert into public.inbox_items (id, user_id, original_content, content_type, attachment_url, extracted_data, processing_status, resolution, error, created_at, updated_at)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'x', 'image', 'storage:1111/a.png', '{"summary":"s","items":[],"source":"ai","processed_at":"2026-10-02T00:00:00Z"}', 'needs_review', null, null, now(), now());
insert into public.tasks (id, user_id, title, description, category, priority, status, due_at, due_all_day, estimated_minutes, scheduled_start, scheduled_end, goal_id, subtasks, source_inbox_id, completed_at, created_at, updated_at)
values ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Full task', 'd', 'school', 'urgent', 'done', now(), true, 30, now(), now() + interval '30 minutes', 'aaaaaaaa-0000-0000-0000-000000000001', '[{"id":"s1","title":"sub","done":false}]', 'dddddddd-0000-0000-0000-000000000001', now(), now(), now());
insert into public.events (id, user_id, title, description, location, start_at, end_at, all_day, timezone, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Full event', null, 'Room 1', now(), now() + interval '1 hour', false, 'America/New_York', now(), now());
insert into public.goal_milestones (id, user_id, goal_id, title, completed, position, created_at)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'm', true, 1, now());
insert into public.messages (id, conversation_id, user_id, role, content, actions, source, created_at)
values (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'assistant', 'r', '[{"id":"a","type":"complete_task","task_id":"t","summary":"s","destructive":false,"status":"proposed"}]', 'ai', now());
update public.profiles set full_name = 'Ada L', timezone = 'Europe/London', preferences = '{"theme":"light"}', onboarded = true, is_sample = false where id = '11111111-1111-1111-1111-111111111111';
delete from public.tasks where id = 'eeeeeeee-0000-0000-0000-000000000001';
delete from public.inbox_items where id = 'dddddddd-0000-0000-0000-000000000001';

do $$ begin
  assert (select count(*) from public.tasks) = 1, 'A sees own task';
  assert (select count(*) from public.profiles) = 1, 'A sees only own profile';
end $$;

-- A cannot insert rows owned by B
do $$ begin
  begin
    insert into public.tasks (user_id, title) values ('22222222-2222-2222-2222-222222222222', 'forged');
    raise exception 'FORGED INSERT SHOULD FAIL';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('captures', '22222222-2222-2222-2222-222222222222/x.png');
    raise exception 'FORGED STORAGE INSERT SHOULD FAIL';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── act as user B ──
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare n int;
begin
  assert (select count(*) from public.tasks) = 0, 'B must not see A tasks';
  assert (select count(*) from public.events) = 0, 'B must not see A events';
  assert (select count(*) from public.inbox_items) = 0, 'B must not see A inbox';
  assert (select count(*) from public.goals) = 0, 'B must not see A goals';
  assert (select count(*) from public.goal_milestones) = 0, 'B must not see A milestones';
  assert (select count(*) from public.conversations) = 0, 'B must not see A conversations';
  assert (select count(*) from public.messages) = 0, 'B must not see A messages';
  assert (select count(*) from storage.objects) = 0, 'B must not see A files';
  assert (select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 0, 'B must not see A profile';

  update public.tasks set title = 'hacked';
  get diagnostics n = row_count;
  assert n = 0, 'B must not update A tasks';
  delete from public.events;
  get diagnostics n = row_count;
  assert n = 0, 'B must not delete A events';
  update public.profiles set full_name = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'B must not update A profile';

  -- B cannot attach their own task to A's goal (composite FK)
  begin
    insert into public.tasks (user_id, title, goal_id) values ('22222222-2222-2222-2222-222222222222', 'sneaky', 'aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'CROSS-USER GOAL LINK SHOULD FAIL';
  exception when foreign_key_violation then null;
  end;
  -- B cannot post into A's conversation
  begin
    insert into public.messages (conversation_id, user_id, role, content) values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'user', 'x');
    raise exception 'CROSS-USER MESSAGE SHOULD FAIL';
  exception when foreign_key_violation then null;
  end;
end $$;

-- ── anonymous ──
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    perform count(*) from public.tasks;
    raise exception 'ANON SELECT SHOULD FAIL';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  assert (select title from public.tasks limit 1) = 'A task', 'A data intact';
  assert (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Ada L', 'A profile intact';
end $$;

-- cascade: deleting the auth user removes all their rows
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from public.tasks) = 0, 'cascade delete tasks';
  assert (select count(*) from public.messages) = 0, 'cascade delete messages';
end $$;
select 'RLS TESTS PASSED' as result;
