-- Migration 011: Woodcutting & Mining — RuneScape-style resource gathering
-- Adds two new skills, a gather_resource RPC, and seeds tiered resource items

-- ============================================================
-- SEED: Resource items (tiered woodcutting & mining resources)
-- ============================================================
INSERT INTO public.items (name, type, tier, stats) VALUES
  -- Woodcutting tier 1-5
  ('Wood',          'resource', 1, '{}'),
  ('Oak Log',       'resource', 2, '{}'),
  ('Willow Log',    'resource', 3, '{}'),
  ('Maple Log',     'resource', 4, '{}'),
  ('Yew Log',       'resource', 5, '{}'),
  -- Mining tier 1-5
  ('Stone',         'resource', 1, '{}'),
  ('Copper Ore',    'resource', 2, '{}'),
  ('Iron Ore',      'resource', 3, '{}'),
  ('Silver Ore',    'resource', 4, '{}'),
  ('Gold Ore',      'resource', 5, '{}'),
  -- Rare drops
  ('Coal',          'resource', 2, '{}'),
  ('Gemstone',      'resource', 3, '{}'),
  ('Diamond',       'resource', 5, '{}'),
  ('Emerald',       'resource', 4, '{}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RPC: gather_resource
-- Unified woodcutting/mining action.
-- p_action = 'woodcutting' | 'mining'
--
-- Returns: jsonb with skill, xp_gained, tier, item_name, item_qty,
--          stamina_cost, success, message
-- ============================================================
CREATE OR REPLACE FUNCTION public.gather_resource(
  p_character_id uuid,
  p_action text
)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_skill_name text;
  v_skill_tier int;
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

  -- Woodcutting resources: name, min_tier, weight (probability weight)
  v_wood_resources jsonb := '[
    {"name":"Wood","min_tier":1,"weight":50},
    {"name":"Oak Log","min_tier":1,"weight":30},
    {"name":"Willow Log","min_tier":2,"weight":25},
    {"name":"Maple Log","min_tier":3,"weight":15},
    {"name":"Yew Log","min_tier":4,"weight":8}
  ]'::jsonb;

  -- Mining resources: name, min_tier, weight
  v_mine_resources jsonb := '[
    {"name":"Stone","min_tier":1,"weight":45},
    {"name":"Copper Ore","min_tier":1,"weight":30},
    {"name":"Iron Ore","min_tier":2,"weight":25},
    {"name":"Coal","min_tier":2,"weight":15},
    {"name":"Silver Ore","min_tier":3,"weight":12},
    {"name":"Gemstone","min_tier":3,"weight":5},
    {"name":"Gold Ore","min_tier":4,"weight":8},
    {"name":"Emerald","min_tier":4,"weight":3},
    {"name":"Diamond","min_tier":5,"weight":2}
  ]'::jsonb;

  v_pool jsonb;
  v_entry jsonb;
  v_total_weight numeric;
  v_roll numeric;
  v_cumulative numeric;
  v_rare_drop numeric;
BEGIN
  -- Validate action
  IF p_action NOT IN ('woodcutting', 'mining') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be woodcutting or mining', p_action;
  END IF;

  -- Set skill name
  v_skill_name := CASE WHEN p_action = 'woodcutting' THEN 'Woodcutting' ELSE 'Mining' END;

  -- Get stamina
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  -- Get skill tier
  SELECT tier INTO v_skill_tier FROM public.skills
  WHERE character_id = p_character_id AND name = v_skill_name;
  v_skill_tier := COALESCE(v_skill_tier, 1);

  -- Stamina cost: base 8, +2 per tier above 1
  v_stamina_cost := 8 + GREATEST(0, (v_skill_tier - 1) * 2);

  IF v_stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  -- Deduct stamina
  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  -- Select resource pool
  v_pool := CASE WHEN p_action = 'woodcutting' THEN v_wood_resources ELSE v_mine_resources END;

  -- Filter to resources available at current tier, compute total weight
  v_total_weight := 0;
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_pool)
  LOOP
    IF (v_entry->>'min_tier')::int <= v_skill_tier THEN
      v_total_weight := v_total_weight + (v_entry->>'weight')::numeric;
    END IF;
  END LOOP;

  -- Roll for resource
  v_roll := random() * v_total_weight;
  v_cumulative := 0;
  v_item_name := NULL;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_pool)
  LOOP
    IF (v_entry->>'min_tier')::int <= v_skill_tier THEN
      v_cumulative := v_cumulative + (v_entry->>'weight')::numeric;
      IF v_roll <= v_cumulative THEN
        v_item_name := v_entry->>'name';
        EXIT;
      END IF;
    END IF;
  END LOOP;

  -- Fallback
  IF v_item_name IS NULL THEN
    v_item_name := CASE WHEN p_action = 'woodcutting' THEN 'Wood' ELSE 'Stone' END;
  END IF;

  -- Success roll: base 70% + 5% per tier, capped at 95%
  v_fail_chance := GREATEST(0.05, 0.30 - (v_skill_tier - 1) * 0.05);
  v_success := random() > v_fail_chance;

  IF NOT v_success THEN
    -- Failed: no resource, but still gain some XP (reduced)
    v_xp_gain := 1 + floor(random() * 2)::int;
    PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);
    v_message := 'Your attempt failed. Better luck next time.';

    v_result := jsonb_build_object(
      'skill', v_skill_name,
      'xp_gained', v_xp_gain,
      'tier', v_skill_tier,
      'item_name', null,
      'item_qty', 0,
      'stamina_cost', v_stamina_cost,
      'success', false,
      'message', v_message
    );
    RETURN v_result;
  END IF;

  -- Determine quantity: 1-3, higher tiers get better average
  v_item_qty := 1 + floor(random() * (1 + v_skill_tier))::int;

  -- Rare drop: 5% chance for a bonus rare item
  v_rare_drop := random();
  IF v_rare_drop < 0.05 AND v_skill_tier >= 3 THEN
    DECLARE
      v_rare_name text;
      v_rare_qty int;
      v_rare_id uuid;
    BEGIN
      IF p_action = 'woodcutting' THEN
        v_rare_name := 'Coal';
        v_rare_qty := 1;
      ELSE
        v_rare_name := CASE
          WHEN v_skill_tier >= 4 THEN 'Gemstone'
          ELSE 'Coal'
        END;
        v_rare_qty := 1;
      END IF;

      SELECT id INTO v_rare_id FROM public.items WHERE name = v_rare_name LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO public.items (name, type, tier) VALUES (v_rare_name, 'resource', 2)
        RETURNING id INTO v_rare_id;
      END IF;

      SELECT id, quantity INTO v_existing_inv FROM public.inventory
      WHERE character_id = p_character_id AND item_id = v_rare_id;

      IF FOUND THEN
        UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_rare_qty WHERE id = v_existing_inv.id;
      ELSE
        INSERT INTO public.inventory (character_id, item_id, quantity)
        VALUES (p_character_id, v_rare_id, v_rare_qty);
      END IF;

      v_item_qty := v_item_qty + v_rare_qty;
      v_item_name := v_item_name || ' + ' || v_rare_name;
    END;
  END IF;

  -- Add main resource to inventory
  SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.items (name, type, tier) VALUES (v_item_name, 'resource', v_skill_tier)
    RETURNING id INTO v_item_id;
  END IF;

  SELECT id, quantity INTO v_existing_inv FROM public.inventory
  WHERE character_id = p_character_id AND item_id = v_item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty WHERE id = v_existing_inv.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity)
    VALUES (p_character_id, v_item_id, v_item_qty);
  END IF;

  -- XP gain: 3-8 base, scales slightly with tier
  v_xp_gain := 3 + floor(random() * 5 + v_skill_tier)::int;
  PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);

  v_message := 'Chop chop!';

  v_result := jsonb_build_object(
    'skill', v_skill_name,
    'xp_gained', v_xp_gain,
    'tier', v_skill_tier,
    'item_name', v_item_name,
    'item_qty', v_item_qty,
    'stamina_cost', v_stamina_cost,
    'success', true,
    'message', v_message
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- UPDATE: Add Woodcutting & Mining to new character creation
-- ============================================================
-- Note: game.tsx handles this client-side, but we also need existing
-- characters to get the new skills. Run this manually:
-- INSERT INTO public.skills (character_id, name)
-- SELECT id, 'Woodcutting' FROM public.skills WHERE name = 'Gathering'
-- ON CONFLICT DO NOTHING;
-- INSERT INTO public.skills (character_id, name)
-- SELECT id, 'Mining' FROM public.skills WHERE name = 'Gathering'
-- ON CONFLICT DO NOTHING;

-- ============================================================
-- UPDATE: Existing foraging also gives Woodcutting/Mining XP
-- ============================================================
DROP FUNCTION IF EXISTS public.train(uuid, text);

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
  v_skill_tier int;
BEGIN
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  CASE p_activity
    WHEN 'sparring' THEN
      v_stamina_cost := 10; v_skill_name := 'Combat'; v_activity_label := 'Sparring';
    WHEN 'meditation' THEN
      v_stamina_cost := 8; v_skill_name := 'Diplomacy'; v_activity_label := 'Meditation';
    WHEN 'conditioning' THEN
      v_stamina_cost := 12; v_skill_name := 'Survival'; v_activity_label := 'Conditioning';
    WHEN 'sprinting' THEN
      v_stamina_cost := 10; v_skill_name := 'Survival'; v_activity_label := 'Sprinting';
    WHEN 'foraging' THEN
      v_stamina_cost := 8; v_skill_name := 'Gathering'; v_activity_label := 'Foraging';
    WHEN 'study' THEN
      v_stamina_cost := 6; v_skill_name := 'Crafting'; v_activity_label := 'Study';
    ELSE
      RAISE EXCEPTION 'Unknown activity: %', p_activity;
  END CASE;

  SELECT tier INTO v_skill_tier FROM public.skills
  WHERE character_id = p_character_id AND name = v_skill_name;

  v_stamina_cost := v_stamina_cost + GREATEST(0, (COALESCE(v_skill_tier, 1) - 1) * 2);

  IF v_stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  v_xp_gain := 3 + floor(random() * 5)::int;
  PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);

  -- Also give Woodcutting or Mining XP for foraging
  IF p_activity = 'foraging' THEN
    PERFORM public.check_skill_xp(p_character_id, 'Woodcutting', v_xp_gain);
    PERFORM public.check_skill_xp(p_character_id, 'Mining', v_xp_gain);
  END IF;

  v_item_name := NULL;
  v_item_qty := 0;
  v_coin_reward := 0;

  IF p_activity = 'foraging' THEN
    v_item_name := (ARRAY['Wood', 'Herbs', 'Stone', 'Wild Berries', 'Clay', 'Flint'])[1 + floor(random() * 6)::int];
    v_item_qty := 1 + floor(random() * 3)::int;

    SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.items (name, type, tier) VALUES (v_item_name, 'resource', 1)
      RETURNING id INTO v_item_id;
    END IF;

    SELECT id, quantity INTO v_existing_inv FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_item_id;

    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_item_id, v_item_qty);
    END IF;

  ELSIF p_activity = 'sparring' THEN
    v_coin_reward := 2 + floor(random() * 5)::int;
    UPDATE public.characters SET coins = coins + v_coin_reward WHERE id = p_character_id;

  ELSIF p_activity = 'conditioning' THEN
    IF random() < 0.3 THEN
      v_item_name := 'Hides';
      v_item_qty := 1;
      SELECT id INTO v_item_id FROM public.items WHERE name = 'Hides' LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO public.items (name, type, tier) VALUES ('Hides', 'resource', 1)
        RETURNING id INTO v_item_id;
      END IF;
      SELECT id, quantity INTO v_existing_inv FROM public.inventory
      WHERE character_id = p_character_id AND item_id = v_item_id;
      IF FOUND THEN
        UPDATE public.inventory SET quantity = v_existing_inv.quantity + 1 WHERE id = v_existing_inv.id;
      ELSE
        INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_item_id, 1);
      END IF;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'activity', v_activity_label,
    'skill', v_skill_name,
    'xp_gain', v_xp_gain,
    'stamina_cost', v_stamina_cost,
    'item_name', v_item_name,
    'item_qty', v_item_qty,
    'coin_reward', v_coin_reward
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
