-- Migration 005: Rename factions→clans, remove settlements/buildings/territories
-- Run this in Supabase SQL Editor after 004_economy_system.sql

-- Rename tables
ALTER TABLE IF EXISTS public.factions RENAME TO clans;
ALTER TABLE IF EXISTS public.faction_members RENAME TO clan_members;

-- Rename column in clan_members
ALTER TABLE IF EXISTS public.clan_members RENAME COLUMN faction_id TO clan_id;

-- Drop territories table
DROP TABLE IF EXISTS public.territories CASCADE;

-- Drop settlements table
DROP TABLE IF EXISTS public.settlements CASCADE;

-- Drop buildings table
DROP TABLE IF EXISTS public.buildings CASCADE;

-- Drop old RLS policies that reference old table/column names
-- (These may already exist from prior migrations)

-- Re-create RLS policies for renamed tables
-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can view factions" ON public.clans;
DROP POLICY IF EXISTS "Users can create factions" ON public.clans;
DROP POLICY IF EXISTS "Users can delete own factions" ON public.clans;
DROP POLICY IF EXISTS "Anyone can view faction members" ON public.clan_members;
DROP POLICY IF EXISTS "Users can join factions" ON public.clan_members;
DROP POLICY IF EXISTS "Chieftains can manage faction members" ON public.clan_members;
DROP POLICY IF EXISTS "Chieftains can remove faction members" ON public.clan_members;

-- Create new policies for clans
CREATE POLICY "Anyone can view clans" ON public.clans FOR SELECT USING (true);
CREATE POLICY "Users can create clans" ON public.clans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.characters WHERE id = founder_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own clans" ON public.clans FOR DELETE USING (
  founder_id IN (SELECT id FROM public.characters WHERE user_id = auth.uid())
);

-- Create new policies for clan_members
CREATE POLICY "Anyone can view clan members" ON public.clan_members FOR SELECT USING (true);
CREATE POLICY "Users can join clans" ON public.clan_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Chieftains can manage clan members" ON public.clan_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.clan_members cm
    WHERE cm.clan_id = clan_members.clan_id
    AND cm.character_id = clan_members.character_id
    AND cm.role = 'chieftain'
  )
);
CREATE POLICY "Chieftains can remove clan members" ON public.clan_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.clan_members cm
    WHERE cm.clan_id = clan_members.clan_id
    AND cm.role = 'chieftain'
  )
);

-- Marketplace purchase function (bypasses RLS for seller payment)
create or replace function public.purchase_listing(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_price int
)
returns void as $$
declare
  p_tax int;
  p_payout int;
begin
  p_tax := ceil(p_price * 0.05);
  p_payout := p_price - p_tax;
  update public.characters set coins = coins - p_price where id = p_buyer_id;
  update public.characters set coins = coins + p_payout where id = p_seller_id;
  delete from public.marketplace_listings where id = p_listing_id;
end;
$$ language plpgsql security definer;

-- Auction bid refund (bypasses RLS for refunding previous bidder)
create or replace function public.refund_bidder(
  p_bidder_id uuid,
  p_amount int
)
returns void as $$
begin
  update public.characters set coins = coins + p_amount where id = p_bidder_id;
end;
$$ language plpgsql security definer;

-- Auction payout (bypasses RLS for seller payment)
create or replace function public.auction_payout(
  p_seller_id uuid,
  p_total_bid int
)
returns void as $$
declare
  p_tax int;
  p_payout int;
begin
  p_tax := ceil(p_total_bid * 0.05);
  p_payout := p_total_bid - p_tax;
  update public.characters set coins = coins + p_payout where id = p_seller_id;
end;
$$ language plpgsql security definer;

-- Shrine blessing function
create or replace function public.shrine_bless(
  p_character_id uuid
)
returns text as $$
declare
  blessings text[] := ARRAY['strength', 'agility', 'endurance', 'focus', 'cunning'];
  chosen_stat text;
  result_text text;
begin
  chosen_stat := blessings[1 + floor(random() * array_length(blessings, 1))::int];
  execute format('UPDATE public.characters SET %I = %I + 1 WHERE id = $1', chosen_stat, chosen_stat) using p_character_id;
  result_text := 'The spirits grant you +1 ' || chosen_stat || '!';
  return result_text;
end;
$$ language plpgsql security definer;
