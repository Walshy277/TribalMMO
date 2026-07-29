-- Migration 022: Fix XP/levelling system and gathering mechanics
-- XP curve: level * 100 per level. Years of grinding to reach 100.
-- With stamina regen (1 per 3 min, ~20/h), players can do ~20-40 actions/h.
-- At that rate, level 100 in one skill takes ~2500+ hours of focused play.

-- ============================================================
-- 1. check_skill_xp with proper long-term XP curve
--    XP needed per level = current_level * 100
--    Level 1→2: 100 XP  (a few minutes)
--    Level 10→11: 1000 XP (~1-2 hours)
--    Level 50→51: 5000 XP (~6-10 hours)
--    Level 99→100: 9900 XP (~10-15 hours)
--    Cumulative to 100: ~505,000 XP (~2500+ hours of play)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_skill_xp(p_character_id uuid, p_skill_name text, p_xp_gained int)
RETURNS void AS $$
DECLARE
  v_skill RECORD;
  v_new_xp int;
  v_new_level int;
  v_max_xp int;
  v_levels_gained int;
BEGIN
  SELECT id, level, experience INTO v_skill
  FROM public.skills
  WHERE character_id = p_character_id AND name = p_skill_name;

  IF NOT FOUND THEN RETURN; END IF;

  v_new_xp := v_skill.experience + p_xp_gained;
  v_max_xp := v_skill.level * 100;

  IF v_new_xp >= v_max_xp AND v_skill.level < 100 THEN
    v_levels_gained := 0;
    WHILE v_new_xp >= (v_skill.level + v_levels_gained) * 100 AND (v_skill.level + v_levels_gained) < 100 LOOP
      v_levels_gained := v_levels_gained + 1;
    END LOOP;
    v_new_level := LEAST(v_skill.level + v_levels_gained, 100);
  ELSE
    v_new_level := v_skill.level;
  END IF;

  UPDATE public.skills
  SET experience = v_new_xp, level = v_new_level
  WHERE id = v_skill.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. FIXED: gather_resource
--    - Uses `level` not `tier` for skills
--    - Uses `rarity` not `tier` for items
--    - Calls compute_player_level after XP gain
--    - XP scales modestly with level: 2-5 base + level/10
--    - Stamina costs scale with level: 8 + (level-1)*2
-- ============================================================
CREATE OR REPLACE FUNCTION public.gather_resource(
  p_character_id uuid,
  p_action text
)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_skill_name text;
  v_skill_level int;
  v_stamina_cost int;
  v_xp_gain int;
  v_item_name text;
  v_item_qty int;
  v_item_id uuid;
  v_existing_inv RECORD;
  v_success boolean;
  v_fail_chance numeric;
  v_message text;
  v_result jsonb;

  v_wood_resources jsonb := '[
    {"name":"Wood","min_level":1,"weight":50},
    {"name":"Oak Log","min_level":1,"weight":30},
    {"name":"Willow Log","min_level":2,"weight":25},
    {"name":"Maple Log","min_level":3,"weight":15},
    {"name":"Yew Log","min_level":4,"weight":8}
  ]'::jsonb;

  v_mine_resources jsonb := '[
    {"name":"Stone","min_level":1,"weight":45},
    {"name":"Copper Ore","min_level":1,"weight":30},
    {"name":"Iron Ore","min_level":2,"weight":25},
    {"name":"Coal","min_level":2,"weight":15},
    {"name":"Silver Ore","min_level":3,"weight":12},
    {"name":"Gemstone","min_level":3,"weight":5},
    {"name":"Gold Ore","min_level":4,"weight":8},
    {"name":"Emerald","min_level":4,"weight":3},
    {"name":"Diamond","min_level":5,"weight":2}
  ]'::jsonb;

  v_pool jsonb;
  v_entry jsonb;
  v_total_weight numeric;
  v_roll numeric;
  v_cumulative numeric;
  v_rare_drop numeric;
BEGIN
  IF p_action NOT IN ('woodcutting', 'mining') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be woodcutting or mining', p_action;
  END IF;

  v_skill_name := CASE WHEN p_action = 'woodcutting' THEN 'Woodcutting' ELSE 'Mining' END;

  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  SELECT level INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = v_skill_name;
  v_skill_level := COALESCE(v_skill_level, 1);

  v_stamina_cost := 8 + GREATEST(0, (v_skill_level - 1) * 2);

  IF v_stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  v_pool := CASE WHEN p_action = 'woodcutting' THEN v_wood_resources ELSE v_mine_resources END;

  v_total_weight := 0;
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_pool)
  LOOP
    IF (v_entry->>'min_level')::int <= v_skill_level THEN
      v_total_weight := v_total_weight + (v_entry->>'weight')::numeric;
    END IF;
  END LOOP;

  v_roll := random() * v_total_weight;
  v_cumulative := 0;
  v_item_name := NULL;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_pool)
  LOOP
    IF (v_entry->>'min_level')::int <= v_skill_level THEN
      v_cumulative := v_cumulative + (v_entry->>'weight')::numeric;
      IF v_roll <= v_cumulative THEN
        v_item_name := v_entry->>'name';
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF v_item_name IS NULL THEN
    v_item_name := CASE WHEN p_action = 'woodcutting' THEN 'Wood' ELSE 'Stone' END;
  END IF;

  v_fail_chance := GREATEST(0.05, 0.30 - (v_skill_level - 1) * 0.05);
  v_success := random() > v_fail_chance;

  IF NOT v_success THEN
    v_xp_gain := 2 + floor(random() * 3)::int;
    PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);
    PERFORM public.compute_player_level(p_character_id);
    v_message := 'Your attempt failed. Better luck next time.';
    RETURN jsonb_build_object(
      'skill', v_skill_name, 'xp_gained', v_xp_gain, 'level', v_skill_level,
      'item_name', null, 'item_qty', 0, 'stamina_cost', v_stamina_cost,
      'success', false, 'message', v_message
    );
  END IF;

  v_item_qty := 1 + floor(random() * (1 + v_skill_level / 5))::int;

  v_rare_drop := random();
  IF v_rare_drop < 0.05 AND v_skill_level >= 3 THEN
    DECLARE
      v_rare_name text;
      v_rare_qty int;
      v_rare_id uuid;
    BEGIN
      IF p_action = 'woodcutting' THEN
        v_rare_name := 'Coal';
        v_rare_qty := 1;
      ELSE
        v_rare_name := CASE WHEN v_skill_level >= 4 THEN 'Gemstone' ELSE 'Coal' END;
        v_rare_qty := 1;
      END IF;

      SELECT id INTO v_rare_id FROM public.items WHERE name = v_rare_name LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO public.items (name, type, rarity) VALUES (v_rare_name, 'resource', 2)
        RETURNING id INTO v_rare_id;
      END IF;

      SELECT id, quantity INTO v_existing_inv FROM public.inventory
      WHERE character_id = p_character_id AND item_id = v_rare_id;

      IF FOUND THEN
        UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_rare_qty WHERE id = v_existing_inv.id;
      ELSE
        INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_rare_id, v_rare_qty);
      END IF;

      v_item_qty := v_item_qty + v_rare_qty;
      v_item_name := v_item_name || ' + ' || v_rare_name;
    END;
  END IF;

  SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'resource', v_skill_level)
    RETURNING id INTO v_item_id;
  END IF;

  SELECT id, quantity INTO v_existing_inv FROM public.inventory
  WHERE character_id = p_character_id AND item_id = v_item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty WHERE id = v_existing_inv.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_item_id, v_item_qty);
  END IF;

  v_xp_gain := 3 + floor(random() * 3 + v_skill_level / 10)::int;
  PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  v_message := CASE WHEN p_action = 'woodcutting' THEN 'Chop chop!' ELSE 'Mined successfully!' END;

  RETURN jsonb_build_object(
    'skill', v_skill_name, 'xp_gained', v_xp_gain, 'level', v_skill_level,
    'item_name', v_item_name, 'item_qty', v_item_qty, 'stamina_cost', v_stamina_cost,
    'success', true, 'message', v_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. FIXED: train RPC
--    XP per action: 2-5 base + level/10
--    Higher-level activities (sprinting, vitality) cost more stamina
--    All activities contribute compute_player_level
-- ============================================================
CREATE OR REPLACE FUNCTION public.train(
  p_character_id uuid,
  p_activity text
)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_xp_gain int;
  v_item_name text;
  v_item_qty int;
  v_item_id uuid;
  v_existing_inv RECORD;
  v_coin_reward int;
  v_result jsonb;
  v_stamina_cost int;
  v_skill_name text;
  v_activity_label text;
  v_skill_level int;
BEGIN
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  CASE p_activity
    WHEN 'sparring' THEN
      v_stamina_cost := 10; v_skill_name := 'Combat'; v_activity_label := 'Sparring';
    WHEN 'conditioning' THEN
      v_stamina_cost := 12; v_skill_name := 'Combat'; v_activity_label := 'Conditioning';
    WHEN 'sprinting' THEN
      v_stamina_cost := 10; v_skill_name := 'Combat'; v_activity_label := 'Sprinting';
    WHEN 'vitality_training' THEN
      v_stamina_cost := 12; v_skill_name := 'Combat'; v_activity_label := 'Vitality Training';
    WHEN 'foraging' THEN
      v_stamina_cost := 8; v_skill_name := 'Gathering'; v_activity_label := 'Foraging';
    WHEN 'study' THEN
      v_stamina_cost := 6; v_skill_name := 'Crafting'; v_activity_label := 'Study';
    WHEN 'chopping_drill' THEN
      v_stamina_cost := 10; v_skill_name := 'Woodcutting'; v_activity_label := 'Chopping Drill';
    WHEN 'mining_practice' THEN
      v_stamina_cost := 10; v_skill_name := 'Mining'; v_activity_label := 'Mining Practice';
    ELSE
      RAISE EXCEPTION 'Unknown activity: %', p_activity;
  END CASE;

  SELECT level INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = v_skill_name;

  v_stamina_cost := v_stamina_cost + GREATEST(0, (COALESCE(v_skill_level, 1) - 1) * 2);

  IF v_stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  v_xp_gain := 3 + floor(random() * 3 + v_skill_level / 10)::int;
  PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);

  IF p_activity = 'foraging' THEN
    PERFORM public.check_skill_xp(p_character_id, 'Woodcutting', GREATEST(1, v_xp_gain / 2));
    PERFORM public.check_skill_xp(p_character_id, 'Mining', GREATEST(1, v_xp_gain / 2));
  END IF;

  PERFORM public.compute_player_level(p_character_id);

  v_item_name := NULL;
  v_item_qty := 0;
  v_coin_reward := 0;

  IF p_activity = 'foraging' THEN
    v_item_name := (ARRAY['Wood', 'Herbs', 'Stone', 'Wild Berries', 'Clay', 'Flint'])[1 + floor(random() * 6)::int];
    v_item_qty := 1 + floor(random() * 3)::int;
    SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'resource', 1)
      RETURNING id INTO v_item_id;
    END IF;
    SELECT id, quantity INTO v_existing_inv FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_item_id;
    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_item_id, v_item_qty);
    END IF;
  ELSIF p_activity IN ('sparring', 'conditioning', 'sprinting', 'vitality_training') THEN
    v_coin_reward := 2 + floor(random() * 3)::int;
    UPDATE public.characters SET gold = gold + v_coin_reward WHERE id = p_character_id;
  ELSIF p_activity IN ('chopping_drill', 'mining_practice') THEN
    v_item_name := CASE WHEN p_activity = 'chopping_drill' THEN 'Wood' ELSE 'Stone' END;
    v_item_qty := 1 + floor(random() * 3)::int;
    SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'resource', 1)
      RETURNING id INTO v_item_id;
    END IF;
    SELECT id, quantity INTO v_existing_inv FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_item_id;
    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_item_id, v_item_qty);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'activity', v_activity_label, 'skill', v_skill_name,
    'xp_gain', v_xp_gain, 'stamina_cost', v_stamina_cost,
    'item_name', v_item_name, 'item_qty', v_item_qty,
    'coin_reward', v_coin_reward
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. FIXED: explore_step (add compute_player_level)
-- ============================================================
CREATE OR REPLACE FUNCTION public.explore_step(p_character_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_speed int;
  v_xp_gain int;
  v_item_name text;
  v_item_qty int;
  v_gold_find int;
  v_trap_damage int;
  v_zone text;
  v_event_type text;
  v_event_text text;

  v_zones text[] := ARRAY['Dark Forest', 'Open Plains', 'Riverbank', 'Jagged Caves', 'Ancient Ruins', 'Deep Swamp'];
  v_event_types text[] := ARRAY['resource','resource','resource','resource','resource','encounter','encounter','encounter','flavor','flavor','flavor','treasure','trap','merchant'];
BEGIN
  SELECT stamina, speed INTO v_stamina, v_speed FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < 5 THEN RAISE EXCEPTION 'Not enough stamina'; END IF;

  UPDATE public.characters SET stamina = stamina - 5, stamina_updated_at = now() WHERE id = p_character_id;

  v_zone := v_zones[1 + floor(random() * array_length(v_zones, 1))::int];
  v_event_type := v_event_types[1 + floor(random() * array_length(v_event_types, 1))::int];

  v_xp_gain := 2 + floor(random() * 4 + v_speed / 10)::int;
  PERFORM public.check_skill_xp(p_character_id, 'Combat', v_xp_gain);

  IF v_event_type = 'resource' THEN
    CASE v_zone
      WHEN 'Dark Forest' THEN v_item_name := (ARRAY['Wood', 'Herbs', 'Wild Berries', 'Bark Fiber', 'Mushrooms'])[1 + floor(random() * 5)::int];
      WHEN 'Open Plains' THEN v_item_name := (ARRAY['Dry Grass', 'Flint', 'Wild Herbs', 'Clay', 'Feathers'])[1 + floor(random() * 5)::int];
      WHEN 'Riverbank' THEN v_item_name := (ARRAY['River Stone', 'Reed Fiber', 'Driftwood', 'Fish', 'Clay'])[1 + floor(random() * 5)::int];
      WHEN 'Jagged Caves' THEN v_item_name := (ARRAY['Stone', 'Ore Nugget', 'Crystal Shard', 'Bone', 'Cave Mushroom'])[1 + floor(random() * 5)::int];
      WHEN 'Ancient Ruins' THEN v_item_name := (ARRAY['Rusty Gear', 'Ancient Coin', 'Scroll Fragment', 'Old Rope', 'Strange Dust'])[1 + floor(random() * 5)::int];
      WHEN 'Deep Swamp' THEN v_item_name := (ARRAY['Bog Iron', 'Leech', 'Swamp Moss', 'Rotwood', 'Slime'])[1 + floor(random() * 5)::int];
      ELSE v_item_name := 'Wood';
    END CASE;
    v_item_qty := 1 + floor(random() * 3)::int;
    PERFORM public.give_item(p_character_id, v_item_name, v_item_qty);
    v_event_text := 'Found ' || v_item_qty || 'x ' || v_item_name || '!';
  ELSIF v_event_type = 'encounter' THEN
    v_event_text := (ARRAY[
      'A wild boar charges from the undergrowth!',
      'A bandit leaps out, blade drawn!',
      'A territorial wolf snarls at you!',
      'A giant spider drops from above!',
      'A mud-caked golem rises from the swamp!'
    ])[1 + floor(random() * 5)::int];
  ELSIF v_event_type = 'treasure' THEN
    v_event_text := (ARRAY[
      'You discover a hidden cache beneath loose stones!',
      'A rusted chest sits in an alcove!',
      'Something glints in the mud — a treasure!'
    ])[1 + floor(random() * 3)::int];
    v_gold_find := 5 + floor(random() * 10)::int;
    UPDATE public.characters SET gold = gold + v_gold_find WHERE id = p_character_id;
    CASE v_zone
      WHEN 'Jagged Caves' THEN v_item_name := 'Crystal Shard';
      WHEN 'Ancient Ruins' THEN v_item_name := 'Ancient Coin';
      WHEN 'Deep Swamp' THEN v_item_name := 'Bog Iron';
      WHEN 'Dark Forest' THEN v_item_name := 'Mushrooms';
      WHEN 'Riverbank' THEN v_item_name := 'River Stone';
      ELSE v_item_name := 'Flint';
    END CASE;
    v_item_qty := 1 + floor(random() * 3)::int;
    PERFORM public.give_item(p_character_id, v_item_name, v_item_qty);
    v_event_text := v_event_text || ' +' || v_gold_find || ' gold, +' || v_item_qty || 'x ' || v_item_name || '!';
  ELSIF v_event_type = 'trap' THEN
    v_event_text := (ARRAY[
      'You step on a hidden spike trap!',
      'A tripwire catches your ankle — you stumble!',
      'The ground gives way into a shallow pit!'
    ])[1 + floor(random() * 3)::int];
    v_trap_damage := GREATEST(2, 15 - COALESCE(v_speed, 1));
    UPDATE public.characters SET stamina = GREATEST(0, stamina - v_trap_damage), stamina_updated_at = now() WHERE id = p_character_id;
    v_event_text := v_event_text || ' -' || v_trap_damage || ' Stamina!';
  ELSIF v_event_type = 'flavor' THEN
    v_event_text := 'The wind whispers through the trees. You press on.';
  ELSIF v_event_type = 'merchant' THEN
    v_event_text := 'A hooded trader nods at you and continues walking.';
  END IF;

  IF v_event_text IS NULL THEN v_event_text := 'You wander aimlessly for a while.'; END IF;

  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object(
    'zone', v_zone, 'event_type', v_event_type,
    'event_text', v_event_text, 'xp_gained', v_xp_gain
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. FIXED: resolve_combat_win (add compute_player_level, reduce gold)
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_combat_win(p_character_id uuid, p_xp_reward int)
RETURNS jsonb AS $$
DECLARE
  v_gold_reward int;
BEGIN
  PERFORM public.check_skill_xp(p_character_id, 'Combat', p_xp_reward);
  v_gold_reward := 2 + floor(random() * 5)::int;
  UPDATE public.characters SET gold = gold + v_gold_reward WHERE id = p_character_id;
  PERFORM public.compute_player_level(p_character_id);
  RETURN jsonb_build_object('xp', p_xp_reward, 'gold', v_gold_reward);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
