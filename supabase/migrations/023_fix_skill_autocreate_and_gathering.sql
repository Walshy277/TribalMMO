-- Migration 023: Fix skill auto-creation, fix crafting XP, add gathering action
-- 1. check_skill_xp: INSERT skill row if it doesn't exist (instead of silent return)
-- 2. craft_item_rpc: call check_skill_xp + compute_player_level
-- 3. gather_resource: add "gathering" action for herbs/fruits/fibers

-- ============================================================
-- 1. FIXED: check_skill_xp — auto-create skill if missing
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

  IF NOT FOUND THEN
    INSERT INTO public.skills (character_id, name, level, experience)
    VALUES (p_character_id, p_skill_name, 1, 0)
    RETURNING id, level, experience INTO v_skill;
  END IF;

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
-- 2. FIXED: craft_item_rpc — award XP and recalculate player level
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
BEGIN
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id FOR UPDATE;
  IF v_char IS NULL THEN RETURN jsonb_build_object('error', 'Character not found'); END IF;

  IF v_char.stamina < (10 + p_item_rarity * 3) THEN
    RETURN jsonb_build_object('error', 'Not enough stamina');
  END IF;

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

  v_xp_gain := GREATEST(5, floor(p_duration / 60)::int);
  PERFORM public.check_skill_xp(p_character_id, 'Crafting', v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object('success', true, 'xp_gained', v_xp_gain);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. FIXED: gather_resource — add "gathering" action for herbs/fruits
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

  v_xp_gain := 3 + floor(random() * 3 + v_skill_level / 10)::int;
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
