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

create policy "Users can view all profiles"
  on profiles for select using (true);

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

alter table events add column image_url text;

-- Add foreign key for attendees
alter table event_signups
add constraint event_signups_user_fkey
foreign key (user_id) references profiles(id) on delete cascade;

-- Hangouts
create table hangouts (
  id uuid default gen_random_uuid() primary key,
  created_by uuid references profiles(id) on delete cascade not null,
  title text not null,
  location_name text not null,
  hangout_time timestamp with time zone not null,
  vibes text[] default '{}',
  vibe text not null,
  details text,
  expires_at timestamp with time zone not null,
  latitude double precision not null,
  longitude double precision not null,
  max_participants int default 5,
  participant_count int default 1,
  created_at timestamp with time zone default now()
);

create table hangout_participants (
  id uuid default gen_random_uuid() primary key,
  hangout_id uuid references hangouts on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  joined_at timestamp with time zone default now(),
  unique(hangout_id, user_id)
);

alter table hangouts enable row level security;
alter table hangout_participants enable row level security;

create policy "Anyone can view active hangouts"
  on hangouts for select using (true);

create policy "Users can create hangouts"
  on hangouts for insert with check (auth.uid() = created_by);

create policy "Creators can update own hangouts"
  on hangouts for update using (auth.uid() = created_by);

create policy "Anyone can view participants"
  on hangout_participants for select using (true);

create policy "Users can join hangouts"
  on hangout_participants for insert with check (auth.uid() = user_id);

create policy "Users can leave hangouts"
  on hangout_participants for delete using (auth.uid() = user_id);

create policy "Users can delete own hangouts"
  on hangouts for delete using (auth.uid() = created_by);

-- Keep participant_count in sync with hangout_participants
create or replace function sync_hangout_participant_count()
returns trigger as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.hangout_id, old.hangout_id);
  update hangouts
  set participant_count = (
    select count(*)::int from hangout_participants where hangout_id = target_id
  )
  where id = target_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists hangout_participants_count on hangout_participants;
create trigger hangout_participants_count
after insert or delete on hangout_participants
for each row execute function sync_hangout_participant_count();
  
