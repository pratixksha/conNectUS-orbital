
-- Event reminders feature
alter table events add column end_date timestamptz;
update events set end_date = date + interval '1 hour' where end_date is null;

alter table profiles add column expo_push_token text;

create table reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  remind_at timestamptz not null,
  sent boolean default false,
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

create index idx_reminders_pending on reminders (remind_at) where sent = false;

alter table reminders enable row level security;

create policy "Users manage their own reminders"
  on reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
