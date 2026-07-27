-- Migration 003: Coins, Auction House, Enhanced RLS
-- Run this in Supabase SQL Editor after 002_admin_rls.sql

-- Add coins column to characters
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS coins int default 50 not null;

-- Auction house table
create table public.auction_house (
  id uuid default uuid_generate_v4() primary key,
  seller_id uuid references public.characters(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete cascade not null,
  quantity int default 1 not null,
  starting_price int not null,
  current_bid int default 0 not null,
  current_bidder_id uuid references public.characters(id) on delete set null,
  ends_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  claimed boolean default false not null
);

alter table public.auction_house enable row level security;

-- Auction house RLS
create policy "Anyone can view auctions" on public.auction_house for select using (true);
create policy "Users can create auctions" on public.auction_house for insert with check (
  exists (select 1 from public.characters where id = seller_id and user_id = auth.uid())
);
create policy "Users can update auctions" on public.auction_house for update using (true);
create policy "Users can delete own auctions" on public.auction_house for delete using (
  exists (select 1 from public.characters where id = seller_id and user_id = auth.uid())
);

-- Admin RLS for auction house
create policy "Admin can manage auctions" on public.auction_house
  for all using (public.is_admin());

-- Additional RLS: allow players to insert clan_members (join clan)
create policy "Users can join clans" on public.clan_members for insert with check (true);

-- Allow chieftains to update/delete clan members
create policy "Chieftains can manage clan members" on public.clan_members for update using (
  exists (
    select 1 from public.clan_members cm
    where cm.clan_id = clan_members.clan_id
    and cm.character_id = clan_members.character_id
    and cm.role = 'chieftain'
  )
);
create policy "Chieftains can remove clan members" on public.clan_members for delete using (
  exists (
    select 1 from public.clan_members cm
    where cm.clan_id = clan_members.clan_id
    and cm.role = 'chieftain'
  )
);

-- Allow players to delete own actions
create policy "Users can delete own actions" on public.actions for delete using (
  exists (select 1 from public.characters where id = character_id and user_id = auth.uid())
);

-- Allow players to delete own marketplace listings
create policy "Users can delete own listings" on public.marketplace_listings for delete using (
  exists (select 1 from public.characters where id = seller_id and user_id = auth.uid())
);

-- Allow players to delete their own clan
create policy "Users can delete own clans" on public.clans for delete using (
  founder_id IN (select id from public.characters where user_id = auth.uid())
);

-- Allow players to update skills (for tier advancement)
create policy "Users can update own skills" on public.skills for update using (
  exists (select 1 from public.characters where id = character_id and user_id = auth.uid())
);
