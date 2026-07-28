-- Migration 014: Fix RPCs that still reference 'coins' and add purchase_listing
-- After migration 012 renamed coins -> gold, several RPCs broke

-- ============================================================
-- Fix shop_buy to use gold instead of coins
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
  IF (SELECT gold FROM public.characters WHERE id = p_character_id) < p_total_cost THEN
    RAISE EXCEPTION 'Not enough gold';
  END IF;

  UPDATE public.characters SET gold = gold - p_total_cost WHERE id = p_character_id;

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

-- ============================================================
-- Fix shop_sell to use gold instead of coins
-- ============================================================
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

-- ============================================================
-- Fix complete_action to use gold instead of coins
-- ============================================================
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
    UPDATE public.characters SET gold = gold + v_coin_reward WHERE id = p_character_id;
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
    UPDATE public.characters SET gold = gold + v_coin_reward WHERE id = p_character_id;
    v_rewards := jsonb_build_array(
      jsonb_build_object('item_name', 'Coins', 'quantity', v_coin_reward)
    );
  END IF;

  DELETE FROM public.actions WHERE id = p_action_id;

  RETURN jsonb_build_object('rewards', v_rewards);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fix shrine_donate to use gold instead of coins
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
  v_gold_reward int;
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

  v_gold_reward := p_quantity * 3;
  UPDATE public.characters SET gold = gold + v_gold_reward WHERE id = p_character_id;

  INSERT INTO public.transactions (character_id, type, amount, description)
  VALUES (p_character_id, 'shrine_donate', v_gold_reward,
    'Donated ' || p_quantity || 'x item to the shrine');

  RETURN v_gold_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fix shrine_pray to use gold instead of coins
-- ============================================================
CREATE OR REPLACE FUNCTION public.shrine_pray(
  p_character_id uuid,
  p_message text
)
RETURNS jsonb AS $$
DECLARE
  v_gold int;
  v_blessed boolean;
  v_blessing_text text;
  v_result jsonb;
BEGIN
  SELECT gold INTO v_gold FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_gold < 5 THEN RAISE EXCEPTION 'Not enough gold (need 5)'; END IF;

  UPDATE public.characters SET gold = gold - 5 WHERE id = p_character_id;

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
-- Fix claim_auction to use gold instead of coins
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

-- ============================================================
-- Add purchase_listing RPC (was missing)
-- ============================================================
CREATE OR REPLACE FUNCTION public.purchase_listing(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_price int
)
RETURNS void AS $$
DECLARE
  v_listing RECORD;
  v_existing_inv RECORD;
  v_tax int;
  v_payout int;
BEGIN
  SELECT * INTO v_listing FROM public.marketplace_listings WHERE id = p_listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.seller_id = p_buyer_id THEN RAISE EXCEPTION 'Cannot buy your own listing'; END IF;

  IF (SELECT gold FROM public.characters WHERE id = p_buyer_id) < p_price THEN
    RAISE EXCEPTION 'Not enough gold';
  END IF;

  -- Deduct gold from buyer
  UPDATE public.characters SET gold = gold - p_price WHERE id = p_buyer_id;

  -- Delete the listing
  DELETE FROM public.marketplace_listings WHERE id = p_listing_id;

  -- Add item to buyer's inventory
  SELECT id, quantity INTO v_existing_inv
  FROM public.inventory
  WHERE character_id = p_buyer_id AND item_id = v_listing.item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_listing.quantity
    WHERE id = v_existing_inv.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity)
    VALUES (p_buyer_id, v_listing.item_id, v_listing.quantity);
  END IF;

  -- Pay seller (minus 5% tax)
  v_tax := ceil(p_price * 0.05);
  v_payout := p_price - v_tax;
  UPDATE public.characters SET gold = gold + v_payout WHERE id = p_seller_id;

  -- Log transactions
  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_buyer_id, 'marketplace_buy', -p_price,
    'Bought ' || v_listing.quantity || 'x item from marketplace',
    jsonb_build_object('listing_id', p_listing_id, 'seller_id', p_seller_id, 'quantity', v_listing.quantity)
  );

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_seller_id, 'marketplace_sale', v_payout,
    'Sold ' || v_listing.quantity || 'x item on marketplace',
    jsonb_build_object('listing_id', p_listing_id, 'buyer_id', p_buyer_id, 'quantity', v_listing.quantity, 'tax', v_tax)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fix create_clan_rpc to deduct gold atomically
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
  v_gold int;
  v_clan_cost int := 1;
BEGIN
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

  -- Deduct gold atomically
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
