-- Migration 030: Item market values + NPC shop pricing
-- Shops buy from players at ~60% of market value. Market value is computed
-- from recent player-to-player trades (marketplace + auctions).
-- Gold spent at shops is sunk. Gold earned selling to shops is created.
-- Players control the economy through trades.

-- ============================================================
-- 1. Add market_value column to items
-- ============================================================
ALTER TABLE public.items ADD COLUMN market_value integer NOT NULL DEFAULT 0;

-- ============================================================
-- 2. Add buy_rate to shop_items (what % of market value the shop pays)
-- ============================================================
ALTER TABLE public.shop_items ADD COLUMN buy_rate numeric(3,2) NOT NULL DEFAULT 0.60;

-- ============================================================
-- 3. Helper: default market_value by type and rarity
-- ============================================================
CREATE OR REPLACE FUNCTION public.default_market_value(p_type text, p_rarity int DEFAULT 1)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'resource' THEN
      CASE p_rarity WHEN 1 THEN 3 WHEN 2 THEN 15 WHEN 3 THEN 50 WHEN 4 THEN 150 WHEN 5 THEN 500 ELSE 3 END
    WHEN 'materials' THEN
      CASE p_rarity WHEN 1 THEN 5 WHEN 2 THEN 30 WHEN 3 THEN 120 WHEN 4 THEN 400 WHEN 5 THEN 1200 ELSE 5 END
    WHEN 'consumable' THEN
      CASE p_rarity WHEN 1 THEN 10 WHEN 2 THEN 45 WHEN 3 THEN 150 WHEN 4 THEN 500 WHEN 5 THEN 1500 ELSE 10 END
    WHEN 'weapon' THEN
      CASE p_rarity WHEN 1 THEN 25 WHEN 2 THEN 100 WHEN 3 THEN 400 WHEN 4 THEN 1200 WHEN 5 THEN 5000 ELSE 25 END
    WHEN 'armor' THEN
      CASE p_rarity WHEN 1 THEN 20 WHEN 2 THEN 80 WHEN 3 THEN 300 WHEN 4 THEN 1000 WHEN 5 THEN 4000 ELSE 20 END
    WHEN 'accessory' THEN
      CASE p_rarity WHEN 1 THEN 15 WHEN 2 THEN 60 WHEN 3 THEN 250 WHEN 4 THEN 800 WHEN 5 THEN 3000 ELSE 15 END
    WHEN 'collectible' THEN
      CASE p_rarity WHEN 1 THEN 8 WHEN 2 THEN 40 WHEN 3 THEN 150 WHEN 4 THEN 600 WHEN 5 THEN 2500 ELSE 8 END
    WHEN 'tool' THEN
      CASE p_rarity WHEN 1 THEN 20 WHEN 2 THEN 80 WHEN 3 THEN 300 ELSE 20 END
    WHEN 'pet' THEN
      CASE p_rarity WHEN 1 THEN 15 WHEN 2 THEN 60 WHEN 3 THEN 200 ELSE 15 END
    ELSE 5
  END;
$$;

-- ============================================================
-- 4. Seed market values for all existing items
-- ============================================================
UPDATE public.items SET market_value =
  CASE name
    -- === GATHERED RESOURCES ===
    WHEN 'Wood' THEN 3
    WHEN 'Oak Log' THEN 6
    WHEN 'Willow Log' THEN 12
    WHEN 'Maple Log' THEN 25
    WHEN 'Yew Log' THEN 55
    WHEN 'Stone' THEN 3
    WHEN 'Copper Ore' THEN 5
    WHEN 'Iron Ore' THEN 12
    WHEN 'Coal' THEN 8
    WHEN 'Silver Ore' THEN 30
    WHEN 'Gold Ore' THEN 80
    WHEN 'Gemstone' THEN 100
    WHEN 'Emerald' THEN 250
    WHEN 'Diamond' THEN 500
    WHEN 'Wild Herbs' THEN 3
    WHEN 'Wild Berries' THEN 3
    WHEN 'Bark Fiber' THEN 2
    WHEN 'Mushrooms' THEN 5
    WHEN 'Cave Mushroom' THEN 8
    WHEN 'Clay' THEN 4
    WHEN 'Flint' THEN 4
    WHEN 'Reeds' THEN 5
    WHEN 'Hides' THEN 6
    WHEN 'Bone' THEN 4
    WHEN 'Golden Herb' THEN 50

    -- === EXPLORATION ZONE ITEMS ===
    WHEN 'Dry Grass' THEN 1
    WHEN 'Feathers' THEN 3
    WHEN 'River Stone' THEN 3
    WHEN 'Reed Fiber' THEN 4
    WHEN 'Driftwood' THEN 5
    WHEN 'Fish' THEN 8
    WHEN 'Ore Nugget' THEN 6
    WHEN 'Crystal Shard' THEN 30
    WHEN 'Rusty Gear' THEN 10
    WHEN 'Scroll Fragment' THEN 20
    WHEN 'Old Rope' THEN 5
    WHEN 'Strange Dust' THEN 15
    WHEN 'Bog Iron' THEN 10
    WHEN 'Leech' THEN 8
    WHEN 'Swamp Moss' THEN 12
    WHEN 'Rotwood' THEN 6
    WHEN 'Slime' THEN 5

    -- === COMBAT LOOT ===
    WHEN 'Raw Meat' THEN 5
    WHEN 'Boar Hide' THEN 8
    WHEN 'Boar Tusk' THEN 15
    WHEN 'Wolf Pelt' THEN 12
    WHEN 'Wolf Fang' THEN 20
    WHEN 'Thick Fur' THEN 15
    WHEN 'Bear Claw' THEN 30
    WHEN 'Serpent Scales' THEN 25
    WHEN 'Serpent Fang' THEN 35
    WHEN 'Stone Shard' THEN 8
    WHEN 'Crystal Fragment' THEN 25
    WHEN 'Golem Core' THEN 80
    WHEN 'Shadow Essence' THEN 60
    WHEN 'Dark Silk' THEN 40
    WHEN 'Strange Pouch' THEN 25
    WHEN 'Ember Shard' THEN 30
    WHEN 'Fire Essence' THEN 50
    WHEN 'Cinder Ore' THEN 20
    WHEN 'Silk Web' THEN 15
    WHEN 'Spider Venom' THEN 40
    WHEN 'Chitin Fragment' THEN 20
    WHEN 'Ancient Relic' THEN 500
    WHEN 'Warden Plate' THEN 150
    WHEN 'Runic Stone' THEN 100
    WHEN 'Gold Bar' THEN 200
    WHEN 'Map Fragment' THEN 15
    WHEN 'Old Coin' THEN 10
    WHEN 'Rations' THEN 8

    -- === SHOP ITEMS ===
    WHEN 'Stamina Potion' THEN 10
    WHEN 'Minor Healing Salve' THEN 20
    WHEN 'Iron Sword' THEN 35
    WHEN 'Iron Shield' THEN 30
    WHEN 'Steel Sword' THEN 100
    WHEN 'Steel Armor' THEN 95
    WHEN 'Herb Bundle' THEN 8
    WHEN 'Leather Pouch' THEN 20
    WHEN 'Sharpening Stone' THEN 45
    WHEN 'Tribal Amulet' THEN 140

    -- === PET SHOP ITEMS ===
    WHEN 'Leather Collar' THEN 18
    WHEN 'Sturdy Leash' THEN 22
    WHEN 'Pet Treats' THEN 10
    WHEN 'Grooming Brush' THEN 15
    WHEN 'Beast Whistle' THEN 60
    WHEN 'Tamed Harness' THEN 85
    WHEN 'Exotic Feed' THEN 35
    WHEN 'Loyal Charm' THEN 150

    -- === CRAFTED MATERIALS ===
    WHEN 'Oak Plank' THEN 15
    WHEN 'Iron Ingot' THEN 25
    WHEN 'Copper Ingot' THEN 12
    WHEN 'Hardened Leather' THEN 20
    WHEN 'Steel Ingot' THEN 60
    WHEN 'Linen Thread' THEN 8
    WHEN 'Processed Hide' THEN 15
    WHEN 'Refined Clay' THEN 10
    WHEN 'Bronze Ingot' THEN 18
    WHEN 'Waxed Thread' THEN 12
    WHEN 'Treated Wood' THEN 10
    WHEN 'Iron Chain' THEN 20
    WHEN 'Silk Thread' THEN 25
    WHEN 'Glass Shard' THEN 15
    WHEN 'Braided Cord' THEN 8
    WHEN 'Hardened Bone' THEN 12
    WHEN 'Polished Stone' THEN 10
    WHEN 'Smelted Copper' THEN 15
    WHEN 'Mythril Ore' THEN 100
    WHEN 'Adamantine Shard' THEN 150
    WHEN 'Dragon Scale' THEN 200
    WHEN 'Enchanted Wood' THEN 80
    WHEN 'Mithril Ingot' THEN 250
    WHEN 'Phoenix Ash' THEN 300
    WHEN 'Void Essence' THEN 200
    WHEN 'Star Metal' THEN 350
    WHEN 'Elder Bark' THEN 60
    WHEN 'Crystal Lens' THEN 120
    WHEN 'Enchanted Iron' THEN 100
    WHEN 'Shadow Weave' THEN 180
    WHEN 'Arcane Dust' THEN 150
    WHEN 'Dragon Bone' THEN 120
    WHEN 'Celestial Ore' THEN 400
    WHEN 'Living Steel' THEN 280
    WHEN 'True Silver' THEN 120
    WHEN 'Soul Fragment' THEN 250
    WHEN 'Aether Crystal' THEN 300

    -- === CONSUMABLES ===
    WHEN 'Dried Meat' THEN 6
    WHEN 'Fresh Water' THEN 4
    WHEN 'Healing Herb' THEN 8
    WHEN 'Trail Rations' THEN 10
    WHEN 'Bandage' THEN 8
    WHEN 'Torch' THEN 5
    WHEN 'Rope' THEN 12
    WHEN 'Flint and Steel' THEN 10
    WHEN 'Cooked Fish' THEN 12
    WHEN 'Berry Poultice' THEN 15
    WHEN 'Stew' THEN 25
    WHEN 'Antidote' THEN 50
    WHEN 'Smoked Meat' THEN 20
    WHEN 'Herbal Tea' THEN 15
    WHEN 'Healing Salve' THEN 35
    WHEN 'Iron Rations' THEN 20
    WHEN 'Warding Charm' THEN 40
    WHEN 'Hunting Trap' THEN 30
    WHEN 'Spiced Wine' THEN 25
    WHEN 'Soothing Balm' THEN 30
    WHEN 'Greater Healing Potion' THEN 120
    WHEN 'Stamina Tonic' THEN 100
    WHEN 'Royal Feast' THEN 80
    WHEN 'Elixir of Vigor' THEN 150
    WHEN 'Phoenix Down' THEN 200
    WHEN 'Enchanted Bandage' THEN 60
    WHEN 'Mana Crystal' THEN 100
    WHEN 'Scroll of Return' THEN 80
    WHEN 'Ambrosia' THEN 250
    WHEN 'Spirit Potion' THEN 120

    -- === MATERIALS TYPE ===
    WHEN 'Sand' THEN 2
    WHEN 'Moss' THEN 3
    WHEN 'Resin' THEN 5
    WHEN 'Charcoal' THEN 6
    WHEN 'Pine Wood' THEN 3
    WHEN 'Oak Wood' THEN 6
    WHEN 'River Clay' THEN 4
    WHEN 'Fiber' THEN 3
    WHEN 'Herbs' THEN 4
    WHEN 'Bone Fragment' THEN 3

    -- use type/rarity formula for everything else
    ELSE public.default_market_value(type, rarity)
  END
WHERE market_value = 0;

-- ============================================================
-- 5. Market value recalculation function
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_market_values()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_item record;
  v_avg_price numeric;
BEGIN
  FOR v_item IN SELECT DISTINCT ON (i.id) i.id, i.name, i.type, i.rarity
    FROM public.items i
  LOOP
    SELECT COALESCE(
      -- weighted average: recent trades count more
      (
        SELECT FLOOR(AVG(t.amount / NULLIF(ABS((t.metadata->>'quantity')::int), 0)) * ABS(t.amount))::int
        FROM (
          SELECT amount, metadata, created_at,
            CASE
              WHEN created_at >= now() - interval '7 days' THEN 4
              WHEN created_at >= now() - interval '30 days' THEN 2
              ELSE 1
            END AS weight
          FROM public.transactions
          WHERE type IN ('purchase', 'sale', 'auction_sale')
            AND metadata->>'item_name' = v_item.name
            AND created_at >= now() - interval '90 days'
        ) t
      ),
      public.default_market_value(v_item.type, v_item.rarity)
    ) INTO v_avg_price;

    UPDATE public.items SET market_value = GREATEST(1, v_avg_price::int) WHERE id = v_item.id;
  END LOOP;
END;
$$;

-- ============================================================
-- 6. Modify shop_sell: calculate price from market_value
-- ============================================================
CREATE OR REPLACE FUNCTION public.shop_sell(
  p_character_id uuid,
  p_inventory_id uuid,
  p_quantity int
)
RETURNS void AS $$
DECLARE
  v_inv RECORD;
  v_new_qty int;
  v_shop_item RECORD;
  v_unit_price int;
  v_total_value int;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT inv.*, i.name, i.market_value, i.type, i.rarity
  INTO v_inv
  FROM public.inventory inv
  JOIN public.items i ON i.id = inv.item_id
  WHERE inv.id = p_inventory_id AND inv.character_id = p_character_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_inv.quantity < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;

  SELECT * INTO v_shop_item FROM public.shop_items WHERE name = v_inv.name LIMIT 1;

  IF v_shop_item.id IS NOT NULL AND v_shop_item.stock != -1 THEN
    UPDATE public.shop_items SET stock = stock + p_quantity WHERE id = v_shop_item.id;
  END IF;

  -- Calculate price: market_value * buy_rate, fall back to sell_price, then default
  v_unit_price := GREATEST(1,
    COALESCE(
      (v_inv.market_value * v_shop_item.buy_rate)::int,
      v_shop_item.sell_price,
      public.default_market_value(v_inv.type, v_inv.rarity)
    )
  );
  v_total_value := v_unit_price * p_quantity;

  UPDATE public.characters SET gold = gold + v_total_value WHERE id = p_character_id;

  v_new_qty := v_inv.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM public.inventory WHERE id = p_inventory_id;
  ELSE
    UPDATE public.inventory SET quantity = v_new_qty WHERE id = p_inventory_id;
  END IF;

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'shop_sell', v_total_value,
    'Sold ' || p_quantity || 'x ' || v_inv.name || ' to shop',
    jsonb_build_object('item_name', v_inv.name, 'quantity', p_quantity, 'unit_price', v_unit_price)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
