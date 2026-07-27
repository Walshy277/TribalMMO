-- Migration 006: Server-side game logic
-- Moves all game-critical operations into atomic RPC functions
-- Run this in Supabase SQL Editor after 005_rename_factions_clans.sql

-- ============================================================
-- PETS: Add equipped column for pet equip/unequip
-- ============================================================
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS equipped boolean DEFAULT false;

-- ============================================================
-- HELPER: skill tier-up check (shared across many functions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_skill_xp(p_character_id uuid, p_skill_name text, p_xp_gained int)
RETURNS void AS $$
DECLARE
  v_skill RECORD;
  v_new_xp int;
  v_new_tier int;
  v_max_xp int;
BEGIN
  SELECT id, tier, experience INTO v_skill
  FROM public.skills
  WHERE character_id = p_character_id AND name = p_skill_name;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_new_xp := v_skill.experience + p_xp_gained;
  v_max_xp := v_skill.tier * 100;

  IF v_new_xp >= v_max_xp AND v_skill.tier < 5 THEN
    v_new_tier := v_skill.tier + 1;
  ELSE
    v_new_tier := v_skill.tier;
  END IF;

  UPDATE public.skills
  SET experience = v_new_xp, tier = v_new_tier
  WHERE id = v_skill.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STAMINA
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_stamina(p_character_id uuid, p_amount int)
RETURNS void AS $$
DECLARE
  v_stamina int;
BEGIN
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
  UPDATE public.characters
  SET stamina = LEAST(max_stamina, stamina + p_amount)
  WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMBAT
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_combat_win(p_character_id uuid, p_xp_reward int)
RETURNS void AS $$
BEGIN
  PERFORM public.check_skill_xp(p_character_id, 'Combat', p_xp_reward);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.resolve_combat_loss(p_character_id uuid, p_stamina_cost int)
RETURNS void AS $$
BEGIN
  PERFORM public.deduct_stamina(p_character_id, p_stamina_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- EXPLORATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.explore_step(p_character_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_result jsonb;
  v_zones text[] := ARRAY['Forest', 'Plains', 'Riverbank'];
  v_event_types text[] := ARRAY['resource', 'resource', 'resource', 'encounter', 'encounter', 'flavor', 'flavor', 'flavor', 'flavor'];
  v_resource_texts text[] := ARRAY[
    'You found some wood!',
    'You gathered a handful of herbs.',
    'You discovered a stone deposit.',
    'You find a patch of medicinal herbs.'
  ];
  v_encounter_texts text[] := ARRAY[
    'A wild boar charges at you!',
    'A rival scout appears from the bushes!'
  ];
  v_flavor_texts text[] := ARRAY[
    'The wind rustles through the ancient trees.',
    'You hear distant drums echoing across the plains.',
    'An eagle soars above you, circling lazily.',
    'You find a patch of medicinal herbs.'
  ];
  v_zone text;
  v_event_type text;
  v_event_text text;
BEGIN
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < 5 THEN RAISE EXCEPTION 'Not enough stamina'; END IF;

  UPDATE public.characters
  SET stamina = stamina - 5, stamina_updated_at = now()
  WHERE id = p_character_id;

  v_zone := v_zones[1 + floor(random() * array_length(v_zones, 1))::int];
  v_event_type := v_event_types[1 + floor(random() * array_length(v_event_types, 1))::int];

  IF v_event_type = 'resource' THEN
    v_event_text := v_resource_texts[1 + floor(random() * array_length(v_resource_texts, 1))::int];
  ELSIF v_event_type = 'encounter' THEN
    v_event_text := v_encounter_texts[1 + floor(random() * array_length(v_encounter_texts, 1))::int];
  ELSE
    v_event_text := v_flavor_texts[1 + floor(random() * array_length(v_flavor_texts, 1))::int];
  END IF;

  v_result := jsonb_build_object(
    'zone', v_zone,
    'event_type', v_event_type,
    'event_text', v_event_text
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ACTIONS
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
  v_crafting_tier int;
  v_max_slots int;
  v_completes_at timestamptz;
BEGIN
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < p_stamina_cost THEN RAISE EXCEPTION 'Not enough stamina'; END IF;

  SELECT count(*) INTO v_active_count FROM public.actions WHERE character_id = p_character_id;

  SELECT tier INTO v_crafting_tier FROM public.skills
  WHERE character_id = p_character_id AND name = 'Crafting';

  v_max_slots := CASE WHEN COALESCE(v_crafting_tier, 1) >= 2 THEN 2 ELSE 1 END;

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
  SELECT * INTO v_action FROM public.actions
  WHERE id = p_action_id AND character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Action not found'; END IF;
  IF now() < v_action.completes_at THEN RAISE EXCEPTION 'Action not complete yet'; END IF;

  IF v_action.type = 'gathering' THEN
    FOR v_resource IN
      SELECT * FROM jsonb_to_recordset(v_action.result->'resources')
        AS x(name text, quantity int)
    LOOP
      SELECT id INTO v_item_id FROM public.items WHERE name = v_resource.name LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO public.items (name, type, tier) VALUES (v_resource.name, 'resource', 1)
        RETURNING id INTO v_item_id;
      END IF;

      SELECT id, quantity INTO v_existing_inv FROM public.inventory
      WHERE character_id = p_character_id AND item_id = v_item_id;

      IF FOUND THEN
        UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_resource.quantity
        WHERE id = v_existing_inv.id;
      ELSE
        INSERT INTO public.inventory (character_id, item_id, quantity)
        VALUES (p_character_id, v_item_id, v_resource.quantity);
      END IF;

      v_reward := jsonb_build_object('item_name', v_resource.name, 'quantity', v_resource.quantity);
      v_rewards := v_rewards || v_reward;
    END LOOP;

    v_coin_reward := floor(random() * 5) + 1;
    UPDATE public.characters SET coins = coins + v_coin_reward WHERE id = p_character_id;
    v_rewards := v_rewards || jsonb_build_object('item_name', 'Coins', 'quantity', v_coin_reward);

  ELSIF v_action.type = 'crafting' THEN
    IF v_action.result ? 'item_name' THEN
      SELECT id INTO v_item_id FROM public.items WHERE name = v_action.result->>'item_name' LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO public.items (name, type, tier, stats)
        VALUES (
          v_action.result->>'item_name',
          COALESCE(v_action.result->>'item_type', 'weapon'),
          COALESCE((v_action.result->>'tier')::int, 1),
          COALESCE(v_action.result->'stats', '{}'::jsonb)
        ) RETURNING id INTO v_item_id;
      END IF;

      SELECT id, quantity INTO v_existing_inv FROM public.inventory
      WHERE character_id = p_character_id AND item_id = v_item_id;

      IF FOUND THEN
        UPDATE public.inventory SET quantity = v_existing_inv.quantity + 1
        WHERE id = v_existing_inv.id;
      ELSE
        INSERT INTO public.inventory (character_id, item_id, quantity)
        VALUES (p_character_id, v_item_id, 1);
      END IF;

      v_rewards := jsonb_build_array(
        jsonb_build_object('item_name', v_action.result->>'item_name', 'quantity', 1)
      );
    END IF;

  ELSIF v_action.type = 'training' THEN
    v_coin_reward := floor(random() * 8) + 2;
    UPDATE public.characters SET coins = coins + v_coin_reward WHERE id = p_character_id;
    v_rewards := jsonb_build_array(
      jsonb_build_object('item_name', 'Coins', 'quantity', v_coin_reward)
    );
  END IF;

  DELETE FROM public.actions WHERE id = p_action_id;

  RETURN jsonb_build_object('rewards', v_rewards);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CRAFTING
-- ============================================================
CREATE OR REPLACE FUNCTION public.craft_item(
  p_character_id uuid,
  p_item_name text,
  p_item_type text,
  p_item_tier int,
  p_item_stats jsonb,
  p_duration int,
  p_materials jsonb
)
RETURNS void AS $$
DECLARE
  v_mat jsonb;
  v_inv RECORD;
  v_new_qty int;
BEGIN
  FOR v_mat IN SELECT * FROM jsonb_array_elements(p_materials)
  LOOP
    SELECT i.id AS item_id, inv.id AS inv_id, inv.quantity
    INTO v_inv
    FROM public.inventory inv
    JOIN public.items i ON i.id = inv.item_id
    WHERE inv.character_id = p_character_id
      AND i.name = v_mat->>'name'
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Missing material: %', v_mat->>'name';
    END IF;

    IF v_inv.quantity < (v_mat->>'quantity')::int THEN
      RAISE EXCEPTION 'Not enough %', v_mat->>'name';
    END IF;

    v_new_qty := v_inv.quantity - (v_mat->>'quantity')::int;
    IF v_new_qty <= 0 THEN
      DELETE FROM public.inventory WHERE id = v_inv.inv_id;
    ELSE
      UPDATE public.inventory SET quantity = v_new_qty WHERE id = v_inv.inv_id;
    END IF;
  END LOOP;

  PERFORM public.start_action(
    p_character_id,
    'crafting',
    p_duration,
    'Crafting',
    0,
    jsonb_build_object(
      'item_name', p_item_name,
      'item_type', p_item_type,
      'stats', p_item_stats,
      'tier', p_item_tier
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SHOPS
-- ============================================================
CREATE OR REPLACE FUNCTION public.shop_buy(
  p_character_id uuid,
  p_item_name text,
  p_item_type text,
  p_item_tier int,
  p_item_stats jsonb,
  p_total_cost int,
  p_quantity int
)
RETURNS void AS $$
DECLARE
  v_item_id uuid;
  v_existing_inv RECORD;
BEGIN
  IF (SELECT coins FROM public.characters WHERE id = p_character_id) < p_total_cost THEN
    RAISE EXCEPTION 'Not enough coins';
  END IF;

  UPDATE public.characters SET coins = coins - p_total_cost WHERE id = p_character_id;

  SELECT id INTO v_item_id FROM public.items WHERE name = p_item_name LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.items (name, type, tier, stats)
    VALUES (p_item_name, p_item_type, p_item_tier, p_item_stats)
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
BEGIN
  SELECT * INTO v_inv FROM public.inventory
  WHERE id = p_inventory_id AND character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;

  UPDATE public.characters SET coins = coins + p_total_value WHERE id = p_character_id;

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

-- ============================================================
-- MARKETPLACE
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_listing(
  p_character_id uuid,
  p_item_id uuid,
  p_quantity int,
  p_price int
)
RETURNS void AS $$
DECLARE
  v_inv RECORD;
  v_new_qty int;
BEGIN
  SELECT * INTO v_inv FROM public.inventory
  WHERE character_id = p_character_id AND item_id = p_item_id AND NOT equipped;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found in inventory'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;
  IF p_price < 1 THEN RAISE EXCEPTION 'Price must be at least 1'; END IF;

  v_new_qty := v_inv.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = v_inv.id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = v_inv.id;
  END IF;

  INSERT INTO public.marketplace_listings (seller_id, item_id, quantity, price)
  VALUES (p_character_id, p_item_id, p_quantity, p_price);
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

-- ============================================================
-- AUCTION
-- ============================================================
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
  v_new_qty int;
  v_ends_at timestamptz;
BEGIN
  SELECT * INTO v_inv FROM public.inventory
  WHERE character_id = p_character_id AND item_id = p_item_id AND NOT equipped;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found in inventory'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;
  IF p_starting_price < 1 THEN RAISE EXCEPTION 'Starting price must be at least 1'; END IF;

  v_new_qty := v_inv.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = v_inv.id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = v_inv.id;
  END IF;

  v_ends_at := now() + (p_duration_seconds || ' seconds')::interval;

  INSERT INTO public.auction_house (seller_id, item_id, quantity, starting_price, ends_at)
  VALUES (p_character_id, p_item_id, p_quantity, p_starting_price, v_ends_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  SELECT * INTO v_auction FROM public.auction_house WHERE id = p_auction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auction not found'; END IF;

  v_has_ended := now() >= v_auction.ends_at;

  -- Seller cancelling before end
  IF NOT v_has_ended AND v_auction.seller_id = p_character_id THEN
    -- Return items to seller
    SELECT id, quantity INTO v_existing_inv FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_auction.item_id;

    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_auction.quantity
      WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity)
      VALUES (p_character_id, v_auction.item_id, v_auction.quantity);
    END IF;

    -- Refund current bidder
    IF v_auction.current_bidder_id IS NOT NULL AND v_auction.current_bid > 0 THEN
      UPDATE public.characters SET coins = coins + v_auction.current_bid
      WHERE id = v_auction.current_bidder_id;
    END IF;

    DELETE FROM public.auction_house WHERE id = p_auction_id;
    RETURN 'cancelled';

  -- Ended with a bidder: winner claims
  ELSIF v_has_ended AND v_auction.current_bidder_id IS NOT NULL
        AND v_auction.current_bidder_id = p_character_id THEN
    -- Give items to winner
    SELECT id, quantity INTO v_existing_inv FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_auction.item_id;

    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_auction.quantity
      WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity)
      VALUES (p_character_id, v_auction.item_id, v_auction.quantity);
    END IF;

    -- Pay seller (minus 5% tax)
    v_tax := ceil(v_auction.current_bid * 0.05);
    v_payout := v_auction.current_bid - v_tax;
    UPDATE public.characters SET coins = coins + v_payout WHERE id = v_auction.seller_id;

    INSERT INTO public.transactions (character_id, type, amount, description, metadata)
    VALUES (v_auction.seller_id, 'auction_sale', v_payout,
      'Auction sale completed',
      jsonb_build_object('auction_id', p_auction_id, 'buyer_id', p_character_id, 'total_bid', v_auction.current_bid)
    );

    DELETE FROM public.auction_house WHERE id = p_auction_id;
    RETURN 'won';

  -- Ended, seller claims coins (or reclaim if no bids)
  ELSIF v_has_ended AND v_auction.seller_id = p_character_id THEN
    IF v_auction.current_bid > 0 THEN
      -- Pay seller coins
      v_tax := ceil(v_auction.current_bid * 0.05);
      v_payout := v_auction.current_bid - v_tax;
      UPDATE public.characters SET coins = coins + v_payout WHERE id = p_character_id;

      INSERT INTO public.transactions (character_id, type, amount, description, metadata)
      VALUES (p_character_id, 'auction_sale', v_payout,
        'Auction sale completed',
        jsonb_build_object('auction_id', p_auction_id, 'total_bid', v_auction.current_bid)
      );
    ELSE
      -- No bids, return items
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

-- ============================================================
-- SHRINE
-- ============================================================
CREATE OR REPLACE FUNCTION public.shrine_donate(
  p_character_id uuid,
  p_inventory_id uuid,
  p_quantity int
)
RETURNS int AS $$
DECLARE
  v_inv RECORD;
  v_new_qty int;
  v_coin_reward int;
BEGIN
  SELECT * INTO v_inv FROM public.inventory
  WHERE id = p_inventory_id AND character_id = p_character_id AND NOT equipped;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;

  v_new_qty := v_inv.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = p_inventory_id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = p_inventory_id;
  END IF;

  INSERT INTO public.shrine_donations (character_id, item_id, quantity)
  VALUES (p_character_id, v_inv.item_id, p_quantity);

  v_coin_reward := p_quantity * 3;
  UPDATE public.characters SET coins = coins + v_coin_reward WHERE id = p_character_id;

  INSERT INTO public.transactions (character_id, type, amount, description)
  VALUES (p_character_id, 'shrine_donate', v_coin_reward,
    'Donated ' || p_quantity || 'x item to the shrine');

  RETURN v_coin_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.shrine_pray(
  p_character_id uuid,
  p_message text
)
RETURNS jsonb AS $$
DECLARE
  v_coins int;
  v_blessed boolean;
  v_blessing_text text;
  v_result jsonb;
BEGIN
  SELECT coins INTO v_coins FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_coins < 5 THEN RAISE EXCEPTION 'Not enough coins (need 5)'; END IF;

  UPDATE public.characters SET coins = coins - 5 WHERE id = p_character_id;

  INSERT INTO public.transactions (character_id, type, amount, description)
  VALUES (p_character_id, 'shrine_pray', -5, 'Prayed at the shrine');

  v_blessed := random() < 0.4;
  v_blessing_text := NULL;

  IF v_blessed THEN
    v_blessing_text := public.shrine_bless(p_character_id);
  END IF;

  INSERT INTO public.shrine_prayers (character_id, message, blessing)
  VALUES (p_character_id, p_message, v_blessing_text);

  v_result := jsonb_build_object(
    'blessed', v_blessed,
    'blessing', v_blessing_text
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DAILY REWARDS
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_daily_reward(p_character_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_reward_record RECORD;
  v_next_day int;
  v_coins_reward int;
  v_bonus_item text;
  v_bonus_qty int;
  v_item_id uuid;
  v_existing_inv RECORD;
  v_new_streak int;
  v_result jsonb;
  v_daily_rewards jsonb := '[
    {"day":1,"coins":10},
    {"day":2,"coins":15},
    {"day":3,"coins":25},
    {"day":4,"coins":30,"bonus_item":"Herbs","bonus_qty":5},
    {"day":5,"coins":40,"bonus_item":"Hides","bonus_qty":3},
    {"day":6,"coins":60},
    {"day":7,"coins":100,"bonus_item":"Stamina Potion","bonus_qty":2}
  ]'::jsonb;
BEGIN
  SELECT * INTO v_reward_record FROM public.daily_rewards WHERE character_id = p_character_id;

  IF FOUND THEN
    IF now() - v_reward_record.last_claimed_at < interval '24 hours' THEN
      RAISE EXCEPTION 'Already claimed today';
    END IF;

    IF now() - v_reward_record.last_claimed_at >= interval '48 hours' THEN
      v_new_streak := 1;
    ELSE
      v_new_streak := v_reward_record.streak + 1;
    END IF;
  ELSE
    v_new_streak := 1;
  END IF;

  v_next_day := ((v_new_streak - 1) % 7) + 1;

  SELECT (value->>'coins')::int,
         value->>'bonus_item',
         (value->>'bonus_qty')::int
  INTO v_coins_reward, v_bonus_item, v_bonus_qty
  FROM jsonb_array_elements(v_daily_rewards)
  WHERE (value->>'day')::int = v_next_day;

  v_coins_reward := COALESCE(v_coins_reward, 10);

  UPDATE public.characters SET coins = coins + v_coins_reward WHERE id = p_character_id;

  INSERT INTO public.transactions (character_id, type, amount, description)
  VALUES (p_character_id, 'daily_reward', v_coins_reward, 'Day ' || v_next_day || ' daily reward');

  IF v_bonus_item IS NOT NULL AND v_bonus_qty > 0 THEN
    SELECT id INTO v_item_id FROM public.items WHERE name = v_bonus_item LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.items (name, type, tier, stats)
      VALUES (v_bonus_item,
        CASE WHEN v_bonus_item = 'Stamina Potion' THEN 'consumable' ELSE 'resource' END,
        1,
        CASE WHEN v_bonus_item = 'Stamina Potion' THEN '{"heal":25}'::jsonb ELSE '{}'::jsonb END
      ) RETURNING id INTO v_item_id;
    END IF;

    SELECT id, quantity INTO v_existing_inv
    FROM public.inventory WHERE character_id = p_character_id AND item_id = v_item_id;

    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_bonus_qty
      WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity)
      VALUES (p_character_id, v_item_id, v_bonus_qty);
    END IF;
  END IF;

  INSERT INTO public.daily_rewards (character_id, last_claimed_at, streak)
  VALUES (p_character_id, now(), v_new_streak)
  ON CONFLICT (character_id) DO UPDATE
  SET last_claimed_at = now(), streak = v_new_streak;

  v_result := jsonb_build_object(
    'day', v_next_day,
    'coins', v_coins_reward,
    'bonus_item', v_bonus_item,
    'bonus_qty', v_bonus_qty,
    'streak', v_new_streak
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CLANS
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_clan_rpc(
  p_character_id uuid,
  p_name text,
  p_philosophy text
)
RETURNS void AS $$
DECLARE
  v_crafting_tier int;
  v_clan_id uuid;
BEGIN
  SELECT tier INTO v_crafting_tier FROM public.skills
  WHERE character_id = p_character_id AND name = 'Crafting';

  IF NOT FOUND OR COALESCE(v_crafting_tier, 1) < 2 THEN
    RAISE EXCEPTION 'You need Crafting Tier II to found a clan';
  END IF;

  IF EXISTS (SELECT 1 FROM public.clan_members WHERE character_id = p_character_id) THEN
    RAISE EXCEPTION 'You are already in a clan';
  END IF;

  INSERT INTO public.clans (name, symbol, philosophy, founder_id)
  VALUES (p_name, 'shield', p_philosophy, p_character_id)
  RETURNING id INTO v_clan_id;

  INSERT INTO public.clan_members (clan_id, character_id, role)
  VALUES (v_clan_id, p_character_id, 'chieftain');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PET EQUIP / UNEQUIP
-- ============================================================
CREATE OR REPLACE FUNCTION public.equip_pet(
  p_character_id uuid,
  p_pet_id uuid
)
RETURNS void AS $$
DECLARE
  v_pet RECORD;
BEGIN
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
  UPDATE public.pets SET equipped = false
  WHERE id = p_pet_id AND character_id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- EQUIP CONSUMABLE (stamina potion from inventory)
-- ============================================================
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
