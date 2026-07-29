-- Migration 028: Add missing RLS SELECT policy for skills table
-- Regular users cannot SELECT their own skill rows, so the frontend
-- XP bar always shows 0% even though the RPC successfully grants XP.

create policy "Users can view own skills" on public.skills for select using (
  exists (select 1 from public.characters where id = character_id and user_id = auth.uid())
);
