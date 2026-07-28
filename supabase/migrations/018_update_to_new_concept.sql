-- TribalMMO Migration 018: Update to new concept
-- Changes: 4 core stats (Strength, Defence, Speed, Vitality), clan description/banner

-- 0. Drop trigger that depends on endurance column, then update it for vitality
DROP TRIGGER IF EXISTS trigger_update_max_stamina ON public.characters;

-- 1. Add new stat columns to characters
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS defence int DEFAULT 1;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS speed int DEFAULT 1;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS vitality int DEFAULT 1;

-- 2. Migrate old stats to new stats (best-effort mapping)
-- agility -> speed, endurance -> vitality, focus -> removed, cunning -> removed
-- We keep strength as-is
UPDATE public.characters SET
  speed = GREATEST(agility, 1),
  vitality = GREATEST(endurance, 1),
  defence = GREATEST(FLOOR((focus + cunning) / 2), 1)
WHERE agility IS NOT NULL;

-- 3. Drop old stat columns
ALTER TABLE public.characters DROP COLUMN IF EXISTS agility;
ALTER TABLE public.characters DROP COLUMN IF EXISTS endurance;
ALTER TABLE public.characters DROP COLUMN IF EXISTS focus;
ALTER TABLE public.characters DROP COLUMN IF EXISTS cunning;

-- 4. Update the trigger function and recreate trigger using vitality
CREATE OR REPLACE FUNCTION update_max_stamina()
RETURNS TRIGGER AS $$
BEGIN
  NEW.max_stamina := 50 + (NEW.vitality * 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_max_stamina
  BEFORE INSERT OR UPDATE OF vitality ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION update_max_stamina();

-- 5. Add clan description and banner_url
ALTER TABLE public.clans ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.clans ADD COLUMN IF NOT EXISTS banner_url text;

-- 6. Update skill level cap note (skills table already supports level 0-100)
-- No schema change needed, just a note that max level is now 100

-- Note: Existing RPCs like train(), explore_step(), resolve_combat_win() etc.
-- will need to be updated to use the new stat columns. Run the relevant
-- Supabase RPC updates separately after this migration.
