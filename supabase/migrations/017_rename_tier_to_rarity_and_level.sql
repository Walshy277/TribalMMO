-- Migration 017: Rename tier → rarity (items) and tier → level (skills)
-- Rarity scale: 1=Common, 2=Uncommon, 3=Rare, 4=Ultra Rare, 5=Epic, 6=Legendary, 7=Mythical
-- Skills: tier → level (1-5)

-- ============================================================
-- ITEMS: Rename tier → rarity, scale values 1-5 → 1-7
-- ============================================================
ALTER TABLE public.items RENAME COLUMN tier TO rarity;

-- Scale: 1→1, 2→3, 3→4, 4→6, 5→7
UPDATE public.items SET rarity = 1 WHERE rarity = 1;
UPDATE public.items SET rarity = 3 WHERE rarity = 2;
UPDATE public.items SET rarity = 4 WHERE rarity = 3;
UPDATE public.items SET rarity = 6 WHERE rarity = 4;
UPDATE public.items SET rarity = 7 WHERE rarity = 5;

-- ============================================================
-- SHOP_ITEMS: Rename tier → rarity, scale values
-- ============================================================
ALTER TABLE public.shop_items RENAME COLUMN tier TO rarity;

UPDATE public.shop_items SET rarity = 1 WHERE rarity = 1;
UPDATE public.shop_items SET rarity = 3 WHERE rarity = 2;
UPDATE public.shop_items SET rarity = 4 WHERE rarity = 3;
UPDATE public.shop_items SET rarity = 6 WHERE rarity = 4;
UPDATE public.shop_items SET rarity = 7 WHERE rarity = 5;

-- ============================================================
-- SKILLS: Rename tier → level
-- ============================================================
ALTER TABLE public.skills RENAME COLUMN tier TO level;

-- ============================================================
-- RECREATE FUNCTIONS that reference renamed columns
-- ============================================================

-- Helper: skill level-up check
CREATE OR REPLACE FUNCTION public.advance_skill(p_skill_id uuid, p_xp_gain int)
RETURNS jsonb AS $$
DECLARE
  v_skill record;
  v_new_xp int;
  v_max_xp int;
  v_new_level int;
  v_leveled_up boolean;
BEGIN
  SELECT id, level, experience INTO v_skill
  FROM public.skills WHERE id = p_skill_id FOR UPDATE;

  v_new_xp := v_skill.experience + p_xp_gain;
  v_max_xp := v_skill.level * 100;

  IF v_new_xp >= v_max_xp AND v_skill.level < 5 THEN
    v_new_level := v_skill.level + 1;
    v_leveled_up := true;
  ELSE
    v_new_level := v_skill.level;
    v_leveled_up := false;
  END IF;

  UPDATE public.skills
  SET experience = v_new_xp, level = v_new_level
  WHERE id = p_skill_id;

  RETURN jsonb_build_object(
    'leveled_up', v_leveled_up,
    'new_level', v_new_level,
    'xp', v_new_xp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gather resource RPC (woodcutting/mining)
CREATE OR REPLACE FUNCTION public.gather_resource(
  p_character_id uuid,
  p_skill_name text,
  p_node_id text
)
RETURNS jsonb AS $$
DECLARE
  v_char record;
  v_skill record;
  v_skill_level int;
  v_stamina_cost int;
  v_xp_gain int;
  v_item_name text;
  v_item_qty int;
  v_item_rarity int;
  v_rare_drop numeric;
  v_rare_name text;
  v_resources jsonb;
  v_entry jsonb;
  v_total_weight numeric := 0;
  v_roll numeric;
  v_accum numeric := 0;
  v_found boolean := false;
BEGIN
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id FOR UPDATE;
  IF v_char IS NULL THEN RETURN jsonb_build_object('error', 'Character not found'); END IF;

  SELECT * INTO v_skill FROM public.skills
  WHERE character_id = p_character_id AND name = p_skill_name;
  IF v_skill IS NULL THEN RETURN jsonb_build_object('error', 'Skill not found'); END IF;

  v_skill_level := COALESCE(v_skill.level, 1);
  v_stamina_cost := 8 + GREATEST(0, (v_skill_level - 1) * 2);

  IF v_char.stamina < v_stamina_cost THEN
    RETURN jsonb_build_object('error', 'Not enough stamina');
  END IF;

  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  IF p_skill_name = 'Woodcutting' THEN
    v_resources := '[
      {"name":"Wood","min_level":1,"weight":50},
      {"name":"Oak Log","min_level":1,"weight":30},
      {"name":"Willow Log","min_level":2,"weight":25},
      {"name":"Maple Log","min_level":3,"weight":15},
      {"name":"Yew Log","min_level":4,"weight":8}
    ]'::jsonb;
  ELSE
    v_resources := '[
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
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_resources)
  LOOP
    IF (v_entry->>'min_level')::int <= v_skill_level THEN
      v_total_weight := v_total_weight + (v_entry->>'weight')::numeric;
    END IF;
  END LOOP;

  v_roll := random() * v_total_weight;
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_resources)
  LOOP
    IF (v_entry->>'min_level')::int <= v_skill_level THEN
      v_accum := v_accum + (v_entry->>'weight')::numeric;
      IF v_roll <= v_accum AND NOT v_found THEN
        v_item_name := v_entry->>'name';
        v_found := true;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_found THEN v_item_name := 'Wood'; END IF;

  v_item_qty := 1 + floor(random() * (1 + v_skill_level))::int;
  v_item_rarity := GREATEST(1, LEAST(7, v_skill_level));

  -- Rare drop
  v_rare_drop := random();
  IF v_rare_drop < 0.05 AND v_skill_level >= 3 THEN
    v_rare_name := CASE
      WHEN v_skill_level >= 5 THEN 'Diamond'
      WHEN v_skill_level >= 4 THEN 'Gold Ore'
      WHEN v_skill_level >= 3 THEN 'Silver Ore'
      ELSE 'Gemstone'
    END;
    INSERT INTO public.items (name, type, rarity) VALUES (v_rare_name, 'materials', v_skill_level + 1)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Ensure item exists
  INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'materials', v_item_rarity)
  ON CONFLICT DO NOTHING;

  -- Add to inventory
  DECLARE v_item_id uuid;
  BEGIN
    SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
    INSERT INTO public.inventory (character_id, item_id, quantity)
    VALUES (p_character_id, v_item_id, v_item_qty)
    ON CONFLICT (character_id, item_id)
    DO UPDATE SET quantity = public.inventory.quantity + v_item_qty;
  END;

  -- XP gain
  v_xp_gain := 3 + floor(random() * 5 + v_skill_level)::int;

  -- Advance skill
  PERFORM public.advance_skill(v_skill.id, v_xp_gain);

  RETURN jsonb_build_object(
    'success', true,
    'item_name', v_item_name,
    'item_qty', v_item_qty,
    'xp_gained', v_xp_gain,
    'level', v_skill_level,
    'stamina_cost', v_stamina_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Level system: update compute_player_level to use skills.level
CREATE OR REPLACE FUNCTION public.compute_player_level(p_character_id uuid)
RETURNS INTEGER AS $$
DECLARE
  total_level INTEGER;
BEGIN
  SELECT COALESCE(SUM(level), 0) INTO total_level
  FROM skills
  WHERE character_id = p_character_id;

  RETURN LEAST(total_level, 100);
END;
$$ LANGUAGE plpgsql;

-- Update on_skill_change trigger to use new column name
CREATE OR REPLACE FUNCTION public.update_character_level()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE characters
  SET level = compute_player_level(NEW.character_id)
  WHERE id = NEW.character_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Shop purchase RPC
CREATE OR REPLACE FUNCTION public.purchase_shop_item(
  p_character_id uuid,
  p_item_name text,
  p_item_type text,
  p_item_rarity int,
  p_item_stats jsonb,
  p_total_cost int,
  p_quantity int DEFAULT 1
)
RETURNS jsonb AS $$
DECLARE
  v_char record;
  v_item_id uuid;
BEGIN
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id FOR UPDATE;
  IF v_char IS NULL THEN RETURN jsonb_build_object('error', 'Character not found'); END IF;
  IF v_char.gold < p_total_cost THEN RETURN jsonb_build_object('error', 'Not enough gold'); END IF;

  UPDATE public.characters SET gold = gold - p_total_cost WHERE id = p_character_id;

  INSERT INTO public.items (name, type, rarity, stats)
  VALUES (p_item_name, p_item_type, p_item_rarity, p_item_stats)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_item_id FROM public.items WHERE name = p_item_name LIMIT 1;

  INSERT INTO public.inventory (character_id, item_id, quantity)
  VALUES (p_character_id, v_item_id, p_quantity)
  ON CONFLICT (character_id, item_id)
  DO UPDATE SET quantity = public.inventory.quantity + p_quantity;

  RETURN jsonb_build_object('success', true, 'remaining_gold', v_char.gold - p_total_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Craft item RPC
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
BEGIN
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id FOR UPDATE;
  IF v_char IS NULL THEN RETURN jsonb_build_object('error', 'Character not found'); END IF;

  -- Check stamina
  IF v_char.stamina < (10 + p_item_rarity * 3) THEN
    RETURN jsonb_build_object('error', 'Not enough stamina');
  END IF;

  -- Check and deduct materials
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

  -- Deduct stamina
  UPDATE public.characters
  SET stamina = stamina - (10 + p_item_rarity * 3), stamina_updated_at = now()
  WHERE id = p_character_id;

  -- Create item
  INSERT INTO public.items (name, type, rarity, stats)
  VALUES (p_item_name, p_item_type, p_item_rarity, p_item_stats)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_item_id FROM public.items WHERE name = p_item_name LIMIT 1;

  INSERT INTO public.inventory (character_id, item_id, quantity)
  VALUES (p_character_id, v_item_id, 1)
  ON CONFLICT (character_id, item_id)
  DO UPDATE SET quantity = public.inventory.quantity + 1;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Listing purchase RPC
CREATE OR REPLACE FUNCTION public.purchase_listing(
  p_listing_id uuid,
  p_buyer_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_listing record;
  v_item record;
  v_buyer record;
BEGIN
  SELECT * INTO v_listing FROM public.marketplace_listings WHERE id = p_listing_id FOR UPDATE;
  IF v_listing IS NULL THEN RETURN jsonb_build_object('error', 'Listing not found'); END IF;
  IF v_listing.seller_id = p_buyer_id THEN RETURN jsonb_build_object('error', 'Cannot buy your own listing'); END IF;

  SELECT * INTO v_buyer FROM public.characters WHERE id = p_buyer_id FOR UPDATE;
  IF v_buyer IS NULL THEN RETURN jsonb_build_object('error', 'Buyer not found'); END IF;
  IF v_buyer.gold < v_listing.price THEN RETURN jsonb_build_object('error', 'Not enough gold'); END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_listing.item_id;
  IF v_item IS NULL THEN RETURN jsonb_build_object('error', 'Item not found'); END IF;

  -- Deduct gold from buyer
  UPDATE public.characters SET gold = gold - v_listing.price WHERE id = p_buyer_id;
  -- Add gold to seller
  UPDATE public.characters SET gold = gold + v_listing.price WHERE id = v_listing.seller_id;

  -- Transfer item
  DELETE FROM public.inventory WHERE id = v_listing.inventory_id;
  INSERT INTO public.inventory (character_id, item_id, quantity)
  VALUES (p_buyer_id, v_listing.item_id, v_listing.quantity);

  -- Remove listing
  DELETE FROM public.marketplace_listings WHERE id = p_listing_id;

  -- Log transactions
  INSERT INTO public.transactions (character_id, type, amount, description)
  VALUES (p_buyer_id, 'purchase', -v_listing.price, 'Bought ' || v_item.name || ' x' || v_listing.quantity);
  INSERT INTO public.transactions (character_id, type, amount, description)
  VALUES (v_listing.seller_id, 'sale', v_listing.price, 'Sold ' || v_item.name || ' x' || v_listing.quantity);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: update skill level
CREATE OR REPLACE FUNCTION public.admin_update_skill_level(
  p_character_id uuid,
  p_skill_name text,
  p_new_level int
)
RETURNS void AS $$
BEGIN
  UPDATE public.skills
  SET level = GREATEST(1, LEAST(5, p_new_level))
  WHERE character_id = p_character_id AND name = p_skill_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
