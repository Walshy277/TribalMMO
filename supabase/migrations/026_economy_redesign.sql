-- Migration 026: Economy Redesign
-- NPC shop overhaul, listing fees, gold sinks, treasure coins, source cuts

-- === SCHEMA CHANGES ===

ALTER TABLE public.characters ADD COLUMN treasure_coins integer NOT NULL DEFAULT 0;

ALTER TABLE public.inventory ADD COLUMN durability integer;
ALTER TABLE public.inventory ADD COLUMN max_durability integer;

ALTER TABLE public.shop_items ADD COLUMN gold_pool integer NOT NULL DEFAULT 2000;
ALTER TABLE public.shop_items ADD COLUMN max_gold integer NOT NULL DEFAULT 5000;
ALTER TABLE public.shop_items ADD COLUMN last_restocked_at timestamptz DEFAULT now();

UPDATE public.shop_items SET gold_pool = max_gold, last_restocked_at = now();

-- === RESTOCK SHOPS ===

CREATE OR REPLACE FUNCTION public.restock_shops()
RETURNS void AS $$
DECLARE
  v_shop RECORD;
BEGIN
  FOR v_shop IN SELECT * FROM public.shop_items
  LOOP
    UPDATE public.shop_items
    SET gold_pool = LEAST(max_gold, gold_pool + 500),
        last_restocked_at = now()
    WHERE id = v_shop.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- === ACTIVE LISTING COUNT HELPER ===

CREATE OR REPLACE FUNCTION public.active_listing_count(p_character_id uuid)
RETURNS int AS $$
DECLARE
  v_market_count int;
  v_auction_count int;
BEGIN
  SELECT COUNT(*) INTO v_market_count FROM public.marketplace_listings
  WHERE seller_id = p_character_id;
  SELECT COUNT(*) INTO v_auction_count FROM public.auction_house
  WHERE seller_id = p_character_id AND claimed = false AND ends_at > now();
  RETURN v_market_count + v_auction_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- === SHOP BUY — parameter name changed from p_item_tier to p_item_rarity, must DROP first ===

DROP FUNCTION IF EXISTS public.shop_buy(uuid, text, text, int, jsonb, int, int);

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

-- === SHOP SELL — same params, safe to CREATE OR REPLACE ===

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

-- === MARKETPLACE LISTING — same params ===

DROP FUNCTION IF EXISTS public.create_listing(uuid, uuid, int, int);

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

-- === AUCTION LISTING — same params ===

DROP FUNCTION IF EXISTS public.create_auction(uuid, uuid, int, int, int);

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

-- === TRAIN — no gold reward, same params ===

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

-- === GATHER RESOURCE — no gold reward, same params ===

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

-- === SHRINE DONATE — XP instead of gold, same params ===

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

-- === SHRINE PRAY — no gold cost, same params ===

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

-- === DAILY REWARDS — treasure coins on milestones, same params ===

DROP FUNCTION IF EXISTS public.claim_daily_reward(uuid);

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

-- === CRAFT ITEM — gold cost, same params ===

DROP FUNCTION IF EXISTS public.craft_item_rpc(uuid, text, text, int, jsonb, int, jsonb);

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

-- === RESOLVE COMBAT WIN — level-based gold, same params ===

CREATE OR REPLACE FUNCTION public.resolve_combat_win(p_character_id uuid, p_xp_reward int)
RETURNS jsonb AS $$
DECLARE
  v_gold_reward int;
  v_char record;
  v_combat_level int;
  v_xp_gain int;
BEGIN
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

-- === RESOLVE COMBAT LOSS — same params ===

CREATE OR REPLACE FUNCTION public.resolve_combat_loss(p_character_id uuid, p_stamina_cost int)
RETURNS void AS $$
BEGIN
  UPDATE public.characters
  SET stamina = GREATEST(0, stamina - p_stamina_cost), stamina_updated_at = now()
  WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- === REPAIR ITEM — new RPC ===

CREATE OR REPLACE FUNCTION public.repair_item(
  p_character_id uuid,
  p_inventory_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_inv RECORD;
  v_cost int;
BEGIN
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
