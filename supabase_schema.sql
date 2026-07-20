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

--Profiles
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists public_profile boolean default true;
alter table profiles add column if not exists only_friends_message boolean default false;

create policy "Users can upload own avatar"
  on storage.objects for insert with check (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view avatars"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "Users can update own avatar"
  on storage.objects for update using (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

alter table profiles add column if not exists avatar_url text;

-- Friendships
create table if not exists friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(requester_id, addressee_id),
  check (requester_id != addressee_id)
);

create index if not exists friendships_requester_idx on friendships(requester_id);
create index if not exists friendships_addressee_idx on friendships(addressee_id);
create index if not exists friendships_status_idx on friendships(status);

alter table friendships enable row level security;

create policy "Users can view own friendships"
  on friendships for select
  using (auth.uid() in (requester_id, addressee_id));

create policy "Users can send friend requests"
  on friendships for insert
  with check (auth.uid() = requester_id and status = 'pending');

create policy "Addressees can respond to requests"
  on friendships for update
  using (auth.uid() = addressee_id);

create policy "Users can remove own friendships"
  on friendships for delete
  using (auth.uid() in (requester_id, addressee_id));

create or replace function are_friends(user_a uuid, user_b uuid)
returns boolean as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
    and (
      (requester_id = user_a and addressee_id = user_b)
      or (requester_id = user_b and addressee_id = user_a)
    )
  );
$$ language sql security definer stable;

-- Conversations (1:1)
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  participant_one uuid references profiles(id) on delete cascade not null,
  participant_two uuid references profiles(id) on delete cascade not null,
  last_message_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  unique(participant_one, participant_two),
  check (participant_one < participant_two)
);

create index if not exists conversations_participants_idx
  on conversations(participant_one, participant_two);
create index if not exists conversations_last_message_idx
  on conversations(last_message_at desc);

alter table conversations enable row level security;

create policy "Users can view own conversations"
  on conversations for select
  using (auth.uid() in (participant_one, participant_two));

create policy "Friends can create conversations"
  on conversations for insert
  with check (
    auth.uid() in (participant_one, participant_two)
    and can_user_message(
      auth.uid(),
      case when auth.uid() = participant_one then participant_two else participant_one end
    )
  );

create policy "Users can delete own conversations"
  on conversations for delete
  using (auth.uid() in (participant_one, participant_two));

create or replace function can_user_message(sender uuid, recipient uuid)
returns boolean as $$
declare
  recipient_only_friends boolean;
begin
  if sender is null or recipient is null or sender = recipient then
    return false;
  end if;

  if are_friends(sender, recipient) then
    return true;
  end if;

  select coalesce(only_friends_message, false) into recipient_only_friends
  from profiles where id = recipient;

  return not recipient_only_friends;
end;
$$ language plpgsql security definer stable;

create or replace function get_or_create_conversation(user_a uuid, user_b uuid, initiator_id uuid default null)
returns uuid as $$
declare
  p1 uuid;
  p2 uuid;
  conv_id uuid;
  initiator uuid;
  other_user uuid;
begin
  if user_a is null or user_b is null or user_a = user_b then
    raise exception 'Invalid conversation participants';
  end if;

  initiator := coalesce(initiator_id, user_a);
  if initiator not in (user_a, user_b) then
    raise exception 'Initiator must be a conversation participant';
  end if;

  if user_a < user_b then
    p1 := user_a;
    p2 := user_b;
  else
    p1 := user_b;
    p2 := user_a;
  end if;

  other_user := case when initiator = p1 then p2 else p1 end;

  if not can_user_message(initiator, other_user) then
    raise exception 'You cannot message this user';
  end if;

  select id into conv_id
  from conversations
  where participant_one = p1 and participant_two = p2;

  if conv_id is null then
    insert into conversations (participant_one, participant_two)
    values (p1, p2)
    returning id into conv_id;
  end if;

  return conv_id;
end;
$$ language plpgsql security definer;

-- Messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamp with time zone default now()
);

create index if not exists messages_conversation_idx
  on messages(conversation_id, created_at desc);

alter table messages enable row level security;

create or replace function can_send_message(sender uuid, conv_id uuid)
returns boolean as $$
declare
  other_user uuid;
  recipient_only_friends boolean;
begin
  select case
    when c.participant_one = sender then c.participant_two
    else c.participant_one
  end into other_user
  from conversations c
  where c.id = conv_id;

  if other_user is null then
    return false;
  end if;

  if not (sender in (
    select participant_one from conversations where id = conv_id
    union
    select participant_two from conversations where id = conv_id
  )) then
    return false;
  end if;

  select coalesce(only_friends_message, false) into recipient_only_friends
  from profiles where id = other_user;

  if recipient_only_friends then
    return are_friends(sender, other_user);
  end if;

  return true;
end;
$$ language plpgsql security definer stable;

create policy "Users can view messages in own conversations"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and auth.uid() in (c.participant_one, c.participant_two)
    )
  );

create policy "Users can send messages to friends"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and can_send_message(sender_id, conversation_id)
  );

create or replace function update_conversation_last_message()
returns trigger as $$
begin
  update conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists messages_update_conversation on messages;
create trigger messages_update_conversation
after insert on messages
for each row execute function update_conversation_last_message();

-- Realtime
alter publication supabase_realtime add table friendships;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;

drop function if exists public.get_or_create_conversation(uuid, uuid);
drop function if exists public.get_or_create_conversation(uuid, uuid, uuid);

create or replace function can_user_message(sender uuid, recipient uuid)
returns boolean as $$
declare
  recipient_only_friends boolean;
begin
  if sender is null or recipient is null or sender = recipient then
    return false;
  end if;

  if are_friends(sender, recipient) then
    return true;
  end if;

  select coalesce(only_friends_message, false) into recipient_only_friends
  from profiles where id = recipient;

  return not recipient_only_friends;
end;
$$ language plpgsql security definer stable;

create or replace function can_send_message(sender uuid, conv_id uuid)
returns boolean as $$
declare
  other_user uuid;
  recipient_only_friends boolean;
begin
  select case
    when c.participant_one = sender then c.participant_two
    else c.participant_one
  end into other_user
  from conversations c
  where c.id = conv_id;

  if other_user is null then
    return false;
  end if;

  if not (sender in (
    select participant_one from conversations where id = conv_id
    union
    select participant_two from conversations where id = conv_id
  )) then
    return false;
  end if;

  select coalesce(only_friends_message, false) into recipient_only_friends
  from profiles where id = other_user;

  if recipient_only_friends then
    return are_friends(sender, other_user);
  end if;

  return true;
end;
$$ language plpgsql security definer stable;

drop policy if exists "Friends can create conversations" on conversations;
create policy "Friends can create conversations"
  on conversations for insert
  with check (
    auth.uid() in (participant_one, participant_two)
    and can_user_message(
      auth.uid(),
      case when auth.uid() = participant_one then participant_two else participant_one end
    )
  );


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
