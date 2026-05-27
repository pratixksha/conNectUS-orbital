create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  faculty text,
  year text,
  networking_goal text,
  interests text[] default '{}',
  created_at timestamp with time zone default now()
);

--Allow users to read/write only their own profile
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create table events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  location text,
  date timestamp with time zone,
  created_by uuid references auth.users on delete cascade,
  created_at timestamp with time zone default now()
);

create table event_signups (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events on delete cascade,
  user_id uuid references auth.users on delete cascade,
  signed_up_at timestamp with time zone default now(),
  unique(event_id, user_id)
);

alter table events enable row level security;
alter table event_signups enable row level security;

create policy "Anyone can view events" on events for select using (true);
create policy "Users can sign up for events" on event_signups for insert with check (auth.uid() = user_id);
create policy "Users can withdraw from events" on event_signups for delete using (auth.uid() = user_id);
create policy "Users can view signups" on event_signups for select using (true);