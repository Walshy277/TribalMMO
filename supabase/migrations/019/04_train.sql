-- 4. train (new activities: sparring, conditioning, sprinting, vitality, foraging, study, chopping_drill, mining_practice)
DROP FUNCTION IF EXISTS public.train(uuid, text);

CREATE OR REPLACE FUNCTION public.train(p_character_id UUID, p_activity TEXT)
RETURNS JSONB AS $$
DECLARE
  v_char RECORD;
  v_skill_name TEXT;
  v_xp INT;
  v_xp_max INT;
  v_new_level INT;
  v_stamina_cost INT;
  v_item_name TEXT := NULL;
  v_item_qty INT := 0;
  v_gold_reward INT;
  v_activities JSONB := '{
    "sparring": "Combat",
    "conditioning": "Combat",
    "sprinting": "Combat",
    "vitality": "Combat",
    "foraging": "Gathering",
    "study": "Crafting",
    "chopping_drill": "Woodcutting",
    "mining_practice": "Mining"
  }'::jsonb;
BEGIN
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  v_skill_name := v_activities->>p_activity;
  IF v_skill_name IS NULL THEN RAISE EXCEPTION 'Unknown activity: %', p_activity; END IF;

  SELECT COALESCE(level, 1) INTO v_new_level FROM public.skills WHERE character_id = p_character_id AND name = v_skill_name;
  v_stamina_cost := 8 + GREATEST(0, (v_new_level - 1) * 2) + CASE WHEN p_activity IN ('sparring', 'sprinting') THEN 2 ELSE 0 END;

  IF v_char.stamina < v_stamina_cost THEN RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost; END IF;

  UPDATE public.characters SET stamina = stamina - v_stamina_cost, stamina_updated_at = now() WHERE id = p_character_id;

  SELECT experience INTO v_xp FROM public.skills WHERE character_id = p_character_id AND name = v_skill_name;
  v_xp := v_xp + 5 + (random() * 10)::int;
  v_xp_max := v_new_level * 100;
  IF v_xp >= v_xp_max AND v_new_level < 100 THEN
    v_new_level := v_new_level + 1;
  END IF;
  UPDATE public.skills SET experience = v_xp, level = v_new_level WHERE character_id = p_character_id AND name = v_skill_name;

  v_gold_reward := 2 + (random() * 6)::int;
  UPDATE public.characters SET gold = gold + v_gold_reward WHERE id = p_character_id;

  IF random() < 0.15 THEN
    v_item_name := CASE p_activity
      WHEN 'sparring' THEN 'Bone Fragment'
      WHEN 'conditioning' THEN 'Stamina Potion'
      WHEN 'sprinting' THEN 'Stamina Potion'
      WHEN 'vitality' THEN 'Stamina Potion'
      WHEN 'foraging' THEN 'Herbs'
      WHEN 'study' THEN 'Parchment'
      WHEN 'chopping_drill' THEN 'Wood'
      WHEN 'mining_practice' THEN 'Stone'
      ELSE 'Wood'
    END;
    v_item_qty := 1 + (random() * 2)::int;
    PERFORM public.give_item(p_character_id, v_item_name, v_item_qty);
  END IF;

  UPDATE characters SET level = compute_player_level(p_character_id) WHERE id = p_character_id;

  RETURN jsonb_build_object(
    'skill', v_skill_name,
    'xp_gained', v_xp - (SELECT experience FROM public.skills WHERE character_id = p_character_id AND name = v_skill_name),
    'level', v_new_level,
    'item_name', v_item_name,
    'item_qty', v_item_qty,
    'gold_reward', v_gold_reward,
    'stamina_cost', v_stamina_cost,
    'message', 'Training complete'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
