-- 3. handle_new_user (creates character + 5 skills for new signups)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_character_id UUID;
  username_val TEXT;
BEGIN
  username_val := COALESCE(NEW.raw_user_meta_data ->> 'username', 'Adventurer');

  INSERT INTO public.characters (user_id, name, background, strength, defence, speed, vitality)
  VALUES (NEW.id, username_val, 'Wanderer', 1, 1, 1, 1)
  RETURNING id INTO new_character_id;

  INSERT INTO public.skills (character_id, name, level, experience)
  VALUES
    (new_character_id, 'Gathering', 1, 0),
    (new_character_id, 'Crafting', 1, 0),
    (new_character_id, 'Combat', 1, 0),
    (new_character_id, 'Woodcutting', 1, 0),
    (new_character_id, 'Mining', 1, 0);

  UPDATE public.characters
  SET level = compute_player_level(new_character_id)
  WHERE id = new_character_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
