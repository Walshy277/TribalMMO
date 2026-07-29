-- Migration 031: Gameplay improvements — skill synergies, equipment bonuses, new skills, resource sink
-- ============================================================
-- 1. gather_resource — flat stamina, flat XP, equipment bonuses, skill synergies
-- 2. shrine_donate — FIXED: uses item_id (not item_name)
-- 3. hunt — new Hunting skill
-- 4. beg — new Begging skill
-- 5. tame — new Taming skill
-- 6. handle_new_user — creates 8 skills for new signups
-- 7. shrine_bulk_donate — resource sink for mass offerings
-- ============================================================

-- ============================================================
-- 1. gather_resource — flat stamina (8), flat XP, stat bonuses
-- ============================================================
CREATE OR REPLACE FUNCTION public.gather_resource(
  p_character_id uuid,
  p_action text
)
RETURNS jsonb AS $$
DECLARE
  v_char RECORD;
  v_skill_name text;
  v_skill_level int;
  v_stamina_cost int := 8;
  v_xp_gain int;
  v_item_name text;
  v_item_qty int := 1;
  v_item_id uuid;
  v_existing_inv RECORD;
  v_str_bonus int;
  v_spd_bonus int;

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
  v_synergy_bonus int := 0;
  v_equip_str int := 0;
  v_equip_spd int := 0;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  IF p_action NOT IN ('woodcutting', 'mining', 'gathering') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be woodcutting, mining, or gathering', p_action;
  END IF;

  v_skill_name := CASE
    WHEN p_action = 'woodcutting' THEN 'Woodcutting'
    WHEN p_action = 'mining' THEN 'Mining'
    ELSE 'Gathering'
  END;

  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  IF v_char.stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  -- Equipment stat bonuses (sum stats from equipped items)
  SELECT COALESCE(SUM((i.stats->>'strength')::int), 0),
         COALESCE(SUM((i.stats->>'speed')::int), 0)
  INTO v_equip_str, v_equip_spd
  FROM public.inventory inv
  JOIN public.items i ON i.id = inv.item_id
  WHERE inv.character_id = p_character_id AND inv.equipped = true;

  v_str_bonus := v_char.strength + v_equip_str;
  v_spd_bonus := v_char.speed + v_equip_spd;

  SELECT level INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = v_skill_name;
  v_skill_level := COALESCE(v_skill_level, 1);

  -- Skill synergy: related skills grant bonus yield
  IF v_skill_name = 'Gathering' THEN
    SELECT COALESCE(level / 10, 0) INTO v_synergy_bonus FROM public.skills
    WHERE character_id = p_character_id AND name = 'Woodcutting';
  ELSIF v_skill_name = 'Woodcutting' THEN
    SELECT COALESCE(level / 10, 0) INTO v_synergy_bonus FROM public.skills
    WHERE character_id = p_character_id AND name = 'Mining';
  ELSIF v_skill_name = 'Mining' THEN
    SELECT COALESCE(level / 10, 0) INTO v_synergy_bonus FROM public.skills
    WHERE character_id = p_character_id AND name = 'Woodcutting';
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

  -- Item quantity: base + strength bonus + synergy bonus
  v_item_qty := 1 + floor(random() * (1 + v_skill_level / 5))::int
              + GREATEST(0, v_str_bonus / 3)
              + v_synergy_bonus;

  v_rare_drop := random();
  IF v_rare_drop < 0.02 THEN
    v_item_qty := v_item_qty + 5 + floor(random() * 6)::int;
  END IF;

  SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'resource', 1)
    RETURNING id INTO v_item_id;
  END IF;

  SELECT id, quantity INTO v_existing_inv
  FROM public.inventory
  WHERE character_id = p_character_id AND item_id = v_item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty
    WHERE id = v_existing_inv.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity)
    VALUES (p_character_id, v_item_id, v_item_qty);
  END IF;

  v_xp_gain := 10 + floor(random() * 6)::int;
  PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object(
    'success', true, 'item_name', v_item_name,
    'item_qty', v_item_qty, 'xp_gained', v_xp_gain,
    'stamina_cost', v_stamina_cost,
    'message', 'Found ' || v_item_qty || 'x ' || v_item_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. shrine_donate — FIXED: uses item_id (not item_name)
-- ============================================================
CREATE OR REPLACE FUNCTION public.shrine_donate(
  p_character_id uuid,
  p_inventory_id uuid,
  p_quantity int
)
RETURNS int AS $$
DECLARE
  v_inv RECORD;
  v_item_id uuid;
  v_new_qty int;
  v_xp_reward int;
  v_skill_level int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT inv.*, i.id as item_uuid, i.name as item_name INTO v_inv
  FROM public.inventory inv
  JOIN public.items i ON i.id = inv.item_id
  WHERE inv.id = p_inventory_id AND inv.character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;

  v_item_id := v_inv.item_uuid;

  v_new_qty := v_inv.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = p_inventory_id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = p_inventory_id;
  END IF;

  INSERT INTO public.shrine_donations (character_id, item_id, quantity)
  VALUES (p_character_id, v_item_id, p_quantity);

  SELECT level INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Gathering';
  v_skill_level := COALESCE(v_skill_level, 1);

  v_xp_reward := p_quantity * GREATEST(5, v_skill_level * 2);
  PERFORM public.check_skill_xp(p_character_id, 'Gathering', v_xp_reward);
  PERFORM public.compute_player_level(p_character_id);

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'shrine_donate', 0,
    'Donated ' || p_quantity || 'x ' || v_inv.item_name || ' to shrine',
    jsonb_build_object('item_id', v_item_id, 'quantity', p_quantity, 'xp_reward', v_xp_reward)
  );

  RETURN v_xp_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2b. shrine_bulk_donate — resource sink: donate any item by name
-- ============================================================
CREATE OR REPLACE FUNCTION public.shrine_bulk_donate(
  p_character_id uuid,
  p_item_name text,
  p_quantity int
)
RETURNS int AS $$
DECLARE
  v_inv RECORD;
  v_item_id uuid;
  v_new_qty int;
  v_xp_reward int;
  v_skill_level int;
  v_deduct_qty int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT i.id INTO v_item_id FROM public.items i WHERE i.name = p_item_name LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown item: %', p_item_name; END IF;

  SELECT inv.* INTO v_inv
  FROM public.inventory inv
  WHERE inv.character_id = p_character_id AND inv.item_id = v_item_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found in inventory'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items (have %, need %)', v_inv.quantity, p_quantity; END IF;

  v_deduct_qty := p_quantity;
  v_new_qty := v_inv.quantity - v_deduct_qty;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = v_inv.id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = v_inv.id;
  END IF;

  INSERT INTO public.shrine_donations (character_id, item_id, quantity)
  VALUES (p_character_id, v_item_id, v_deduct_qty);

  SELECT level INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Gathering';
  v_skill_level := COALESCE(v_skill_level, 1);

  v_xp_reward := v_deduct_qty * GREATEST(5, v_skill_level * 2);
  PERFORM public.check_skill_xp(p_character_id, 'Gathering', v_xp_reward);
  PERFORM public.compute_player_level(p_character_id);

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'shrine_donate', 0,
    'Donated ' || v_deduct_qty || 'x ' || p_item_name || ' to shrine (bulk)',
    jsonb_build_object('item_name', p_item_name, 'quantity', v_deduct_qty, 'xp_reward', v_xp_reward)
  );

  RETURN v_xp_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. hunt — Hunting skill RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.hunt(
  p_character_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_char RECORD;
  v_skill_level int;
  v_stamina_cost int := 8;
  v_xp_gain int;
  v_equip_str int := 0;
  v_synergy_bonus int := 0;
  v_item_name text;
  v_item_qty int;
  v_item_id uuid;
  v_existing_inv RECORD;
  v_success boolean;
  v_message text;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  SELECT COALESCE(level, 1) INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Hunting';

  IF v_char.stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  -- Equipment strength bonus
  SELECT COALESCE(SUM((i.stats->>'strength')::int), 0) INTO v_equip_str
  FROM public.inventory inv
  JOIN public.items i ON i.id = inv.item_id
  WHERE inv.character_id = p_character_id AND inv.equipped = true;

  -- Combat synergy bonus
  SELECT COALESCE(level / 10, 0) INTO v_synergy_bonus FROM public.skills
  WHERE character_id = p_character_id AND name = 'Combat';

  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  v_success := random() > GREATEST(0.1, 0.5 - v_skill_level * 0.04);

  IF NOT v_success THEN
    v_xp_gain := 5 + floor(random() * 3)::int;
    PERFORM public.check_skill_xp(p_character_id, 'Hunting', v_xp_gain);
    PERFORM public.compute_player_level(p_character_id);
    RETURN jsonb_build_object(
      'success', false, 'xp_gained', v_xp_gain,
      'item_name', null, 'item_qty', 0,
      'stamina_cost', v_stamina_cost,
      'message', 'The prey escaped your trap. Try again.'
    );
  END IF;

  v_item_name := (ARRAY['Raw Meat', 'Rabbit Fur', 'Boar Hide', 'Feathers', 'Bone', 'Sinew'])[1 + floor(random() * 6)::int];
  v_item_qty := 1 + floor(random() * (1 + v_skill_level / 5))::int
              + GREATEST(0, (v_char.strength + v_equip_str) / 4)
              + v_synergy_bonus;

  SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'resource', 1)
    RETURNING id INTO v_item_id;
  END IF;

  SELECT id, quantity INTO v_existing_inv
  FROM public.inventory WHERE character_id = p_character_id AND item_id = v_item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty WHERE id = v_existing_inv.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_item_id, v_item_qty);
  END IF;

  v_xp_gain := 10 + floor(random() * 6)::int;
  PERFORM public.check_skill_xp(p_character_id, 'Hunting', v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object(
    'success', true, 'xp_gained', v_xp_gain,
    'item_name', v_item_name, 'item_qty', v_item_qty,
    'stamina_cost', v_stamina_cost,
    'message', 'You caught ' || v_item_qty || 'x ' || v_item_name || '!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. beg — Begging skill RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.beg(
  p_character_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_char RECORD;
  v_skill_level int;
  v_stamina_cost int := 5;
  v_xp_gain int;
  v_gold_found int;
  v_item_name text;
  v_item_qty int;
  v_item_id uuid;
  v_existing_inv RECORD;
  v_success boolean;
  v_equip_spd int := 0;
  v_synergy_bonus int := 0;
  v_message text;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  SELECT COALESCE(level, 1) INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Begging';

  IF v_char.stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  -- Equipment speed bonus improves success
  SELECT COALESCE(SUM((i.stats->>'speed')::int), 0) INTO v_equip_spd
  FROM public.inventory inv
  JOIN public.items i ON i.id = inv.item_id
  WHERE inv.character_id = p_character_id AND inv.equipped = true;

  -- Gathering synergy: knowing resources helps find generous people
  SELECT COALESCE(level / 10, 0) INTO v_synergy_bonus FROM public.skills
  WHERE character_id = p_character_id AND name = 'Gathering';

  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  v_success := random() > GREATEST(0.15, 0.55 - v_skill_level * 0.04 - (v_char.speed + v_equip_spd) * 0.01);

  IF NOT v_success THEN
    v_xp_gain := 5 + floor(random() * 3)::int;
    PERFORM public.check_skill_xp(p_character_id, 'Begging', v_xp_gain);
    PERFORM public.compute_player_level(p_character_id);
    RETURN jsonb_build_object(
      'success', false, 'xp_gained', v_xp_gain,
      'gold', 0, 'item_name', null, 'item_qty', 0,
      'stamina_cost', v_stamina_cost,
      'message', 'You were turned away. Keep trying.'
    );
  END IF;

  v_gold_found := 1 + floor(random() * (2 + v_skill_level / 5))::int + v_synergy_bonus;
  UPDATE public.characters SET gold = gold + v_gold_found WHERE id = p_character_id;

  IF random() < 0.2 THEN
    v_item_name := (ARRAY['Old Bread', 'Rusty Coin', 'Torn Cloth', 'Cracked Pot'])[1 + floor(random() * 4)::int];
    v_item_qty := 1;

    SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'resource', 1)
      RETURNING id INTO v_item_id;
    END IF;

    SELECT id, quantity INTO v_existing_inv
    FROM public.inventory WHERE character_id = p_character_id AND item_id = v_item_id;

    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_item_id, v_item_qty);
    END IF;
    v_message := 'A kind soul gave you ' || v_gold_found || ' gold and ' || v_item_qty || 'x ' || v_item_name || '!';
  ELSE
    v_message := 'Someone gifted you ' || v_gold_found || ' gold!';
  END IF;

  v_xp_gain := 8 + floor(random() * 4)::int;
  PERFORM public.check_skill_xp(p_character_id, 'Begging', v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object(
    'success', true, 'xp_gained', v_xp_gain,
    'gold', v_gold_found, 'item_name', v_item_name,
    'item_qty', v_item_qty, 'stamina_cost', v_stamina_cost,
    'message', v_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. tame — Taming skill RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.tame(
  p_character_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_char RECORD;
  v_skill_level int;
  v_stamina_cost int := 10;
  v_xp_gain int;
  v_pet_type text;
  v_pet_name text;
  v_pet_id uuid;
  v_success boolean;
  v_equip_vit int := 0;
  v_synergy_bonus int := 0;
  v_message text;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  SELECT COALESCE(level, 1) INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Taming';

  IF v_char.stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  -- Equipment vitality bonus helps tame stronger creatures
  SELECT COALESCE(SUM((i.stats->>'vitality')::int), 0) INTO v_equip_vit
  FROM public.inventory inv
  JOIN public.items i ON i.id = inv.item_id
  WHERE inv.character_id = p_character_id AND inv.equipped = true;

  -- Hunting synergy: knowledge of animals helps taming
  SELECT COALESCE(level / 10, 0) INTO v_synergy_bonus FROM public.skills
  WHERE character_id = p_character_id AND name = 'Hunting';

  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  v_success := random() > GREATEST(0.2, 0.6 - v_skill_level * 0.04 - (v_char.vitality + v_equip_vit) * 0.01);

  IF NOT v_success THEN
    v_xp_gain := 8 + floor(random() * 4)::int;
    PERFORM public.check_skill_xp(p_character_id, 'Taming', v_xp_gain);
    PERFORM public.compute_player_level(p_character_id);
    RETURN jsonb_build_object(
      'success', false, 'xp_gained', v_xp_gain,
      'pet_name', null, 'pet_type', null,
      'stamina_cost', v_stamina_cost,
      'message', 'The creature resisted your efforts.'
    );
  END IF;

  -- Better pets unlock at higher levels with synergy bonus
  IF v_synergy_bonus >= 2 OR v_skill_level >= 25 THEN
    v_pet_type := (ARRAY['wolf', 'cat', 'hawk', 'boar', 'dog', 'snake'])[1 + floor(random() * 6)::int];
  ELSIF v_synergy_bonus >= 1 OR v_skill_level >= 10 THEN
    v_pet_type := (ARRAY['cat', 'dog', 'hawk'])[1 + floor(random() * 3)::int];
  ELSE
    v_pet_type := (ARRAY['cat', 'dog'])[1 + floor(random() * 2)::int];
  END IF;

  v_pet_name := (ARRAY['Shadow', 'Whisper', 'Fern', 'Ember', 'Clover', 'Briar', 'Rusty', 'Moss', 'Pine', 'Dusty'])[1 + floor(random() * 10)::int];

  INSERT INTO public.pets (character_id, name, type, equipped)
  VALUES (p_character_id, v_pet_name, v_pet_type, false)
  RETURNING id INTO v_pet_id;

  v_xp_gain := 15 + floor(random() * 6)::int;
  PERFORM public.check_skill_xp(p_character_id, 'Taming', v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object(
    'success', true, 'xp_gained', v_xp_gain,
    'pet_name', v_pet_name, 'pet_type', v_pet_type,
    'stamina_cost', v_stamina_cost,
    'message', 'You tamed a ' || v_pet_type || ' named ' || v_pet_name || '!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. handle_new_user — creates 8 skills for new signups
-- ============================================================
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
    (new_character_id, 'Mining', 1, 0),
    (new_character_id, 'Hunting', 1, 0),
    (new_character_id, 'Begging', 1, 0),
    (new_character_id, 'Taming', 1, 0);

  UPDATE public.characters
  SET level = compute_player_level(new_character_id)
  WHERE id = new_character_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
