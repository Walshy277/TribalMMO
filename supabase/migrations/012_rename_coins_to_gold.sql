-- Migration 012: Rename coins column to gold
-- Removes the concept of "coins", currency is now just "gold"

ALTER TABLE public.characters RENAME COLUMN coins TO gold;

-- Update default value
ALTER TABLE public.characters ALTER COLUMN gold SET DEFAULT 50;

-- Update RPCs that reference the old column name
CREATE OR REPLACE FUNCTION public.train(p_character_id UUID, p_activity TEXT)
RETURNS JSONB AS $$
DECLARE
  v_char RECORD;
  v_skill_name TEXT;
  v_xp INT;
  v_xp_max INT;
  v_new_xp INT;
  v_new_tier INT;
  v_stamina_cost INT;
  v_item_name TEXT := NULL;
  v_item_qty INT := 0;
  v_coin_reward INT;
  v_activities JSONB := '{
    "sparring": "Combat",
    "meditation": "Diplomacy",
    "conditioning": "Survival",
    "sprinting": "Survival",
    "foraging": "Gathering",
    "study": "Crafting"
  }'::jsonb;
BEGIN
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  v_skill_name := v_activities->>p_activity;
  IF v_skill_name IS NULL THEN RAISE EXCEPTION 'Unknown activity: %', p_activity; END IF;

  SELECT COALESCE(tier, 1) INTO v_new_tier FROM public.skills WHERE character_id = p_character_id AND name = v_skill_name;
  v_stamina_cost := 8 + GREATEST(0, (v_new_tier - 1) * 2) + CASE WHEN p_activity IN ('sparring', 'sprinting') THEN 2 ELSE 0 END;

  IF v_char.stamina < v_stamina_cost THEN RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost; END IF;

  UPDATE public.characters SET stamina = stamina - v_stamina_cost, stamina_updated_at = now() WHERE id = p_character_id;

  v_xp := 5 + (random() * 10)::int;
  SELECT experience, tier INTO v_xp, v_new_xp FROM public.skills WHERE character_id = p_character_id AND name = v_skill_name;
  v_xp := v_xp + 5 + (random() * 10)::int;
  v_xp_max := v_new_tier * 100;
  IF v_xp >= v_xp_max AND v_new_tier < 5 THEN
    v_new_tier := v_new_tier + 1;
  END IF;
  UPDATE public.skills SET experience = v_xp, tier = v_new_tier WHERE character_id = p_character_id AND name = v_skill_name;

  -- Coin (gold) reward
  v_coin_reward := 2 + (random() * 6)::int;
  UPDATE public.characters SET gold = gold + v_coin_reward WHERE id = p_character_id;

  -- Rare item find
  IF random() < 0.15 THEN
    v_item_name := CASE p_activity
      WHEN 'sparring' THEN 'Bone Fragment'
      WHEN 'meditation' THEN 'Ancient Scroll'
      WHEN 'conditioning' THEN 'Stamina Potion'
      WHEN 'sprinting' THEN 'Stamina Potion'
      WHEN 'foraging' THEN 'Herbs'
      WHEN 'study' THEN 'Parchment'
      ELSE 'Wood'
    END;
    v_item_qty := 1 + (random() * 2)::int;
    PERFORM public.give_item(p_character_id, v_item_name, v_item_qty);
  END IF;

  RETURN jsonb_build_object(
    'skill', v_skill_name,
    'xp_gained', v_xp,
    'tier', v_new_tier,
    'item_name', v_item_name,
    'item_qty', v_item_qty,
    'coin_reward', v_coin_reward,
    'stamina_cost', v_stamina_cost,
    'message', 'Training complete'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.claim_daily_reward(p_character_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_reward JSONB;
  v_coins_reward INT;
  v_bonus_item TEXT;
  v_bonus_qty INT;
  v_streak INT;
  v_day INT;
BEGIN
  v_reward := '[
    {"day":1,"coins":10},
    {"day":2,"coins":15},
    {"day":3,"coins":25},
    {"day":4,"coins":30,"bonus_item":"Herbs","bonus_qty":5},
    {"day":5,"coins":40,"bonus_item":"Hides","bonus_qty":3},
    {"day":6,"coins":60},
    {"day":7,"coins":100,"bonus_item":"Stamina Potion","bonus_qty":2}
  ]'::jsonb;

  SELECT COALESCE(streak, 0) INTO v_streak FROM public.daily_rewards WHERE character_id = p_character_id;
  v_day := (v_streak % 7) + 1;

  SELECT (value->>'coins')::int, value->>'bonus_item', (value->>'bonus_qty')::int
  INTO v_coins_reward, v_bonus_item, v_bonus_qty
  FROM jsonb_array_elements(v_reward) WHERE (value->>'day')::int = v_day;

  UPDATE public.characters SET gold = gold + v_coins_reward WHERE id = p_character_id;

  INSERT INTO public.daily_rewards (character_id, last_claimed_at, streak)
  VALUES (p_character_id, now(), v_streak + 1)
  ON CONFLICT (character_id) DO UPDATE SET last_claimed_at = now(), streak = v_streak + 1;

  RETURN jsonb_build_object(
    'day', v_day,
    'gold', v_coins_reward,
    'bonus_item', v_bonus_item,
    'bonus_qty', v_bonus_qty
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
