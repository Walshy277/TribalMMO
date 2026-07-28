-- Migration 015: Auto-create player profile on signup
-- Removes the need for character creation flow — every user gets a profile automatically

-- ============================================================
-- FUNCTION: Auto-create character + default skills for new users
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_character_id UUID;
  username_val TEXT;
BEGIN
  -- Get username from raw_user_meta_data (set during signUp)
  username_val := COALESCE(NEW.raw_user_meta_data ->> 'username', 'Adventurer');

  -- Create the character row with default stats
  INSERT INTO public.characters (user_id, name, background, strength, agility, endurance, focus, cunning)
  VALUES (
    NEW.id,
    username_val,
    'Wanderer',
    1, 1, 1, 1, 1
  )
  RETURNING id INTO new_character_id;

  -- Create default skills at tier 1
  INSERT INTO public.skills (character_id, name, tier, experience)
  VALUES
    (new_character_id, 'Gathering', 1, 0),
    (new_character_id, 'Crafting', 1, 0),
    (new_character_id, 'Combat', 1, 0),
    (new_character_id, 'Survival', 1, 0),
    (new_character_id, 'Diplomacy', 1, 0),
    (new_character_id, 'Woodcutting', 1, 0),
    (new_character_id, 'Mining', 1, 0);

  -- Compute initial level from skills
  UPDATE public.characters
  SET level = compute_player_level(new_character_id)
  WHERE id = new_character_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: Fire on new auth user creation
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- BACKFILL: Create profiles for any existing users without characters
-- ============================================================
DO $$
DECLARE
  u RECORD;
  new_character_id UUID;
BEGIN
  FOR u IN
    SELECT au.id, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.characters c ON c.user_id = au.id
    WHERE c.id IS NULL
  LOOP
    INSERT INTO public.characters (user_id, name, background, strength, agility, endurance, focus, cunning)
    VALUES (
      u.id,
      COALESCE(u.raw_user_meta_data ->> 'username', 'Adventurer'),
      'Wanderer',
      1, 1, 1, 1, 1
    )
    RETURNING id INTO new_character_id;

    INSERT INTO public.skills (character_id, name, tier, experience)
    VALUES
      (new_character_id, 'Gathering', 1, 0),
      (new_character_id, 'Crafting', 1, 0),
      (new_character_id, 'Combat', 1, 0),
      (new_character_id, 'Survival', 1, 0),
      (new_character_id, 'Diplomacy', 1, 0),
      (new_character_id, 'Woodcutting', 1, 0),
      (new_character_id, 'Mining', 1, 0);

    UPDATE public.characters
    SET level = compute_player_level(new_character_id)
    WHERE id = new_character_id;
  END LOOP;
END $$;
