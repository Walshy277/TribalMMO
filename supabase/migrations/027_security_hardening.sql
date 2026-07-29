-- Migration 027: Security hardening + skill level recalibration
-- 1. Authenticated ownership guard for all game RPCs
-- 2. Recalculate skill levels from actual XP using RS curve
-- 3. Revoke PUBLIC EXECUTE on admin/internal functions

-- ============================================================
-- 1A. HELPER: assert that the calling user owns the character
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_character_owner(p_character_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.characters WHERE id = p_character_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify this character';
  END IF;
END;
$$;

-- ============================================================
-- 1B. HELPER: derive skill level from RS XP curve
-- ============================================================
CREATE OR REPLACE FUNCTION public.level_from_xp(p_experience int)
RETURNS int
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_level int := 1;
BEGIN
  WHILE v_level < 99 AND p_experience >= public.xp_for_level(v_level + 1) LOOP
    v_level := v_level + 1;
  END LOOP;
  RETURN v_level;
END;
$$;

-- ============================================================
-- 2. RECALCULATE: reset all skill levels to match RS curve
-- ============================================================
UPDATE public.skills
SET level = public.level_from_xp(experience);

-- Recompute player levels
UPDATE public.characters c
SET level = (
  SELECT COALESCE(SUM(level), 0) FROM public.skills WHERE character_id = c.id
);

-- ============================================================
-- 3. REVOKE PUBLIC EXECUTE on admin/internal functions
-- ============================================================
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_update_skill_level(uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.advance_skill(uuid, int) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 4A. Add ownership guard to all game RPCs (migration 026)
-- ============================================================

CREATE OR REPLACE FUNCTION public.train(
  p_character_id uuid,
  p_activity text
)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_xp_gain int;
  v_stamina_cost int;
  v_skill_name text := 'Combat';
  v_activity_label text;
  v_skill_level int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
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

  RETURN jsonb_build_object(
    'activity', v_activity_label, 'skill', v_skill_name,
    'xp_gain', v_xp_gain, 'stamina_cost', v_stamina_cost,
    'coin_reward', 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  v_item_qty int := 1;
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
  PERFORM public.assert_character_owner(p_character_id);
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

  v_rare_drop := random();
  IF v_rare_drop < 0.02 THEN
    v_item_qty := 5 + floor(random() * 6)::int;
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

  v_xp_gain := GREATEST(10, v_skill_level * 3 + floor(random() * (v_skill_level / 2 + 1))::int);
  PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object(
    'success', true, 'item_name', v_item_name,
    'item_qty', v_item_qty, 'xp_gained', v_xp_gain,
    'message', 'Found ' || v_item_qty || 'x ' || v_item_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.shop_buy(
  p_character_id uuid,
  p_item_name text,
  p_item_type text,
  p_item_rarity int,
  p_item_stats jsonb,
  p_total_cost int,
  p_quantity int
)
RETURNS void AS $$
DECLARE
  v_item_id uuid;
  v_existing_inv RECORD;
  v_shop_item RECORD;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  IF (SELECT gold FROM public.characters WHERE id = p_character_id) < p_total_cost THEN
    RAISE EXCEPTION 'Not enough gold';
  END IF;

  SELECT id, name, type, rarity, description, buy_price, sell_price, stock, stats, created_at, gold_pool, max_gold, last_restocked_at
  INTO v_shop_item FROM public.shop_items WHERE name = p_item_name LIMIT 1;

  IF FOUND AND v_shop_item.stock != -1 AND v_shop_item.stock < p_quantity THEN
    RAISE EXCEPTION 'Not enough stock in shop';
  END IF;

  UPDATE public.characters SET gold = gold - p_total_cost WHERE id = p_character_id;

  IF FOUND THEN
    UPDATE public.shop_items
    SET gold_pool = LEAST(max_gold, gold_pool + p_total_cost),
        stock = CASE WHEN stock != -1 THEN stock - p_quantity ELSE stock END
    WHERE id = v_shop_item.id;
  END IF;

  SELECT id INTO v_item_id FROM public.items WHERE name = p_item_name LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.items (name, type, rarity, stats)
    VALUES (p_item_name, p_item_type, p_item_rarity, p_item_stats)
    RETURNING id INTO v_item_id;
  END IF;

  SELECT id, quantity INTO v_existing_inv
  FROM public.inventory
  WHERE character_id = p_character_id AND item_id = v_item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_existing_inv.quantity + p_quantity
    WHERE id = v_existing_inv.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity)
    VALUES (p_character_id, v_item_id, p_quantity);
  END IF;

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'shop_buy', -p_total_cost,
    'Bought ' || p_quantity || 'x ' || p_item_name || ' from shop',
    jsonb_build_object('item_name', p_item_name, 'quantity', p_quantity, 'unit_price', p_total_cost / p_quantity)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.shop_sell(
  p_character_id uuid,
  p_inventory_id uuid,
  p_quantity int,
  p_total_value int,
  p_item_name text
)
RETURNS void AS $$
DECLARE
  v_inv RECORD;
  v_new_qty int;
  v_shop_item RECORD;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_inv FROM public.inventory
  WHERE id = p_inventory_id AND character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;

  SELECT * INTO v_shop_item FROM public.shop_items WHERE name = p_item_name LIMIT 1;

  IF v_shop_item.id IS NOT NULL THEN
    IF v_shop_item.gold_pool < p_total_value THEN
      RAISE EXCEPTION 'Shop cannot afford that right now (has % gold, needs %)', v_shop_item.gold_pool, p_total_value;
    END IF;
    UPDATE public.shop_items
    SET gold_pool = gold_pool - p_total_value,
        stock = CASE WHEN stock != -1 THEN stock + p_quantity ELSE stock END
    WHERE id = v_shop_item.id;
  END IF;

  UPDATE public.characters SET gold = gold + p_total_value WHERE id = p_character_id;

  v_new_qty := v_inv.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = p_inventory_id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = p_inventory_id;
  END IF;

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'shop_sell', p_total_value,
    'Sold ' || p_quantity || 'x ' || p_item_name || ' to shop',
    jsonb_build_object('item_name', p_item_name, 'quantity', p_quantity, 'unit_price', p_total_value / p_quantity)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_listing(
  p_character_id uuid,
  p_item_id uuid,
  p_quantity int,
  p_price int
)
RETURNS void AS $$
DECLARE
  v_inv RECORD;
  v_fee int;
  v_active int;
  v_new_qty int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_inv FROM public.inventory
  WHERE character_id = p_character_id AND item_id = p_item_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found in inventory'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;

  v_active := public.active_listing_count(p_character_id);
  IF v_active >= 5 THEN
    RAISE EXCEPTION 'You already have % active listings (max 5)', v_active;
  END IF;

  v_fee := GREATEST(1, p_price / 100);
  IF (SELECT gold FROM public.characters WHERE id = p_character_id) < v_fee THEN
    RAISE EXCEPTION 'Not enough gold for listing fee (%)', v_fee;
  END IF;

  UPDATE public.characters SET gold = gold - v_fee WHERE id = p_character_id;

  v_new_qty := v_inv.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = v_inv.id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = v_inv.id;
  END IF;

  INSERT INTO public.marketplace_listings (seller_id, item_id, quantity, price)
  VALUES (p_character_id, p_item_id, p_quantity, p_price);

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'marketplace_listing_fee', -v_fee,
    'Listing fee for ' || p_quantity || 'x items at ' || p_price || 'g each',
    jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity, 'price', p_price, 'fee', v_fee)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_auction(
  p_character_id uuid,
  p_item_id uuid,
  p_quantity int,
  p_starting_price int,
  p_duration_seconds int
)
RETURNS void AS $$
DECLARE
  v_inv RECORD;
  v_fee int;
  v_active int;
  v_new_qty int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_inv FROM public.inventory
  WHERE character_id = p_character_id AND item_id = p_item_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found in inventory'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;

  v_active := public.active_listing_count(p_character_id);
  IF v_active >= 5 THEN
    RAISE EXCEPTION 'You already have % active listings (max 5)', v_active;
  END IF;

  v_fee := GREATEST(1, (p_starting_price * 3) / 100);
  IF (SELECT gold FROM public.characters WHERE id = p_character_id) < v_fee THEN
    RAISE EXCEPTION 'Not enough gold for auction fee (%)', v_fee;
  END IF;

  UPDATE public.characters SET gold = gold - v_fee WHERE id = p_character_id;

  v_new_qty := v_inv.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = v_inv.id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = v_inv.id;
  END IF;

  INSERT INTO public.auction_house (seller_id, item_id, quantity, starting_price, current_bid, ends_at)
  VALUES (p_character_id, p_item_id, p_quantity, p_starting_price, p_starting_price, now() + (p_duration_seconds || ' seconds')::interval);

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'auction_listing_fee', -v_fee,
    'Auction fee for ' || p_quantity || 'x items starting at ' || p_starting_price || 'g',
    jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity, 'starting_price', p_starting_price, 'fee', v_fee)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.shrine_donate(
  p_character_id uuid,
  p_inventory_id uuid,
  p_quantity int
)
RETURNS int AS $$
DECLARE
  v_inv RECORD;
  v_item_name text;
  v_new_qty int;
  v_xp_reward int;
  v_skill_level int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT inv.*, i.name INTO v_inv
  FROM public.inventory inv
  JOIN public.items i ON i.id = inv.item_id
  WHERE inv.id = p_inventory_id AND inv.character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;

  v_item_name := v_inv.name;

  v_new_qty := v_inv.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = p_inventory_id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = p_inventory_id;
  END IF;

  INSERT INTO public.shrine_donations (character_id, item_name, quantity)
  VALUES (p_character_id, v_item_name, p_quantity);

  SELECT level INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Gathering';
  v_skill_level := COALESCE(v_skill_level, 1);

  v_xp_reward := p_quantity * GREATEST(5, v_skill_level * 2);
  PERFORM public.check_skill_xp(p_character_id, 'Gathering', v_xp_reward);
  PERFORM public.compute_player_level(p_character_id);

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'shrine_donate', 0,
    'Donated ' || p_quantity || 'x ' || v_item_name || ' to shrine',
    jsonb_build_object('item_name', v_item_name, 'quantity', p_quantity, 'xp_reward', v_xp_reward)
  );

  RETURN v_xp_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.shrine_pray(
  p_character_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_blessed boolean;
  v_stat text;
  v_bonus int;
  v_char record;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;

  v_blessed := random() < 0.4;

  IF v_blessed THEN
    v_stat := (ARRAY['strength', 'defence', 'speed', 'vitality'])[floor(random() * 4 + 1)];
    v_bonus := 1;
    EXECUTE format('UPDATE public.characters SET %I = %I + %s WHERE id = $1', v_stat, v_stat, v_bonus)
    USING p_character_id;
  END IF;

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'shrine_pray', 0,
    CASE WHEN v_blessed THEN 'Prayer answered: +1 ' || v_stat ELSE 'Prayer unanswered' END,
    jsonb_build_object('blessed', v_blessed, 'stat', COALESCE(v_stat, 'none'), 'bonus', COALESCE(v_bonus, 0))
  );

  RETURN jsonb_build_object(
    'blessed', v_blessed,
    'stat', COALESCE(v_stat, 'none'),
    'bonus', COALESCE(v_bonus, 0),
    'message', CASE WHEN v_blessed THEN 'The spirits smile upon you! +1 ' || v_stat ELSE 'You feel no response...' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.claim_daily_reward(p_character_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_last_claimed timestamptz;
  v_streak int;
  v_now timestamptz := now();
  v_day int;
  v_gold int := 0;
  v_treasure_coins int := 0;
  v_bonus_item text := '';
  v_bonus_qty int := 0;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT last_claimed_at, streak INTO v_last_claimed, v_streak
  FROM public.daily_rewards WHERE character_id = p_character_id;

  IF v_last_claimed IS NOT NULL AND v_last_claimed::date = v_now::date THEN
    RAISE EXCEPTION 'Already claimed today';
  END IF;

  IF v_last_claimed IS NULL OR v_now > v_last_claimed + interval '48 hours' THEN
    v_streak := 1;
  ELSIF v_now > v_last_claimed + interval '24 hours' THEN
    v_streak := v_streak + 1;
  ELSE
    RAISE EXCEPTION 'Too early to claim';
  END IF;

  v_day := v_streak;
  IF v_day > 7 THEN v_day := 7; END IF;

  CASE v_day
    WHEN 1 THEN v_gold := 5;
    WHEN 2 THEN v_gold := 10;
    WHEN 3 THEN v_gold := 15;
    WHEN 4 THEN v_gold := 20; v_treasure_coins := 1;
    WHEN 5 THEN v_gold := 25;
    WHEN 6 THEN v_gold := 30;
    WHEN 7 THEN v_gold := 50; v_treasure_coins := 3;
    ELSE v_gold := 5;
  END CASE;

  IF v_gold > 0 THEN
    UPDATE public.characters SET gold = gold + v_gold WHERE id = p_character_id;
  END IF;

  IF v_treasure_coins > 0 THEN
    UPDATE public.characters SET treasure_coins = treasure_coins + v_treasure_coins
    WHERE id = p_character_id;
  END IF;

  IF v_day = 4 THEN
    INSERT INTO public.inventory (character_id, item_id, quantity)
    SELECT p_character_id, id, 5 FROM public.items WHERE name = 'Wild Herbs' LIMIT 1;
    v_bonus_item := 'Wild Herbs'; v_bonus_qty := 5;
  ELSIF v_day = 7 THEN
    INSERT INTO public.inventory (character_id, item_id, quantity)
    SELECT p_character_id, id, 2 FROM public.items WHERE name = 'Stamina Potion' LIMIT 1;
    v_bonus_item := 'Stamina Potion'; v_bonus_qty := 2;
  END IF;

  INSERT INTO public.daily_rewards (character_id, last_claimed_at, streak)
  VALUES (p_character_id, v_now, v_streak)
  ON CONFLICT (character_id)
  DO UPDATE SET last_claimed_at = v_now, streak = v_streak;

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'daily_reward', v_gold,
    'Daily reward day ' || v_day || ': ' || v_gold || ' gold' ||
    CASE WHEN v_treasure_coins > 0 THEN ', ' || v_treasure_coins || ' treasure coins' ELSE '' END,
    jsonb_build_object('day', v_day, 'gold', v_gold, 'treasure_coins', v_treasure_coins, 'streak', v_streak)
  );

  RETURN jsonb_build_object(
    'day', v_day, 'gold', v_gold, 'treasure_coins', v_treasure_coins,
    'bonus_item', v_bonus_item, 'bonus_qty', v_bonus_qty, 'streak', v_streak
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  v_gold_cost int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id FOR UPDATE;
  IF v_char IS NULL THEN RETURN jsonb_build_object('error', 'Character not found'); END IF;

  IF v_char.stamina < (10 + p_item_rarity * 3) THEN
    RETURN jsonb_build_object('error', 'Not enough stamina');
  END IF;

  SELECT level INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Crafting';
  v_skill_level := COALESCE(v_skill_level, 1);

  v_gold_cost := CASE p_item_rarity
    WHEN 1 THEN 1
    WHEN 2 THEN 3
    WHEN 3 THEN 8
    WHEN 4 THEN 15
    WHEN 5 THEN 25
    WHEN 6 THEN 40
    ELSE 1
  END;

  IF v_char.gold < v_gold_cost THEN
    RETURN jsonb_build_object('error', 'Not enough gold (need ' || v_gold_cost || ')');
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
  SET stamina = stamina - (10 + p_item_rarity * 3), stamina_updated_at = now(),
      gold = gold - v_gold_cost
  WHERE id = p_character_id;

  INSERT INTO public.items (name, type, rarity, stats)
  VALUES (p_item_name, p_item_type, p_item_rarity, p_item_stats)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_item_id FROM public.items WHERE name = p_item_name LIMIT 1;

  SELECT id, quantity INTO v_inv FROM public.inventory
  WHERE character_id = p_character_id AND item_id = v_item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_inv.quantity + 1 WHERE id = v_inv.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity)
    VALUES (p_character_id, v_item_id, 1);
  END IF;

  v_xp_gain := GREATEST(10, p_item_rarity * 25 + floor(random() * 20)::int);
  PERFORM public.check_skill_xp(p_character_id, 'Crafting', v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'crafting_fee', -v_gold_cost,
    'Crafted ' || p_item_name || ' (rarity ' || p_item_rarity || ')',
    jsonb_build_object('item_name', p_item_name, 'rarity', p_item_rarity, 'gold_cost', v_gold_cost)
  );

  RETURN jsonb_build_object(
    'success', true, 'item_name', p_item_name, 'item_id', v_item_id,
    'xp_gained', v_xp_gain, 'gold_cost', v_gold_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.resolve_combat_win(p_character_id uuid, p_xp_reward int)
RETURNS jsonb AS $$
DECLARE
  v_gold_reward int;
  v_char record;
  v_combat_level int;
  v_xp_gain int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF v_char IS NULL THEN RETURN jsonb_build_object('xp', 0, 'gold', 0); END IF;

  SELECT COALESCE(level, 1) INTO v_combat_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Combat';

  v_xp_gain := GREATEST(10, p_xp_reward * 2 + floor(random() * (p_xp_reward / 2 + 1))::int);
  PERFORM public.check_skill_xp(p_character_id, 'Combat', v_xp_gain);

  v_gold_reward := GREATEST(1, floor(v_combat_level * (0.5 + random() * 1.0))::int);
  UPDATE public.characters SET gold = gold + v_gold_reward WHERE id = p_character_id;
  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object('xp', v_xp_gain, 'gold', v_gold_reward);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.resolve_combat_loss(p_character_id uuid, p_stamina_cost int)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  UPDATE public.characters
  SET stamina = GREATEST(0, stamina - p_stamina_cost), stamina_updated_at = now()
  WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.repair_item(
  p_character_id uuid,
  p_inventory_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_inv RECORD;
  v_cost int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_inv FROM public.inventory
  WHERE id = p_inventory_id AND character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_inv.durability IS NULL THEN RAISE EXCEPTION 'Item cannot be repaired'; END IF;
  IF v_inv.durability >= v_inv.max_durability THEN
    RETURN jsonb_build_object('success', false, 'message', 'Item is already at full durability');
  END IF;

  v_cost := (v_inv.max_durability - v_inv.durability) * 2;

  IF (SELECT gold FROM public.characters WHERE id = p_character_id) < v_cost THEN
    RAISE EXCEPTION 'Not enough gold (need %)', v_cost;
  END IF;

  UPDATE public.characters SET gold = gold - v_cost WHERE id = p_character_id;

  UPDATE public.inventory
  SET durability = max_durability
  WHERE id = p_inventory_id;

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'repair', -v_cost,
    'Repaired item for ' || v_cost || ' gold',
    jsonb_build_object('inventory_id', p_inventory_id, 'cost', v_cost,
      'durability_restored', v_inv.max_durability - v_inv.durability)
  );

  RETURN jsonb_build_object('success', true, 'cost', v_cost, 'message', 'Item repaired for ' || v_cost || ' gold');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4B. Add ownership guard (migration 025 functions)
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
  PERFORM public.assert_character_owner(p_character_id);
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
  PERFORM public.assert_character_owner(p_character_id);
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

-- ============================================================
-- 4C. Add ownership guard (migration 021 clan functions)
-- ============================================================

CREATE OR REPLACE FUNCTION public.donate_to_clan(
  p_character_id uuid,
  p_food int DEFAULT 0,
  p_wood int DEFAULT 0,
  p_stone int DEFAULT 0,
  p_gold int DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_clan_id uuid;
  v_char_name text;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT cm.clan_id, c.name INTO v_clan_id, v_char_name
  FROM public.clan_members cm
  JOIN public.characters c ON c.id = cm.character_id
  WHERE cm.character_id = p_character_id;

  IF v_clan_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a clan.';
  END IF;

  UPDATE public.characters
  SET gold = gold - p_gold
  WHERE id = p_character_id AND gold >= p_gold;

  UPDATE public.clans
  SET
    food = food + p_food,
    wood = wood + p_wood,
    stone = stone + p_stone,
    morale = LEAST(100, morale + CASE WHEN (p_food + p_wood + p_stone + p_gold) > 0 THEN 1 ELSE 0 END)
  WHERE id = v_clan_id;

  UPDATE public.clan_members
  SET
    total_donated_wood = total_donated_wood + p_wood,
    total_donated_stone = total_donated_stone + p_stone,
    total_donated_food = total_donated_food + p_food,
    total_donated_gold = total_donated_gold + p_gold
  WHERE character_id = p_character_id;

  PERFORM public.add_clan_event(
    v_clan_id,
    'donation',
    CASE
      WHEN p_food > 0 AND p_wood = 0 AND p_stone = 0 AND p_gold = 0 THEN v_char_name || ' donated ' || p_food || ' Food'
      WHEN p_wood > 0 AND p_food = 0 AND p_stone = 0 AND p_gold = 0 THEN v_char_name || ' donated ' || p_wood || ' Wood'
      WHEN p_stone > 0 AND p_food = 0 AND p_wood = 0 AND p_gold = 0 THEN v_char_name || ' donated ' || p_stone || ' Stone'
      WHEN p_gold > 0 AND p_food = 0 AND p_wood = 0 AND p_stone = 0 THEN v_char_name || ' donated ' || p_gold || ' Gold'
      ELSE v_char_name || ' donated resources'
    END,
    p_character_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_clan_project(
  p_character_id uuid,
  p_name text,
  p_description text,
  p_total_wood int DEFAULT 0,
  p_total_stone int DEFAULT 0,
  p_total_food int DEFAULT 0,
  p_reward_description text DEFAULT NULL,
  p_reward_type text DEFAULT NULL,
  p_reward_value text DEFAULT NULL,
  p_icon text DEFAULT 'building'
)
RETURNS void AS $$
DECLARE
  v_clan_id uuid;
  v_role text;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT cm.clan_id, cm.role INTO v_clan_id, v_role
  FROM public.clan_members cm
  WHERE cm.character_id = p_character_id;

  IF v_role NOT IN ('chieftain', 'elder') THEN
    RAISE EXCEPTION 'Only Chieftains and Elders can create projects.';
  END IF;

  INSERT INTO public.clan_projects (clan_id, name, description, icon, total_wood, total_stone, total_food, reward_description, reward_type, reward_value)
  VALUES (v_clan_id, p_name, p_description, p_icon, p_total_wood, p_total_stone, p_total_food, p_reward_description, p_reward_type, p_reward_value);

  PERFORM public.add_clan_event(v_clan_id, 'project_started', 'A new project has started: ' || p_name, p_character_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4D. Add ownership guard (migration 020 functions)
-- ============================================================

CREATE OR REPLACE FUNCTION public.start_action(
  p_character_id uuid,
  p_type text,
  p_duration int,
  p_skill_name text,
  p_stamina_cost int,
  p_result jsonb DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_stamina int;
  v_active_count int;
  v_crafting_level int;
  v_max_slots int;
  v_completes_at timestamptz;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < p_stamina_cost THEN RAISE EXCEPTION 'Not enough stamina'; END IF;

  SELECT count(*) INTO v_active_count FROM public.actions WHERE character_id = p_character_id;

  SELECT level INTO v_crafting_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Crafting';

  v_max_slots := CASE WHEN COALESCE(v_crafting_level, 1) >= 10 THEN 2 ELSE 1 END;

  IF v_active_count >= v_max_slots THEN
    RAISE EXCEPTION 'All action slots are full';
  END IF;

  v_completes_at := now() + (p_duration || ' seconds')::interval;

  UPDATE public.characters
  SET stamina = stamina - p_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  INSERT INTO public.actions (character_id, type, duration, completes_at, result)
  VALUES (p_character_id, p_type, p_duration, v_completes_at, p_result);

  PERFORM public.check_skill_xp(p_character_id, p_skill_name, p_duration / 30);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.complete_action(
  p_character_id uuid,
  p_action_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_action RECORD;
  v_rewards jsonb := '[]'::jsonb;
  v_reward jsonb;
  v_coin_reward int;
  v_item_id uuid;
  v_existing_inv RECORD;
  v_resource RECORD;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_action FROM public.actions
  WHERE id = p_action_id AND character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Action not found'; END IF;
  IF now() < v_action.completes_at THEN RAISE EXCEPTION 'Action not complete yet'; END IF;

  IF v_action.type = 'gathering' THEN
    IF v_action.result ? 'resources' THEN
      FOR v_resource IN
        SELECT * FROM jsonb_to_recordset(v_action.result->'resources')
          AS x(name text, quantity int)
      LOOP
        PERFORM public.give_item(p_character_id, v_resource.name, v_resource.quantity);
        v_reward := jsonb_build_object('item_name', v_resource.name, 'quantity', v_resource.quantity);
        v_rewards := v_rewards || v_reward;
      END LOOP;
    END IF;

    v_coin_reward := floor(random() * 5) + 1;
    UPDATE public.characters SET gold = gold + v_coin_reward WHERE id = p_character_id;
    v_rewards := v_rewards || jsonb_build_object('item_name', 'Gold', 'quantity', v_coin_reward);

  ELSIF v_action.type = 'crafting' THEN
    IF v_action.result ? 'item_name' THEN
      PERFORM public.give_item(p_character_id, v_action.result->>'item_name', 1);
      v_rewards := jsonb_build_array(
        jsonb_build_object('item_name', v_action.result->>'item_name', 'quantity', 1)
      );
    END IF;

  ELSIF v_action.type = 'training' THEN
    v_coin_reward := floor(random() * 8) + 2;
    UPDATE public.characters SET gold = gold + v_coin_reward WHERE id = p_character_id;
    v_rewards := jsonb_build_array(
      jsonb_build_object('item_name', 'Gold', 'quantity', v_coin_reward)
    );
  END IF;

  DELETE FROM public.actions WHERE id = p_action_id;

  RETURN jsonb_build_object('rewards', v_rewards);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.give_item(p_character_id uuid, p_item_name text, p_quantity int)
RETURNS void AS $$
DECLARE
  v_item_id uuid;
  v_existing RECORD;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT id INTO v_item_id FROM public.items WHERE name = p_item_name LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.items (name, type, rarity) VALUES (p_item_name, 'materials', 1)
    RETURNING id INTO v_item_id;
  END IF;

  SELECT id, quantity INTO v_existing FROM public.inventory
  WHERE character_id = p_character_id AND item_id = v_item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_existing.quantity + p_quantity WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity)
    VALUES (p_character_id, v_item_id, p_quantity);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.join_clan(p_character_id uuid, p_clan_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  IF EXISTS (SELECT 1 FROM public.clan_members WHERE character_id = p_character_id) THEN
    RAISE EXCEPTION 'You are already in a clan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clans WHERE id = p_clan_id) THEN
    RAISE EXCEPTION 'Clan not found';
  END IF;

  INSERT INTO public.clan_members (clan_id, character_id, role)
  VALUES (p_clan_id, p_character_id, 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.leave_clan(p_character_id uuid)
RETURNS void AS $$
DECLARE
  v_member RECORD;
  v_remaining int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_member FROM public.clan_members WHERE character_id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'You are not in a clan'; END IF;

  IF v_member.role = 'chieftain' THEN
    SELECT count(*) INTO v_remaining FROM public.clan_members
    WHERE clan_id = v_member.clan_id AND character_id != p_character_id;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Transfer leadership or remove all members before leaving';
    END IF;

    DELETE FROM public.clans WHERE id = v_member.clan_id;
  END IF;

  DELETE FROM public.clan_members WHERE character_id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.place_bid(p_character_id uuid, p_auction_id uuid, p_bid_amount int)
RETURNS void AS $$
DECLARE
  v_auction RECORD;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_auction FROM public.auction_house WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auction not found'; END IF;
  IF now() >= v_auction.ends_at THEN RAISE EXCEPTION 'Auction has ended'; END IF;
  IF v_auction.seller_id = p_character_id THEN RAISE EXCEPTION 'Cannot bid on your own auction'; END IF;
  IF p_bid_amount <= v_auction.current_bid THEN RAISE EXCEPTION 'Bid must be higher than current bid'; END IF;
  IF (SELECT gold FROM public.characters WHERE id = p_character_id) < p_bid_amount THEN
    RAISE EXCEPTION 'Not enough gold';
  END IF;

  IF v_auction.current_bidder_id IS NOT NULL THEN
    UPDATE public.characters SET gold = gold + v_auction.current_bid
    WHERE id = v_auction.current_bidder_id;
  END IF;

  UPDATE public.characters SET gold = gold - p_bid_amount WHERE id = p_character_id;

  UPDATE public.auction_house
  SET current_bid = p_bid_amount, current_bidder_id = p_character_id
  WHERE id = p_auction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clan functions with p_chieftain_id parameter (guard against owner of the character)
CREATE OR REPLACE FUNCTION public.kick_clan_member(p_chieftain_id uuid, p_target_id uuid)
RETURNS void AS $$
DECLARE
  v_chieftain_clan uuid;
BEGIN
  PERFORM public.assert_character_owner(p_chieftain_id);
  SELECT clan_id INTO v_chieftain_clan FROM public.clan_members
  WHERE character_id = p_chieftain_id AND role = 'chieftain';

  IF NOT FOUND THEN RAISE EXCEPTION 'You are not a chieftain'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clan_members
    WHERE character_id = p_target_id AND clan_id = v_chieftain_clan AND role != 'chieftain'
  ) THEN
    RAISE EXCEPTION 'Cannot kick this member';
  END IF;

  DELETE FROM public.clan_members WHERE character_id = p_target_id AND clan_id = v_chieftain_clan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.promote_clan_member(p_chieftain_id uuid, p_target_id uuid)
RETURNS void AS $$
DECLARE
  v_chieftain_clan uuid;
  v_target RECORD;
  v_new_role text;
BEGIN
  PERFORM public.assert_character_owner(p_chieftain_id);
  SELECT clan_id INTO v_chieftain_clan FROM public.clan_members
  WHERE character_id = p_chieftain_id AND role = 'chieftain';

  IF NOT FOUND THEN RAISE EXCEPTION 'You are not a chieftain'; END IF;

  SELECT * INTO v_target FROM public.clan_members
  WHERE character_id = p_target_id AND clan_id = v_chieftain_clan;

  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found in your clan'; END IF;
  IF v_target.role = 'chieftain' THEN RAISE EXCEPTION 'Cannot promote the chieftain'; END IF;

  v_new_role := CASE v_target.role
    WHEN 'member' THEN 'crafter'
    WHEN 'crafter' THEN 'gatherer'
    WHEN 'gatherer' THEN 'hunter'
    WHEN 'hunter' THEN 'elder'
    ELSE v_target.role
  END;

  IF v_new_role = 'elder' THEN
    UPDATE public.clan_members SET role = 'member' WHERE clan_id = v_chieftain_clan AND role = 'elder';
  END IF;

  UPDATE public.clan_members SET role = v_new_role WHERE id = v_target.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.demote_clan_member(p_chieftain_id uuid, p_target_id uuid)
RETURNS void AS $$
DECLARE
  v_chieftain_clan uuid;
  v_target RECORD;
  v_new_role text;
BEGIN
  PERFORM public.assert_character_owner(p_chieftain_id);
  SELECT clan_id INTO v_chieftain_clan FROM public.clan_members
  WHERE character_id = p_chieftain_id AND role = 'chieftain';

  IF NOT FOUND THEN RAISE EXCEPTION 'You are not a chieftain'; END IF;

  SELECT * INTO v_target FROM public.clan_members
  WHERE character_id = p_target_id AND clan_id = v_chieftain_clan;

  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found in your clan'; END IF;
  IF v_target.role = 'chieftain' THEN RAISE EXCEPTION 'Cannot demote the chieftain'; END IF;
  IF v_target.role = 'member' THEN RAISE EXCEPTION 'Cannot demote further'; END IF;

  v_new_role := CASE v_target.role
    WHEN 'elder' THEN 'hunter'
    WHEN 'hunter' THEN 'gatherer'
    WHEN 'gatherer' THEN 'crafter'
    WHEN 'crafter' THEN 'member'
    ELSE v_target.role
  END;

  UPDATE public.clan_members SET role = v_new_role WHERE id = v_target.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.transfer_chieftain(p_chieftain_id uuid, p_target_id uuid)
RETURNS void AS $$
DECLARE
  v_chieftain_clan uuid;
BEGIN
  PERFORM public.assert_character_owner(p_chieftain_id);
  SELECT clan_id INTO v_chieftain_clan FROM public.clan_members
  WHERE character_id = p_chieftain_id AND role = 'chieftain';

  IF NOT FOUND THEN RAISE EXCEPTION 'You are not a chieftain'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clan_members
    WHERE character_id = p_target_id AND clan_id = v_chieftain_clan
  ) THEN
    RAISE EXCEPTION 'Target not in your clan';
  END IF;

  UPDATE public.clan_members SET role = 'member' WHERE character_id = p_chieftain_id;
  UPDATE public.clan_members SET role = 'chieftain' WHERE character_id = p_target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4E. Add ownership guard (migration 014/017 functions)
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_auction(
  p_character_id uuid,
  p_auction_id uuid
)
RETURNS text AS $$
DECLARE
  v_auction RECORD;
  v_has_ended boolean;
  v_existing_inv RECORD;
  v_payout int;
  v_tax int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_auction FROM public.auction_house WHERE id = p_auction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auction not found'; END IF;

  v_has_ended := now() >= v_auction.ends_at;

  IF NOT v_has_ended AND v_auction.seller_id = p_character_id THEN
    SELECT id, quantity INTO v_existing_inv FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_auction.item_id;

    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_auction.quantity
      WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity)
      VALUES (p_character_id, v_auction.item_id, v_auction.quantity);
    END IF;

    IF v_auction.current_bidder_id IS NOT NULL AND v_auction.current_bid > 0 THEN
      UPDATE public.characters SET gold = gold + v_auction.current_bid
      WHERE id = v_auction.current_bidder_id;
    END IF;

    DELETE FROM public.auction_house WHERE id = p_auction_id;
    RETURN 'cancelled';

  ELSIF v_has_ended AND v_auction.current_bidder_id IS NOT NULL
        AND v_auction.current_bidder_id = p_character_id THEN
    SELECT id, quantity INTO v_existing_inv FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_auction.item_id;

    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_auction.quantity
      WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity)
      VALUES (p_character_id, v_auction.item_id, v_auction.quantity);
    END IF;

    v_tax := ceil(v_auction.current_bid * 0.05);
    v_payout := v_auction.current_bid - v_tax;
    UPDATE public.characters SET gold = gold + v_payout WHERE id = v_auction.seller_id;

    INSERT INTO public.transactions (character_id, type, amount, description, metadata)
    VALUES (v_auction.seller_id, 'auction_sale', v_payout,
      'Auction sale completed',
      jsonb_build_object('auction_id', p_auction_id, 'buyer_id', p_character_id, 'total_bid', v_auction.current_bid)
    );

    DELETE FROM public.auction_house WHERE id = p_auction_id;
    RETURN 'won';

  ELSIF v_has_ended AND v_auction.seller_id = p_character_id THEN
    IF v_auction.current_bid > 0 THEN
      v_tax := ceil(v_auction.current_bid * 0.05);
      v_payout := v_auction.current_bid - v_tax;
      UPDATE public.characters SET gold = gold + v_payout WHERE id = p_character_id;

      INSERT INTO public.transactions (character_id, type, amount, description, metadata)
      VALUES (p_character_id, 'auction_sale', v_payout,
        'Auction sale completed',
        jsonb_build_object('auction_id', p_auction_id, 'total_bid', v_auction.current_bid)
      );
    ELSE
      SELECT id, quantity INTO v_existing_inv FROM public.inventory
      WHERE character_id = p_character_id AND item_id = v_auction.item_id;

      IF FOUND THEN
        UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_auction.quantity
        WHERE id = v_existing_inv.id;
      ELSE
        INSERT INTO public.inventory (character_id, item_id, quantity)
        VALUES (p_character_id, v_auction.item_id, v_auction.quantity);
      END IF;
    END IF;

    DELETE FROM public.auction_house WHERE id = p_auction_id;
    RETURN 'seller_claimed';

  ELSE
    RAISE EXCEPTION 'Cannot claim this auction';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_clan_rpc(
  p_character_id uuid,
  p_name text,
  p_philosophy text
)
RETURNS void AS $$
DECLARE
  v_crafting_tier int;
  v_clan_id uuid;
  v_gold int;
  v_clan_cost int := 1;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT gold INTO v_gold FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_gold < v_clan_cost THEN RAISE EXCEPTION 'Not enough gold (need %)', v_clan_cost; END IF;

  SELECT tier INTO v_crafting_tier FROM public.skills
  WHERE character_id = p_character_id AND name = 'Crafting';

  IF NOT FOUND OR COALESCE(v_crafting_tier, 1) < 2 THEN
    RAISE EXCEPTION 'You need Crafting Tier II to found a clan';
  END IF;

  IF EXISTS (SELECT 1 FROM public.clan_members WHERE character_id = p_character_id) THEN
    RAISE EXCEPTION 'You are already in a clan';
  END IF;

  UPDATE public.characters SET gold = gold - v_clan_cost WHERE id = p_character_id;

  INSERT INTO public.clans (name, symbol, philosophy, founder_id)
  VALUES (p_name, 'shield', p_philosophy, p_character_id)
  RETURNING id INTO v_clan_id;

  INSERT INTO public.clan_members (clan_id, character_id, role)
  VALUES (v_clan_id, p_character_id, 'chieftain');

  INSERT INTO public.transactions (character_id, type, amount, description)
  VALUES (p_character_id, 'clan_creation', -v_clan_cost, 'Founded clan: ' || p_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  PERFORM public.assert_character_owner(p_buyer_id);
  SELECT * INTO v_listing FROM public.marketplace_listings WHERE id = p_listing_id FOR UPDATE;
  IF v_listing IS NULL THEN RETURN jsonb_build_object('error', 'Listing not found'); END IF;
  IF v_listing.seller_id = p_buyer_id THEN RETURN jsonb_build_object('error', 'Cannot buy your own listing'); END IF;

  SELECT * INTO v_buyer FROM public.characters WHERE id = p_buyer_id FOR UPDATE;
  IF v_buyer IS NULL THEN RETURN jsonb_build_object('error', 'Buyer not found'); END IF;
  IF v_buyer.gold < v_listing.price THEN RETURN jsonb_build_object('error', 'Not enough gold'); END IF;

  SELECT * INTO v_item FROM public.items WHERE id = v_listing.item_id;
  IF v_item IS NULL THEN RETURN jsonb_build_object('error', 'Item not found'); END IF;

  UPDATE public.characters SET gold = gold - v_listing.price WHERE id = p_buyer_id;
  UPDATE public.characters SET gold = gold + v_listing.price WHERE id = v_listing.seller_id;

  DELETE FROM public.inventory WHERE id = v_listing.inventory_id;
  INSERT INTO public.inventory (character_id, item_id, quantity)
  VALUES (p_buyer_id, v_listing.item_id, v_listing.quantity);

  DELETE FROM public.marketplace_listings WHERE id = p_listing_id;

  INSERT INTO public.transactions (character_id, type, amount, description)
  VALUES (p_buyer_id, 'purchase', -v_listing.price, 'Bought ' || v_item.name || ' x' || v_listing.quantity);
  INSERT INTO public.transactions (character_id, type, amount, description)
  VALUES (v_listing.seller_id, 'sale', v_listing.price, 'Sold ' || v_item.name || ' x' || v_listing.quantity);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4F. Add ownership guard (migration 010/006 functions)
-- ============================================================

CREATE OR REPLACE FUNCTION public.deduct_stamina(p_character_id uuid, p_amount int)
RETURNS void AS $$
DECLARE
  v_stamina int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < p_amount THEN RAISE EXCEPTION 'Not enough stamina'; END IF;
  UPDATE public.characters
  SET stamina = stamina - p_amount, stamina_updated_at = now()
  WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.rest_character(p_character_id uuid, p_amount int)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  UPDATE public.characters
  SET stamina = LEAST(max_stamina, stamina + p_amount)
  WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.use_consumable(
  p_character_id uuid,
  p_inventory_id uuid
)
RETURNS void AS $$
DECLARE
  v_inv RECORD;
  v_item RECORD;
  v_heal int;
  v_new_qty int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT inv.*, i.stats, i.type INTO v_inv
  FROM public.inventory inv
  JOIN public.items i ON i.id = inv.item_id
  WHERE inv.id = p_inventory_id AND inv.character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_inv.type != 'consumable' THEN RAISE EXCEPTION 'Item is not consumable'; END IF;

  v_heal := COALESCE((v_inv.stats->>'heal')::int, 0);
  IF v_heal > 0 THEN
    UPDATE public.characters
    SET stamina = LEAST(max_stamina, stamina + v_heal), stamina_updated_at = now()
    WHERE id = p_character_id;
  END IF;

  v_new_qty := v_inv.quantity - 1;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = p_inventory_id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = p_inventory_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.equip_pet(
  p_character_id uuid,
  p_pet_id uuid
)
RETURNS void AS $$
DECLARE
  v_pet RECORD;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_pet FROM public.pets
  WHERE id = p_pet_id AND character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pet not found'; END IF;

  UPDATE public.pets SET equipped = false
  WHERE character_id = p_character_id AND equipped = true;

  UPDATE public.pets SET equipped = true
  WHERE id = p_pet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.unequip_pet(
  p_character_id uuid,
  p_pet_id uuid
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  UPDATE public.pets SET equipped = false
  WHERE id = p_pet_id AND character_id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cancel_listing(
  p_character_id uuid,
  p_listing_id uuid
)
RETURNS void AS $$
DECLARE
  v_listing RECORD;
  v_existing_inv RECORD;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_listing FROM public.marketplace_listings
  WHERE id = p_listing_id AND seller_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;

  SELECT id, quantity INTO v_existing_inv
  FROM public.inventory
  WHERE character_id = p_character_id AND item_id = v_listing.item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_listing.quantity
    WHERE id = v_existing_inv.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity)
    VALUES (p_character_id, v_listing.item_id, v_listing.quantity);
  END IF;

  DELETE FROM public.marketplace_listings WHERE id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.buy_pet(
  p_character_id uuid,
  p_pet_type text,
  p_pet_name text,
  p_cost int
)
RETURNS jsonb AS $$
DECLARE
  v_gold int;
  v_pet_id uuid;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT gold INTO v_gold FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_gold < p_cost THEN RAISE EXCEPTION 'Not enough gold (need %)', p_cost; END IF;

  IF p_pet_type NOT IN ('cat', 'dog', 'hawk', 'snake') THEN
    RAISE EXCEPTION 'This pet is not available at the Pet Shop';
  END IF;

  UPDATE public.characters SET gold = gold - p_cost WHERE id = p_character_id;

  INSERT INTO public.pets (character_id, type, name, equipped)
  VALUES (p_character_id, p_pet_type, p_pet_name, false)
  RETURNING id INTO v_pet_id;

  RETURN jsonb_build_object(
    'pet_id', v_pet_id,
    'pet_type', p_pet_type,
    'pet_name', p_pet_name,
    'cost', p_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
