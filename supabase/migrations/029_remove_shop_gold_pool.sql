-- Migration 029: Remove NPC shop gold reserves
-- NPC shops should not track gold pools. Gold spent at shops is sunk (removed from economy).
-- Gold earned from selling to shops is created from nothing (like Torn NPC shops).

DROP FUNCTION IF EXISTS public.restock_shops();

ALTER TABLE public.shop_items DROP COLUMN gold_pool;
ALTER TABLE public.shop_items DROP COLUMN max_gold;
ALTER TABLE public.shop_items DROP COLUMN last_restocked_at;

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

  SELECT id, name, type, rarity, description, buy_price, sell_price, stock, stats
  INTO v_shop_item FROM public.shop_items WHERE name = p_item_name LIMIT 1;

  IF FOUND AND v_shop_item.stock != -1 AND v_shop_item.stock < p_quantity THEN
    RAISE EXCEPTION 'Not enough stock in shop';
  END IF;

  UPDATE public.characters SET gold = gold - p_total_cost WHERE id = p_character_id;

  IF FOUND AND v_shop_item.stock != -1 THEN
    UPDATE public.shop_items SET stock = stock - p_quantity WHERE id = v_shop_item.id;
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

  IF v_shop_item.id IS NOT NULL AND v_shop_item.stock != -1 THEN
    UPDATE public.shop_items SET stock = stock + p_quantity WHERE id = v_shop_item.id;
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
