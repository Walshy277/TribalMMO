-- Migration 034: Clan leveling, vault, and building-based community projects
-- Replaces one-off projects with persistent buildings that scale with levels.

-- ============================================================
-- 1. Add level/xp/vault_gold to clans
-- ============================================================
ALTER TABLE public.clans
  ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vault_gold INT NOT NULL DEFAULT 0;

-- ============================================================
-- 2. Clan vault tables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clan_vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id UUID NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity INT NOT NULL DEFAULT 0,
  deposited_by UUID REFERENCES public.characters(id),
  deposited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clan_id, item_id)
);

ALTER TABLE public.clan_vault_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clan_vault_items_select"
  ON public.clan_vault_items FOR SELECT
  USING (clan_id IN (SELECT clan_id FROM public.clan_members WHERE character_id IN (SELECT id FROM public.characters WHERE user_id = auth.uid())));

CREATE TABLE IF NOT EXISTS public.clan_vault_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id UUID NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id),
  action TEXT NOT NULL CHECK (action IN ('deposit_gold', 'withdraw_gold', 'deposit_item', 'withdraw_item')),
  item_name TEXT,
  quantity INT NOT NULL DEFAULT 0,
  gold_amount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clan_vault_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clan_vault_log_select"
  ON public.clan_vault_log FOR SELECT
  USING (clan_id IN (SELECT clan_id FROM public.clan_members WHERE character_id IN (SELECT id FROM public.characters WHERE user_id = auth.uid())));

-- ============================================================
-- 3. Clan buildings — persistent community upgrades
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clan_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id UUID NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  building_type TEXT NOT NULL CHECK (building_type IN (
    'farm', 'lumber_yard', 'quarry', 'forge', 'watchtower', 'treasury', 'barracks', 'library'
  )),
  level INT NOT NULL DEFAULT 0,
  contributed_wood INT NOT NULL DEFAULT 0,
  contributed_stone INT NOT NULL DEFAULT 0,
  contributed_food INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clan_id, building_type)
);

ALTER TABLE public.clan_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clan_buildings_select"
  ON public.clan_buildings FOR SELECT
  USING (clan_id IN (SELECT clan_id FROM public.clan_members WHERE character_id IN (SELECT id FROM public.characters WHERE user_id = auth.uid())));

-- Seed default buildings for existing clans
INSERT INTO public.clan_buildings (clan_id, building_type, level)
SELECT c.id, b.building_type, 1
FROM public.clans c
CROSS JOIN (VALUES
  ('farm'), ('lumber_yard'), ('quarry'), ('forge'),
  ('watchtower'), ('treasury'), ('barracks'), ('library')
) b(building_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.clan_buildings cb WHERE cb.clan_id = c.id AND cb.building_type = b.building_type
);

-- ============================================================
-- 4. Building contribution tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.building_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.clan_buildings(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id),
  wood_contributed INT NOT NULL DEFAULT 0,
  stone_contributed INT NOT NULL DEFAULT 0,
  food_contributed INT NOT NULL DEFAULT 0,
  contributed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.building_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "building_contributions_select"
  ON public.building_contributions FOR SELECT
  USING (building_id IN (
    SELECT cb.id FROM public.clan_buildings cb
    JOIN public.clans c ON c.id = cb.clan_id
    WHERE c.id IN (SELECT clan_id FROM public.clan_members WHERE character_id IN (SELECT id FROM public.characters WHERE user_id = auth.uid()))
  ));

-- ============================================================
-- 5. Function: get_building_cost(level) returns JSON
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_building_cost(p_level INT)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'wood', GREATEST(50, floor(100 * pow(p_level + 1, 1.5))::int),
    'stone', GREATEST(50, floor(100 * pow(p_level + 1, 1.5))::int),
    'food', GREATEST(25, floor(50 * pow(p_level + 1, 1.5))::int)
  );
$$;

-- ============================================================
-- 6. Function: add_clan_xp — add XP and auto-level-up
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_clan_xp(p_clan_id UUID, p_amount INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_level INT;
  v_xp BIGINT;
  v_new_xp BIGINT;
  v_new_level INT;
BEGIN
  SELECT level, xp INTO v_level, v_xp FROM public.clans WHERE id = p_clan_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_new_xp := v_xp + p_amount;

  -- Level thresholds: 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11000, 15000, ...
  LOOP
    EXIT WHEN v_level >= 20;
    IF v_new_xp >= 100 * v_level * (v_level + 1) / 2 * 5 THEN
      v_new_level := v_level + 1;
      v_level := v_new_level;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  UPDATE public.clans SET xp = v_new_xp, level = v_level WHERE id = p_clan_id;

  IF v_level > (SELECT level FROM public.clans WHERE id = p_clan_id) + 0 THEN
    PERFORM public.add_clan_event(p_clan_id, 'level_up', 'Clan reached level ' || v_level || '!');
  END IF;
END;
$$;

-- ============================================================
-- 7. Function: vault_deposit_gold
-- ============================================================
CREATE OR REPLACE FUNCTION public.vault_deposit_gold(
  p_character_id UUID,
  p_amount INT
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_clan_id UUID;
  v_char_gold INT;
  v_role TEXT;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT clan_id, role INTO v_clan_id, v_role FROM public.clan_members WHERE character_id = p_character_id;
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;

  SELECT gold INTO v_char_gold FROM public.characters WHERE id = p_character_id;
  IF v_char_gold < p_amount THEN RAISE EXCEPTION 'Not enough gold'; END IF;

  UPDATE public.characters SET gold = gold - p_amount WHERE id = p_character_id;
  UPDATE public.clans SET vault_gold = vault_gold + p_amount WHERE id = v_clan_id;

  INSERT INTO public.clan_vault_log (clan_id, character_id, action, gold_amount)
  VALUES (v_clan_id, p_character_id, 'deposit_gold', p_amount);

  PERFORM public.add_clan_xp(v_clan_id, GREATEST(1, p_amount / 10));

  RETURN jsonb_build_object('success', true, 'gold', p_amount);
END;
$$;

-- ============================================================
-- 8. Function: vault_withdraw_gold
-- ============================================================
CREATE OR REPLACE FUNCTION public.vault_withdraw_gold(
  p_character_id UUID,
  p_amount INT
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_clan_id UUID;
  v_role TEXT;
  v_vault_gold INT;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT cm.clan_id, cm.role INTO v_clan_id, v_role
  FROM public.clan_members cm WHERE cm.character_id = p_character_id;
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;
  IF v_role NOT IN ('chieftain', 'elder') THEN RAISE EXCEPTION 'Only chieftain or elder can withdraw from vault'; END IF;

  SELECT vault_gold INTO v_vault_gold FROM public.clans WHERE id = v_clan_id;
  IF v_vault_gold < p_amount THEN RAISE EXCEPTION 'Not enough gold in vault'; END IF;

  UPDATE public.clans SET vault_gold = vault_gold - p_amount WHERE id = v_clan_id;
  UPDATE public.characters SET gold = gold + p_amount WHERE id = p_character_id;

  INSERT INTO public.clan_vault_log (clan_id, character_id, action, gold_amount)
  VALUES (v_clan_id, p_character_id, 'withdraw_gold', p_amount);

  RETURN jsonb_build_object('success', true, 'gold', p_amount);
END;
$$;

-- ============================================================
-- 9. Function: vault_deposit_item
-- ============================================================
CREATE OR REPLACE FUNCTION public.vault_deposit_item(
  p_character_id UUID,
  p_item_name TEXT,
  p_quantity INT
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_clan_id UUID;
  v_item_id UUID;
  v_inv_id UUID;
  v_inv_qty INT;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT clan_id INTO v_clan_id FROM public.clan_members WHERE character_id = p_character_id;
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;

  SELECT id INTO v_item_id FROM public.items WHERE name = p_item_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown item: %', p_item_name; END IF;

  SELECT id, quantity INTO v_inv_id, v_inv_qty
  FROM public.inventory WHERE character_id = p_character_id AND item_id = v_item_id;
  IF NOT FOUND OR v_inv_qty < p_quantity THEN RAISE EXCEPTION 'Not enough items'; END IF;

  IF v_inv_qty <= p_quantity THEN
    DELETE FROM public.inventory WHERE id = v_inv_id;
  ELSE
    UPDATE public.inventory SET quantity = v_inv_qty - p_quantity WHERE id = v_inv_id;
  END IF;

  INSERT INTO public.clan_vault_items (clan_id, item_id, quantity, deposited_by)
  VALUES (v_clan_id, v_item_id, p_quantity, p_character_id)
  ON CONFLICT (clan_id, item_id)
  DO UPDATE SET quantity = public.clan_vault_items.quantity + p_quantity;

  INSERT INTO public.clan_vault_log (clan_id, character_id, action, item_name, quantity)
  VALUES (v_clan_id, p_character_id, 'deposit_item', p_item_name, p_quantity);

  PERFORM public.add_clan_xp(v_clan_id, GREATEST(1, p_quantity / 5));

  RETURN jsonb_build_object('success', true, 'item', p_item_name, 'quantity', p_quantity);
END;
$$;

-- ============================================================
-- 10. Function: vault_withdraw_item
-- ============================================================
CREATE OR REPLACE FUNCTION public.vault_withdraw_item(
  p_character_id UUID,
  p_item_name TEXT,
  p_quantity INT
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_clan_id UUID;
  v_role TEXT;
  v_item_id UUID;
  v_vault_qty INT;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT cm.clan_id, cm.role INTO v_clan_id, v_role
  FROM public.clan_members cm WHERE cm.character_id = p_character_id;
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;
  IF v_role NOT IN ('chieftain', 'elder', 'hunter', 'gatherer') THEN RAISE EXCEPTION 'Insufficient rank to withdraw from vault'; END IF;

  SELECT id INTO v_item_id FROM public.items WHERE name = p_item_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown item: %', p_item_name; END IF;

  SELECT quantity INTO v_vault_qty FROM public.clan_vault_items WHERE clan_id = v_clan_id AND item_id = v_item_id;
  IF NOT FOUND OR v_vault_qty < p_quantity THEN RAISE EXCEPTION 'Not enough items in vault'; END IF;

  PERFORM public.give_item(p_character_id, p_item_name, p_quantity);

  IF v_vault_qty <= p_quantity THEN
    DELETE FROM public.clan_vault_items WHERE clan_id = v_clan_id AND item_id = v_item_id;
  ELSE
    UPDATE public.clan_vault_items SET quantity = v_vault_qty - p_quantity WHERE clan_id = v_clan_id AND item_id = v_item_id;
  END IF;

  INSERT INTO public.clan_vault_log (clan_id, character_id, action, item_name, quantity)
  VALUES (v_clan_id, p_character_id, 'withdraw_item', p_item_name, p_quantity);

  RETURN jsonb_build_object('success', true, 'item', p_item_name, 'quantity', p_quantity);
END;
$$;

-- ============================================================
-- 11. Function: contribute_to_building — contribute resources
-- ============================================================
CREATE OR REPLACE FUNCTION public.contribute_to_building(
  p_character_id UUID,
  p_building_id UUID,
  p_wood INT DEFAULT 0,
  p_stone INT DEFAULT 0,
  p_food INT DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_clan_id UUID;
  v_building RECORD;
  v_cost jsonb;
  v_total_contrib INT;
  v_daily_contrib INT;
  v_wood_inv_id UUID;
  v_wood_qty INT;
  v_stone_inv_id UUID;
  v_stone_qty INT;
  v_food_inv_id UUID;
  v_food_qty INT;
  v_wood_item_id UUID;
  v_stone_item_id UUID;
  v_food_item_id UUID;
  v_remaining_wood INT := p_wood;
  v_remaining_stone INT := p_stone;
  v_remaining_food INT := p_food;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  IF p_wood < 0 OR p_stone < 0 OR p_food < 0 THEN
    RAISE EXCEPTION 'Negative contributions not allowed';
  END IF;

  IF p_wood + p_stone + p_food = 0 THEN
    RAISE EXCEPTION 'Must contribute at least one resource';
  END IF;

  SELECT c.id, cm.role INTO v_clan_id
  FROM public.clan_members cm
  JOIN public.clans c ON c.id = cm.clan_id
  WHERE cm.character_id = p_character_id;
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;

  SELECT * INTO v_building FROM public.clan_buildings WHERE id = p_building_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Building not found'; END IF;
  IF v_building.clan_id != v_clan_id THEN RAISE EXCEPTION 'Building does not belong to your clan'; END IF;

  -- Daily contribution cap check (50 total per day per character per building)
  SELECT COALESCE(SUM(wood_contributed + stone_contributed + food_contributed), 0)::INT
  INTO v_daily_contrib
  FROM public.building_contributions
  WHERE building_id = p_building_id AND character_id = p_character_id
    AND contributed_at > now() - interval '24 hours';

  IF v_daily_contrib + p_wood + p_stone + p_food > 50 THEN
    RAISE EXCEPTION 'Daily contribution cap reached (max 50 total per day)';
  END IF;

  -- Deduct items from inventory
  SELECT id INTO v_wood_item_id FROM public.items WHERE name = 'Wood' LIMIT 1;
  SELECT id INTO v_stone_item_id FROM public.items WHERE name = 'Stone' LIMIT 1;
  SELECT id INTO v_food_item_id FROM public.items WHERE name = 'Wild Berries' LIMIT 1;

  -- Deduct Wood
  IF p_wood > 0 THEN
    SELECT id, quantity INTO v_wood_inv_id, v_wood_qty
    FROM public.inventory WHERE character_id = p_character_id AND item_id = v_wood_item_id;
    IF NOT FOUND OR v_wood_qty < p_wood THEN
      RAISE EXCEPTION 'Not enough Wood (have %, need %)', COALESCE(v_wood_qty, 0), p_wood;
    END IF;
    IF v_wood_qty <= p_wood THEN DELETE FROM public.inventory WHERE id = v_wood_inv_id;
    ELSE UPDATE public.inventory SET quantity = v_wood_qty - p_wood WHERE id = v_wood_inv_id;
    END IF;
  END IF;

  -- Deduct Stone
  IF p_stone > 0 THEN
    SELECT id, quantity INTO v_stone_inv_id, v_stone_qty
    FROM public.inventory WHERE character_id = p_character_id AND item_id = v_stone_item_id;
    IF NOT FOUND OR v_stone_qty < p_stone THEN
      RAISE EXCEPTION 'Not enough Stone (have %, need %)', COALESCE(v_stone_qty, 0), p_stone;
    END IF;
    IF v_stone_qty <= p_stone THEN DELETE FROM public.inventory WHERE id = v_stone_inv_id;
    ELSE UPDATE public.inventory SET quantity = v_stone_qty - p_stone WHERE id = v_stone_inv_id;
    END IF;
  END IF;

  -- Deduct Food (Wild Berries)
  IF p_food > 0 THEN
    SELECT id, quantity INTO v_food_inv_id, v_food_qty
    FROM public.inventory WHERE character_id = p_character_id AND item_id = v_food_item_id;
    IF NOT FOUND OR v_food_qty < p_food THEN
      RAISE EXCEPTION 'Not enough Wild Berries (have %, need %)', COALESCE(v_food_qty, 0), p_food;
    END IF;
    IF v_food_qty <= p_food THEN DELETE FROM public.inventory WHERE id = v_food_inv_id;
    ELSE UPDATE public.inventory SET quantity = v_food_qty - p_food WHERE id = v_food_inv_id;
    END IF;
  END IF;

  -- Record contribution
  INSERT INTO public.building_contributions (building_id, character_id, wood_contributed, stone_contributed, food_contributed)
  VALUES (p_building_id, p_character_id, p_wood, p_stone, p_food);

  UPDATE public.clan_buildings
  SET contributed_wood = contributed_wood + p_wood,
      contributed_stone = contributed_stone + p_stone,
      contributed_food = contributed_food + p_food
  WHERE id = p_building_id;

  -- Add clan XP
  PERFORM public.add_clan_xp(v_clan_id, GREATEST(1, (p_wood + p_stone + p_food) / 2));

  -- Check if level-up threshold met
  v_cost := public.get_building_cost(v_building.level);
  IF v_building.contributed_wood + p_wood >= (v_cost->>'wood')::int
     AND v_building.contributed_stone + p_stone >= (v_cost->>'stone')::int
     AND v_building.contributed_food + p_food >= (v_cost->>'food')::int
  THEN
    UPDATE public.clan_buildings
    SET level = level + 1,
        contributed_wood = 0,
        contributed_stone = 0,
        contributed_food = 0
    WHERE id = p_building_id;

    PERFORM public.add_clan_event(v_clan_id, 'project_completed',
      v_building.building_type || ' reached level ' || (v_building.level + 1) || '!');

    RETURN jsonb_build_object(
      'success', true, 'leveled_up', true,
      'new_level', v_building.level + 1,
      'building_type', v_building.building_type,
      'wood_used', p_wood, 'stone_used', p_stone, 'food_used', p_food
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'leveled_up', false,
    'building_type', v_building.building_type,
    'wood_used', p_wood, 'stone_used', p_stone, 'food_used', p_food
  );
END;
$$;

-- ============================================================
-- 12. Function: get_clan_buildings_with_progress
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_clan_buildings_with_progress(p_clan_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', cb.id,
      'building_type', cb.building_type,
      'level', cb.level,
      'contributed_wood', cb.contributed_wood,
      'contributed_stone', cb.contributed_stone,
      'contributed_food', cb.contributed_food,
      'cost', public.get_building_cost(cb.level)
    )
  ) INTO v_result
  FROM public.clan_buildings cb
  WHERE cb.clan_id = p_clan_id
  ORDER BY cb.building_type;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================================
-- 13. Function: get_clan_vault_contents
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_clan_vault_contents(p_clan_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_result jsonb;
  v_gold INT;
BEGIN
  SELECT vault_gold INTO v_gold FROM public.clans WHERE id = p_clan_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'item_name', i.name,
      'quantity', cvi.quantity,
      'rarity', i.rarity,
      'type', i.type
    )
  ) INTO v_result
  FROM public.clan_vault_items cvi
  JOIN public.items i ON i.id = cvi.item_id
  WHERE cvi.clan_id = p_clan_id AND cvi.quantity > 0
  ORDER BY i.name;

  RETURN jsonb_build_object(
    'gold', COALESCE(v_gold, 0),
    'items', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- ============================================================
-- 14. Add clan XP triggers to existing donation/project functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.donate_to_clan(
  p_character_id UUID,
  p_food INT DEFAULT 0,
  p_wood INT DEFAULT 0,
  p_stone INT DEFAULT 0,
  p_gold INT DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_clan_id UUID;
  v_char_gold INT;
  v_total_donated INT := 0;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT clan_id INTO v_clan_id FROM public.clan_members WHERE character_id = p_character_id;
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;

  IF p_gold > 0 THEN
    SELECT gold INTO v_char_gold FROM public.characters WHERE id = p_character_id;
    IF v_char_gold < p_gold THEN RAISE EXCEPTION 'Not enough gold'; END IF;
    UPDATE public.characters SET gold = gold - p_gold WHERE id = p_character_id;
  END IF;

  UPDATE public.clan_members
  SET total_donated_food = total_donated_food + p_food,
      total_donated_wood = total_donated_wood + p_wood,
      total_donated_stone = total_donated_stone + p_stone,
      total_donated_gold = total_donated_gold + p_gold
  WHERE character_id = p_character_id;

  UPDATE public.clans
  SET food = food + p_food, wood = wood + p_wood, stone = stone + p_stone,
      gold = gold + p_gold, morale = LEAST(100, morale + CASE WHEN p_food + p_wood + p_stone + p_gold > 0 THEN 1 ELSE 0 END)
  WHERE id = v_clan_id;

  v_total_donated := p_food + p_wood + p_stone + p_gold;
  IF v_total_donated > 0 THEN
    PERFORM public.add_clan_xp(v_clan_id, GREATEST(1, v_total_donated / 10 + 1));
  END IF;

  IF p_food > 0 OR p_wood > 0 OR p_stone > 0 OR p_gold > 0 THEN
    PERFORM public.add_clan_event(v_clan_id, 'donation',
      'A member donated ' || p_food || ' food, ' || p_wood || ' wood, ' || p_stone || ' stone, ' || p_gold || ' gold.');
  END IF;
END;
$$;
