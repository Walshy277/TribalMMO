-- Admin RLS policies
-- Run this in Supabase SQL Editor after 001_initial_schema.sql

-- Helper function to check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from auth.users
    where id = auth.uid()
    and email = 'walshyy2277@gmail.com'
  );
end;
$$ language plpgsql security definer stable;

-- Admin can read everything
create policy "Admin can view all profiles" on public.profiles
  for select using (public.is_admin());

create policy "Admin can view all characters" on public.characters
  for select using (public.is_admin());

create policy "Admin can update all characters" on public.characters
  for update using (public.is_admin());

create policy "Admin can delete characters" on public.characters
  for delete using (public.is_admin());

create policy "Admin can view all skills" on public.skills
  for select using (public.is_admin());

create policy "Admin can update all skills" on public.skills
  for update using (public.is_admin());

create policy "Admin can insert skills" on public.skills
  for insert with check (public.is_admin());

create policy "Admin can delete skills" on public.skills
  for delete using (public.is_admin());

create policy "Admin can manage items" on public.items
  for all using (public.is_admin());

create policy "Admin can view all inventory" on public.inventory
  for select using (public.is_admin());

create policy "Admin can manage all inventory" on public.inventory
  for all using (public.is_admin());

create policy "Admin can manage clans" on public.clans
  for all using (public.is_admin());

create policy "Admin can view all clan members" on public.clan_members
  for select using (public.is_admin());

create policy "Admin can manage clan members" on public.clan_members
  for all using (public.is_admin());

create policy "Admin can view all actions" on public.actions
  for select using (public.is_admin());

create policy "Admin can manage actions" on public.actions
  for all using (public.is_admin());

create policy "Admin can view all listings" on public.marketplace_listings
  for select using (public.is_admin());

create policy "Admin can manage listings" on public.marketplace_listings
  for all using (public.is_admin());

create policy "Admin can view all pets" on public.pets
  for select using (public.is_admin());

create policy "Admin can manage all pets" on public.pets
  for all using (public.is_admin());
