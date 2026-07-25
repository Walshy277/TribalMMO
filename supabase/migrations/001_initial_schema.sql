-- TribalMMO Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Characters table
create table public.characters (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  appearance jsonb default '{}'::jsonb,
  background text default '',
  strength int default 1 not null,
  agility int default 1 not null,
  endurance int default 1 not null,
  focus int default 1 not null,
  cunning int default 1 not null,
  stamina int default 100 not null,
  max_stamina int default 100 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Skills table
create table public.skills (
  id uuid default uuid_generate_v4() primary key,
  character_id uuid references public.characters(id) on delete cascade not null,
  name text not null,
  tier int default 1 not null,
  experience int default 0 not null,
  specialization text,
  unique(character_id, name)
);

-- Items table
create table public.items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null,
  tier int default 1 not null,
  stats jsonb default '{}'::jsonb,
  recipe_id uuid
);

-- Inventory table
create table public.inventory (
  id uuid default uuid_generate_v4() primary key,
  character_id uuid references public.characters(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete cascade not null,
  quantity int default 1 not null,
  equipped boolean default false not null,
  unique(character_id, item_id)
);

-- Factions table
create table public.factions (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  symbol text not null,
  philosophy text not null,
  founder_id uuid references public.characters(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Faction members table
create table public.faction_members (
  id uuid default uuid_generate_v4() primary key,
  faction_id uuid references public.factions(id) on delete cascade not null,
  character_id uuid references public.characters(id) on delete cascade not null,
  role text default 'member' not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(faction_id, character_id)
);

-- Settlements table
create table public.settlements (
  id uuid default uuid_generate_v4() primary key,
  faction_id uuid references public.factions(id) on delete cascade not null,
  name text not null,
  tier int default 1 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Buildings table
create table public.buildings (
  id uuid default uuid_generate_v4() primary key,
  settlement_id uuid references public.settlements(id) on delete cascade not null,
  name text not null,
  tier int default 1 not null,
  build_time int default 300 not null,
  built_at timestamp with time zone
);

-- Territories table
create table public.territories (
  id uuid default uuid_generate_v4() primary key,
  hex_x int not null,
  hex_y int not null,
  type text not null,
  faction_id uuid references public.factions(id) on delete set null,
  claimed_at timestamp with time zone,
  unique(hex_x, hex_y)
);

-- Actions table
create table public.actions (
  id uuid default uuid_generate_v4() primary key,
  character_id uuid references public.characters(id) on delete cascade not null,
  type text not null,
  duration int not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completes_at timestamp with time zone not null,
  result jsonb
);

-- Marketplace listings table
create table public.marketplace_listings (
  id uuid default uuid_generate_v4() primary key,
  seller_id uuid references public.characters(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete cascade not null,
  quantity int default 1 not null,
  price int not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Pets table
create table public.pets (
  id uuid default uuid_generate_v4() primary key,
  character_id uuid references public.characters(id) on delete cascade not null,
  type text not null,
  name text not null
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.skills enable row level security;
alter table public.items enable row level security;
alter table public.inventory enable row level security;
alter table public.factions enable row level security;
alter table public.faction_members enable row level security;
alter table public.settlements enable row level security;
alter table public.buildings enable row level security;
alter table public.territories enable row level security;
alter table public.actions enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.pets enable row level security;

-- RLS Policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users can view own characters" on public.characters for select using (auth.uid() = user_id);
create policy "Users can create characters" on public.characters for insert with check (auth.uid() = user_id);
create policy "Users can update own characters" on public.characters for update using (auth.uid() = user_id);

create policy "Anyone can view items" on public.items for select using (true);

create policy "Users can view own inventory" on public.inventory for select using (
  exists (select 1 from public.characters where id = character_id and user_id = auth.uid())
);
create policy "Users can manage own inventory" on public.inventory for all using (
  exists (select 1 from public.characters where id = character_id and user_id = auth.uid())
);

create policy "Anyone can view factions" on public.factions for select using (true);
create policy "Users can create factions" on public.factions for insert with check (
  exists (select 1 from public.characters where id = founder_id and user_id = auth.uid())
);

create policy "Anyone can view faction members" on public.faction_members for select using (true);

create policy "Anyone can view settlements" on public.settlements for select using (true);

create policy "Anyone can view buildings" on public.buildings for select using (true);

create policy "Anyone can view territories" on public.territories for select using (true);

create policy "Users can view own actions" on public.actions for select using (
  exists (select 1 from public.characters where id = character_id and user_id = auth.uid())
);
create policy "Users can create actions" on public.actions for insert with check (
  exists (select 1 from public.characters where id = character_id and user_id = auth.uid())
);

create policy "Anyone can view marketplace" on public.marketplace_listings for select using (true);
create policy "Users can create listings" on public.marketplace_listings for insert with check (
  exists (select 1 from public.characters where id = seller_id and user_id = auth.uid())
);

create policy "Users can view own pets" on public.pets for select using (
  exists (select 1 from public.characters where id = character_id and user_id = auth.uid())
);
create policy "Users can manage own pets" on public.pets for all using (
  exists (select 1 from public.characters where id = character_id and user_id = auth.uid())
);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
