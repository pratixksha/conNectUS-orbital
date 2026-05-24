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
