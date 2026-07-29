-- Migration 025: RuneScape-style XP curve & leveling
-- ============================================================
-- XP curve: standard Old School RuneScape formula
--   total_xp = floor(sum(floor(level + 300 * 2^(level/7)) for level=1 to N-1) / 4)
--   Level 99: ~13,034,431 total XP
--   Level 50: ~101,333 total XP
--   Level 10: ~1,154 total XP
--   Level 99 max per skill
--   Player level = sum(skill levels), max 495 (99 * 5 skills)
-- ============================================================

-- ============================================================
-- Helper: get total XP required to reach a given level
-- ============================================================
CREATE OR REPLACE FUNCTION public.xp_for_level(target_level int)
RETURNS int AS $$
DECLARE
  total_xp int := 0;
  i int;
BEGIN
  IF target_level <= 1 THEN RETURN 0; END IF;
  FOR i IN 1 .. target_level - 1 LOOP
    total_xp := total_xp + floor(i + 300 * pow(2.0, i / 7.0));
  END LOOP;
  RETURN floor(total_xp / 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- check_skill_xp — RS curve, 99 max
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_skill_xp(p_character_id uuid, p_skill_name text, p_xp_gained int)
RETURNS void AS $$
DECLARE
  v_skill RECORD;
  v_new_xp int;
  v_new_level int;
BEGIN
  SELECT id, level, experience INTO v_skill
  FROM public.skills
  WHERE character_id = p_character_id AND name = p_skill_name;

  IF NOT FOUND THEN
    INSERT INTO public.skills (character_id, name, level, experience)
    VALUES (p_character_id, p_skill_name, 1, 0)
    RETURNING id, level, experience INTO v_skill;
  END IF;

  v_new_xp := v_skill.experience + p_xp_gained;

  v_new_level := v_skill.level;
  WHILE v_new_level < 99 AND v_new_xp >= public.xp_for_level(v_new_level + 1) LOOP
    v_new_level := v_new_level + 1;
  END LOOP;

  UPDATE public.skills
  SET experience = v_new_xp, level = v_new_level
  WHERE id = v_skill.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- compute_player_level — uncapped (99 * 5 = 495 max)
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_player_level(p_character_id uuid)
RETURNS INTEGER AS $$
DECLARE
  total_level INTEGER;
BEGIN
  SELECT COALESCE(SUM(level), 0) INTO total_level
  FROM skills
  WHERE character_id = p_character_id;
  RETURN total_level;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- gather_resource — RS-style XP rewards
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

  v_gather_resources jsonb := '[
    {"name":"Wild Herbs","min_level":1,"weight":45},
    {"name":"Wild Berries","min_level":1,"weight":40},
    {"name":"Bark Fiber","min_level":1,"weight":35},
    {"name":"Mushrooms","min_level":1,"weight":30},
    {"name":"Clay","min_level":2,"weight":20},
    {"name":"Flint","min_level":2,"weight":18},
    {"name":"Reeds","min_level":3,"weight":15},
    {"name":"Hides","min_level":3,"weight":10},
    {"name":"Bone","min_level":4,"weight":8}
  ]'::jsonb;

  v_pool jsonb;
  v_entry jsonb;
  v_total_weight numeric;
  v_roll numeric;
  v_cumulative numeric;
  v_rare_drop numeric;
BEGIN
  IF p_action NOT IN ('woodcutting', 'mining', 'gathering') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be woodcutting, mining, or gathering', p_action;
  END IF;

  v_skill_name := CASE
    WHEN p_action = 'woodcutting' THEN 'Woodcutting'
    WHEN p_action = 'mining' THEN 'Mining'
    ELSE 'Gathering'
  END;

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

  v_pool := CASE
    WHEN p_action = 'woodcutting' THEN v_wood_resources
    WHEN p_action = 'mining' THEN v_mine_resources
    ELSE v_gather_resources
  END;

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
    v_item_name := CASE
      WHEN p_action = 'woodcutting' THEN 'Wood'
      WHEN p_action = 'mining' THEN 'Stone'
      ELSE 'Wild Herbs'
    END;
  END IF;

  v_fail_chance := GREATEST(0.05, 0.30 - (v_skill_level - 1) * 0.05);
  v_success := random() > v_fail_chance;

  IF NOT v_success THEN
    v_xp_gain := GREATEST(5, v_skill_level * 2 + floor(random() * v_skill_level / 2 + 1)::int);
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
      ELSIF p_action = 'mining' THEN
        v_rare_name := CASE WHEN v_skill_level >= 4 THEN 'Gemstone' ELSE 'Coal' END;
        v_rare_qty := 1;
      ELSE
        v_rare_name := 'Golden Herb';
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

  v_xp_gain := GREATEST(10, v_skill_level * 3 + floor(random() * (v_skill_level / 2 + 1))::int);
  PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  v_message := CASE
    WHEN p_action = 'woodcutting' THEN 'Chop chop!'
    WHEN p_action = 'mining' THEN 'Mined successfully!'
    ELSE 'Gathered from the wilds!'
  END;

  RETURN jsonb_build_object(
    'skill', v_skill_name, 'xp_gained', v_xp_gain, 'level', v_skill_level,
    'item_name', v_item_name, 'item_qty', v_item_qty, 'stamina_cost', v_stamina_cost,
    'success', true, 'message', v_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- train — combat-only, RS-style XP rewards
-- ============================================================
CREATE OR REPLACE FUNCTION public.train(
  p_character_id uuid,
  p_activity text
)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_xp_gain int;
  v_coin_reward int;
  v_stamina_cost int;
  v_skill_name text := 'Combat';
  v_activity_label text;
  v_skill_level int;
BEGIN
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  CASE p_activity
    WHEN 'sparring' THEN
      v_stamina_cost := 10; v_activity_label := 'Sparring';
    WHEN 'conditioning' THEN
      v_stamina_cost := 12; v_activity_label := 'Conditioning';
    WHEN 'sprinting' THEN
      v_stamina_cost := 10; v_activity_label := 'Sprinting';
    WHEN 'vitality_training' THEN
      v_stamina_cost := 12; v_activity_label := 'Vitality Training';
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

  v_xp_gain := GREATEST(10, v_skill_level * 3 + floor(random() * (v_skill_level / 2 + 1))::int);
  PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  v_coin_reward := 2 + floor(random() * 3)::int;
  UPDATE public.characters SET gold = gold + v_coin_reward WHERE id = p_character_id;

  RETURN jsonb_build_object(
    'activity', v_activity_label, 'skill', v_skill_name,
    'xp_gain', v_xp_gain, 'stamina_cost', v_stamina_cost,
    'coin_reward', v_coin_reward
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- craft_item_rpc — RS-style XP rewards
-- ============================================================
CREATE OR REPLACE FUNCTION public.craft_item_rpc(
  p_character_id uuid,
  p_item_name text,
  p_item_type text,
  p_item_rarity int,
  p_item_stats jsonb,
  p_duration int,
  p_materials jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_char record;
  v_mat jsonb;
  v_item_id uuid;
  v_inv record;
  v_new_qty int;
  v_xp_gain int;
  v_skill_level int;
BEGIN
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id FOR UPDATE;
  IF v_char IS NULL THEN RETURN jsonb_build_object('error', 'Character not found'); END IF;

  IF v_char.stamina < (10 + p_item_rarity * 3) THEN
    RETURN jsonb_build_object('error', 'Not enough stamina');
  END IF;

  SELECT level INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Crafting';
  v_skill_level := COALESCE(v_skill_level, 1);

  FOR v_mat IN SELECT * FROM jsonb_array_elements(p_materials)
  LOOP
    SELECT inv.id, inv.quantity INTO v_inv
    FROM public.inventory inv
    JOIN public.items i ON i.id = inv.item_id
    WHERE inv.character_id = p_character_id AND i.name = v_mat->>'name';

    IF v_inv IS NULL OR v_inv.quantity < (v_mat->>'quantity')::int THEN
      RETURN jsonb_build_object('error', 'Missing materials: ' || (v_mat->>'name'));
    END IF;

    v_new_qty := v_inv.quantity - (v_mat->>'quantity')::int;
    IF v_new_qty <= 0 THEN
      DELETE FROM public.inventory WHERE id = v_inv.id;
    ELSE
      UPDATE public.inventory SET quantity = v_new_qty WHERE id = v_inv.id;
    END IF;
  END LOOP;

  UPDATE public.characters
  SET stamina = stamina - (10 + p_item_rarity * 3), stamina_updated_at = now()
  WHERE id = p_character_id;

  INSERT INTO public.items (name, type, rarity, stats)
  VALUES (p_item_name, p_item_type, p_item_rarity, p_item_stats)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_item_id FROM public.items WHERE name = p_item_name LIMIT 1;

  INSERT INTO public.inventory (character_id, item_id, quantity)
  VALUES (p_character_id, v_item_id, 1)
  ON CONFLICT (character_id, item_id)
  DO UPDATE SET quantity = public.inventory.quantity + 1;

  v_xp_gain := GREATEST(15, v_skill_level * 2 + floor(p_duration / 20)::int);
  PERFORM public.check_skill_xp(p_character_id, 'Crafting', v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object('success', true, 'xp_gained', v_xp_gain);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- explore_step — RS-style XP rewards
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

  v_xp_gain := GREATEST(8, v_speed * 2 + floor(random() * (v_speed / 2 + 1))::int);
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
-- resolve_combat_win — RS-style XP rewards
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_combat_win(p_character_id uuid, p_xp_reward int)
RETURNS jsonb AS $$
DECLARE
  v_gold_reward int;
  v_char record;
  v_xp_gain int;
BEGIN
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF v_char IS NULL THEN RETURN jsonb_build_object('xp', 0, 'gold', 0); END IF;

  v_xp_gain := GREATEST(10, p_xp_reward * 2 + floor(random() * (p_xp_reward / 2 + 1))::int);
  PERFORM public.check_skill_xp(p_character_id, 'Combat', v_xp_gain);
  v_gold_reward := 2 + floor(random() * 5)::int;
  UPDATE public.characters SET gold = gold + v_gold_reward WHERE id = p_character_id;
  PERFORM public.compute_player_level(p_character_id);
  RETURN jsonb_build_object('xp', v_xp_gain, 'gold', v_gold_reward);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- contribute_to_project — also included from 024
-- (deduct inventory, daily cap 50 per project per character)
-- ============================================================
CREATE OR REPLACE FUNCTION public.contribute_to_project(
  p_character_id uuid,
  p_project_id uuid,
  p_wood int DEFAULT 0,
  p_stone int DEFAULT 0,
  p_food int DEFAULT 0
)
RETURNS jsonb AS $$
DECLARE
  v_project RECORD;
  v_clan_id uuid;
  v_char_name text;
  v_completed boolean := false;
  v_wood_item_id uuid;
  v_stone_item_id uuid;
  v_food_item_id uuid;
  v_wood_qty int;
  v_stone_qty int;
  v_food_qty int;
  v_today date;
  v_contributed_today int;
  v_daily_limit int := 50;
BEGIN
  SELECT cp.*, cm.clan_id INTO v_project
  FROM public.clan_projects cp
  JOIN public.clan_members cm ON cm.clan_id = cp.clan_id AND cm.character_id = p_character_id
  WHERE cp.id = p_project_id AND cp.status = 'active';

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or you are not a clan member.';
  END IF;

  SELECT c.name INTO v_char_name FROM public.characters c WHERE c.id = p_character_id;

  v_today := CURRENT_DATE;
  SELECT COALESCE(SUM(wood_contributed + stone_contributed + food_contributed), 0)
  INTO v_contributed_today
  FROM public.clan_project_contributions
  WHERE project_id = p_project_id AND character_id = p_character_id AND created_at >= v_today;

  IF (p_wood + p_stone + p_food) + v_contributed_today > v_daily_limit THEN
    RAISE EXCEPTION 'Daily contribution limit of % reached for this project (already contributed % today).', v_daily_limit, v_contributed_today;
  END IF;

  IF p_wood > 0 THEN
    SELECT id INTO v_wood_item_id FROM public.items WHERE name = 'Wood' LIMIT 1;
    IF v_wood_item_id IS NULL THEN RAISE EXCEPTION 'Wood item not found in database.'; END IF;
    SELECT SUM(quantity)::int INTO v_wood_qty FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_wood_item_id;
    v_wood_qty := COALESCE(v_wood_qty, 0);
    IF v_wood_qty < p_wood THEN
      RAISE EXCEPTION 'Not enough Wood in inventory (have %, need %).', v_wood_qty, p_wood;
    END IF;
    UPDATE public.inventory SET quantity = quantity - p_wood
    WHERE character_id = p_character_id AND item_id = v_wood_item_id;
    DELETE FROM public.inventory WHERE character_id = p_character_id AND item_id = v_wood_item_id AND quantity <= 0;
  END IF;

  IF p_stone > 0 THEN
    SELECT id INTO v_stone_item_id FROM public.items WHERE name = 'Stone' LIMIT 1;
    IF v_stone_item_id IS NULL THEN RAISE EXCEPTION 'Stone item not found in database.'; END IF;
    SELECT SUM(quantity)::int INTO v_stone_qty FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_stone_item_id;
    v_stone_qty := COALESCE(v_stone_qty, 0);
    IF v_stone_qty < p_stone THEN
      RAISE EXCEPTION 'Not enough Stone in inventory (have %, need %).', v_stone_qty, p_stone;
    END IF;
    UPDATE public.inventory SET quantity = quantity - p_stone
    WHERE character_id = p_character_id AND item_id = v_stone_item_id;
    DELETE FROM public.inventory WHERE character_id = p_character_id AND item_id = v_stone_item_id AND quantity <= 0;
  END IF;

  IF p_food > 0 THEN
    SELECT id INTO v_food_item_id FROM public.items WHERE name = 'Wild Berries' LIMIT 1;
    IF v_food_item_id IS NULL THEN RAISE EXCEPTION 'Food item (Wild Berries) not found in database.'; END IF;
    SELECT SUM(quantity)::int INTO v_food_qty FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_food_item_id;
    v_food_qty := COALESCE(v_food_qty, 0);
    IF v_food_qty < p_food THEN
      RAISE EXCEPTION 'Not enough Wild Berries in inventory (have %, need %).', v_food_qty, p_food;
    END IF;
    UPDATE public.inventory SET quantity = quantity - p_food
    WHERE character_id = p_character_id AND item_id = v_food_item_id;
    DELETE FROM public.inventory WHERE character_id = p_character_id AND item_id = v_food_item_id AND quantity <= 0;
  END IF;

  INSERT INTO public.clan_project_contributions (project_id, character_id, wood_contributed, stone_contributed, food_contributed)
  VALUES (p_project_id, p_character_id, p_wood, p_stone, p_food);

  UPDATE public.clan_projects
  SET
    contributed_wood = contributed_wood + p_wood,
    contributed_stone = contributed_stone + p_stone,
    contributed_food = contributed_food + p_food
  WHERE id = p_project_id
  RETURNING * INTO v_project;

  IF v_project.contributed_wood >= v_project.total_wood
    AND v_project.contributed_stone >= v_project.total_stone
    AND v_project.contributed_food >= v_project.total_food THEN
    UPDATE public.clan_projects
    SET status = 'completed', completed_at = now()
    WHERE id = p_project_id;
    v_completed := true;

    IF v_project.reward_type = 'morale' THEN
      UPDATE public.clans SET morale = LEAST(100, morale + (v_project.reward_value::int)) WHERE id = v_project.clan_id;
    ELSIF v_project.reward_type = 'population' THEN
      UPDATE public.clans SET population = population + (v_project.reward_value::int) WHERE id = v_project.clan_id;
    END IF;
  END IF;

  PERFORM public.add_clan_event(
    v_project.clan_id,
    CASE WHEN v_completed THEN 'project_completed' ELSE 'project_progress' END,
    CASE WHEN v_completed THEN v_char_name || ' completed the ' || v_project.name || '!'
         ELSE v_char_name || ' contributed to ' || v_project.name
    END,
    p_character_id
  );

  IF v_completed THEN
    INSERT INTO public.notifications (character_id, notification_type, title, description, link)
    SELECT cm.character_id, 'project_completed', 'Project Completed: ' || v_project.name,
           'The ' || v_project.name || ' has been finished!',
           '/clans'
    FROM public.clan_members cm
    WHERE cm.clan_id = v_project.clan_id;
  END IF;

  RETURN jsonb_build_object(
    'project_id', v_project.id,
    'completed', v_completed,
    'contributed_wood', p_wood,
    'contributed_stone', p_stone,
    'contributed_food', p_food
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
