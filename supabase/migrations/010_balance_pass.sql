-- Migration 010: Balance pass + pet system + town centre

-- ============================================================
-- BALANCE: Training XP reduced, tier-scaled costs
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

-- ============================================================
-- BALANCE: Exploration XP raised to 2-5 + full pet system
-- ============================================================
DROP FUNCTION IF EXISTS public.explore_step(uuid);

CREATE OR REPLACE FUNCTION public.explore_step(p_character_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_xp_gain int;
  v_item_name text;
  v_item_qty int;
  v_item_id uuid;
  v_existing_inv RECORD;
  v_coin_find int;
  v_trap_damage int;
  v_zone text;
  v_event_type text;
  v_event_text text;
  v_pet_found text;
  v_pet_name text;
  v_result jsonb;

  v_zones text[] := ARRAY['Dark Forest', 'Open Plains', 'Riverbank', 'Jagged Caves', 'Ancient Ruins', 'Deep Swamp'];

  v_event_types text[] := ARRAY[
    'resource','resource','resource','resource','resource',
    'encounter','encounter','encounter',
    'flavor','flavor','flavor',
    'treasure',
    'trap',
    'merchant'
  ];

  v_forest_items text[] := ARRAY['Wood', 'Herbs', 'Wild Berries', 'Bark Fiber', 'Mushrooms'];
  v_plains_items text[] := ARRAY['Dry Grass', 'Flint', 'Wild Herbs', 'Clay', 'Feathers'];
  v_river_items text[] := ARRAY['River Stone', 'Reed Fiber', 'Driftwood', 'Fish', 'Clay'];
  v_cave_items text[] := ARRAY['Stone', 'Ore Nugget', 'Crystal Shard', 'Bone', 'Cave Mushroom'];
  v_ruins_items text[] := ARRAY['Rusty Gear', 'Ancient Coin', 'Scroll Fragment', 'Old Rope', 'Strange Dust'];
  v_swamp_items text[] := ARRAY['Bog Iron', 'Leech', 'Swamp Moss', 'Rotwood', 'Slime'];

  v_encounter_texts text[] := ARRAY[
    'A wild boar charges from the undergrowth!',
    'A bandit leaps out, blade drawn!',
    'A territorial wolf snarls at you!',
    'A giant spider drops from above!',
    'A mud-caked golem rises from the swamp!'
  ];

  v_trap_texts text[] := ARRAY[
    'You step on a hidden spike trap!',
    'A tripwire catches your ankle — you stumble!',
    'The ground gives way into a shallow pit!'
  ];

  v_merchant_texts text[] := ARRAY[
    'A hooded trader offers wares from a cart.',
    'A wandering peddler waves you over.',
    'A masked figure sits beside a campfire, trading.'
  ];

  v_treasure_texts text[] := ARRAY[
    'You discover a hidden cache beneath loose stones!',
    'A rusted chest sits in an alcove!',
    'Something glints in the mud — a treasure!'
  ];

  v_zone_combat_xp int;
BEGIN
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < 5 THEN RAISE EXCEPTION 'Not enough stamina'; END IF;

  UPDATE public.characters
  SET stamina = stamina - 5, stamina_updated_at = now()
  WHERE id = p_character_id;

  v_zone := v_zones[1 + floor(random() * array_length(v_zones, 1))::int];
  v_event_type := v_event_types[1 + floor(random() * array_length(v_event_types, 1))::int];

  v_xp_gain := 2 + floor(random() * 4)::int;
  PERFORM public.check_skill_xp(p_character_id, 'Survival', v_xp_gain);

  -- ============================================================
  -- PET FIND SYSTEM (checked on every exploration step)
  --
  -- Rarity tiers (roll 1 - 1,000,000,000):
  --   Goat:         roll = 1           (1 in 1,000,000,000)
  --   Dragon:       roll <= 1000       (1 in 1,000,000)
  --   Wolf:         roll <= 50,000     (1 in 20,000)
  --   Boar:         roll <= 100,000    (1 in 10,000)
  --   Hawk:         roll <= 200,000    (1 in 5,000)
  --   Snake:        roll <= 400,000    (1 in 2,500)
  --
  -- Domesticated pets (cat, dog) are bought at the Pet Shop.
  -- Wild animals (wolf, boar, hawk, snake) are found hunting.
  -- Dragons are mythical — extremely hard to tame.
  -- Goats are the rarest creature in the known world.
  -- ============================================================
  v_pet_found := NULL;
  v_pet_name := NULL;

  DECLARE
    v_pet_roll bigint;
  BEGIN
    v_pet_roll := floor(random() * 1000000000)::bigint + 1;

    IF v_pet_roll = 1 THEN
      -- 1 in 1,000,000,000: GOAT (legendary, 2x base stats)
      v_pet_found := 'goat';
      v_pet_name := 'Divine Goat';
    ELSIF v_pet_roll <= 1000 THEN
      -- 1 in 1,000,000: DRAGON (mythical, extremely difficult to tame)
      v_pet_found := 'dragon';
      v_pet_name := 'Wild Dragon';
    ELSIF v_pet_roll <= 50000 THEN
      -- 1 in 20,000: WOLF (wild, must be hunted/tamed)
      v_pet_found := 'wolf';
      v_pet_name := 'Grey Wolf';
    ELSIF v_pet_roll <= 100000 THEN
      -- 1 in 10,000: BOAR (wild, must be hunted)
      v_pet_found := 'boar';
      v_pet_name := 'Wild Boar';
    ELSIF v_pet_roll <= 200000 THEN
      -- 1 in 5,000: HAWK (wild, must be tamed)
      v_pet_found := 'hawk';
      v_pet_name := 'Wild Hawk';
    ELSIF v_pet_roll <= 400000 THEN
      -- 1 in 2,500: SNAKE (wild, must be caught)
      v_pet_found := 'snake';
      v_pet_name := 'Forest Snake';
    END IF;
  END;

  IF v_pet_found IS NOT NULL THEN
    INSERT INTO public.pets (character_id, type, name, equipped)
    VALUES (p_character_id, v_pet_found, v_pet_name, false);
  END IF;

  -- Zone combat XP
  CASE v_zone
    WHEN 'Dark Forest' THEN v_zone_combat_xp := 8;
    WHEN 'Open Plains' THEN v_zone_combat_xp := 6;
    WHEN 'Riverbank' THEN v_zone_combat_xp := 5;
    WHEN 'Jagged Caves' THEN v_zone_combat_xp := 12;
    WHEN 'Ancient Ruins' THEN v_zone_combat_xp := 15;
    WHEN 'Deep Swamp' THEN v_zone_combat_xp := 14;
    ELSE v_zone_combat_xp := 8;
  END CASE;

  IF v_event_type = 'resource' THEN
    CASE v_zone
      WHEN 'Dark Forest' THEN v_item_name := v_forest_items[1 + floor(random() * array_length(v_forest_items, 1))::int];
      WHEN 'Open Plains' THEN v_item_name := v_plains_items[1 + floor(random() * array_length(v_plains_items, 1))::int];
      WHEN 'Riverbank' THEN v_item_name := v_river_items[1 + floor(random() * array_length(v_river_items, 1))::int];
      WHEN 'Jagged Caves' THEN v_item_name := v_cave_items[1 + floor(random() * array_length(v_cave_items, 1))::int];
      WHEN 'Ancient Ruins' THEN v_item_name := v_ruins_items[1 + floor(random() * array_length(v_ruins_items, 1))::int];
      WHEN 'Deep Swamp' THEN v_item_name := v_swamp_items[1 + floor(random() * array_length(v_swamp_items, 1))::int];
      ELSE v_item_name := 'Wood';
    END CASE;

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

    v_event_text := 'Found ' || v_item_qty || 'x ' || v_item_name || '!';

  ELSIF v_event_type = 'encounter' THEN
    v_event_text := v_encounter_texts[1 + floor(random() * array_length(v_encounter_texts, 1))::int];

  ELSIF v_event_type = 'treasure' THEN
    v_event_text := v_treasure_texts[1 + floor(random() * array_length(v_treasure_texts, 1))::int];
    v_coin_find := 10 + floor(random() * 20)::int;
    UPDATE public.characters SET coins = coins + v_coin_find WHERE id = p_character_id;

    CASE v_zone
      WHEN 'Jagged Caves' THEN v_item_name := 'Crystal Shard';
      WHEN 'Ancient Ruins' THEN v_item_name := 'Ancient Coin';
      WHEN 'Deep Swamp' THEN v_item_name := 'Bog Iron';
      WHEN 'Dark Forest' THEN v_item_name := 'Mushrooms';
      WHEN 'Riverbank' THEN v_item_name := 'River Stone';
      ELSE v_item_name := 'Flint';
    END CASE;

    v_item_qty := 2 + floor(random() * 3)::int;

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

    v_event_text := v_event_text || ' +' || v_coin_find || ' coins, ' || v_item_qty || 'x ' || v_item_name || '!';

  ELSIF v_event_type = 'trap' THEN
    v_event_text := v_trap_texts[1 + floor(random() * array_length(v_trap_texts, 1))::int];
    v_trap_damage := GREATEST(2, 15 - (SELECT cunning FROM public.characters WHERE id = p_character_id));
    UPDATE public.characters
    SET stamina = GREATEST(0, stamina - v_trap_damage), stamina_updated_at = now()
    WHERE id = p_character_id;
    v_event_text := v_event_text || ' -' || v_trap_damage || ' Stamina!';

  ELSIF v_event_type = 'merchant' THEN
    v_event_text := v_merchant_texts[1 + floor(random() * array_length(v_merchant_texts, 1))::int];
    v_event_text := v_event_text || ' They offer a Stamina Potion for 15 coins.';

  ELSE
    CASE v_zone
      WHEN 'Dark Forest' THEN v_event_text := 'The wind rustles through ancient trees. An owl watches from above.';
      WHEN 'Open Plains' THEN v_event_text := 'Tall grass sways endlessly. You hear distant drums.';
      WHEN 'Riverbank' THEN v_event_text := 'Water flows gently over smooth stones. A kingfisher dives.';
      WHEN 'Jagged Caves' THEN v_event_text := 'Dripping echoes fill the dark. Walls glitter with minerals.';
      WHEN 'Ancient Ruins' THEN v_event_text := 'Crumbling pillars rise from the earth. Strange symbols glow faintly.';
      WHEN 'Deep Swamp' THEN v_event_text := 'Thick mist clings to everything. Bubbles rise from the muck.';
      ELSE v_event_text := 'The path stretches on. Nothing of note.';
    END CASE;
  END IF;

  v_result := jsonb_build_object(
    'zone', v_zone,
    'event_type', v_event_type,
    'event_text', v_event_text,
    'xp_gain', v_xp_gain,
    'combat_xp', v_zone_combat_xp,
    'item_found', CASE WHEN v_event_type IN ('resource', 'treasure') THEN v_item_name ELSE null END,
    'item_qty', CASE WHEN v_event_type IN ('resource', 'treasure') THEN v_item_qty ELSE null END,
    'coins_found', CASE WHEN v_event_type = 'treasure' THEN v_coin_find ELSE null END,
    'trap_damage', CASE WHEN v_event_type = 'trap' THEN v_trap_damage ELSE null END,
    'pet_found', v_pet_found,
    'pet_name', v_pet_name
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PET SHOP: Domesticated pets + supplies
-- Pets are actual companion entries (not inventory items)
-- ============================================================
-- Pet shop sells domesticated pets. The shop_buy RPC handles inventory,
-- so pet shop pets are inserted directly into the pets table via a
-- dedicated buy_pet RPC.
CREATE OR REPLACE FUNCTION public.buy_pet(
  p_character_id uuid,
  p_pet_type text,
  p_pet_name text,
  p_cost int
)
RETURNS jsonb AS $$
DECLARE
  v_coins int;
  v_pet_id uuid;
BEGIN
  SELECT coins INTO v_coins FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_coins < p_cost THEN RAISE EXCEPTION 'Not enough coins (need %)', p_cost; END IF;

  -- Validate pet type (only domesticated pets sold in shop)
  IF p_pet_type NOT IN ('cat', 'dog', 'hawk', 'snake') THEN
    RAISE EXCEPTION 'This pet is not available at the Pet Shop';
  END IF;

  -- Deduct coins
  UPDATE public.characters SET coins = coins - p_cost WHERE id = p_character_id;

  -- Create the pet
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

-- Pet shop items (supplies, not the pets themselves)
INSERT INTO shop_items (name, type, tier, description, buy_price, sell_price, stats) VALUES
  ('Leather Collar', 'pet', 1, 'A simple collar for your companion', 25, 8, '{}'),
  ('Sturdy Leash', 'pet', 1, 'Keeps your pet close in dangerous territory', 30, 10, '{}'),
  ('Pet Treats', 'consumable', 1, 'A handful of treats — boosts pet happiness', 12, 4, '{}'),
  ('Grooming Brush', 'pet', 1, 'Keeps your companion looking sharp', 20, 6, '{}'),
  ('Beast Whistle', 'pet', 2, 'A whistle that calls your pet mid-combat', 80, 30, '{}'),
  ('Tamed Harness', 'pet', 2, 'Reinforced harness for wild companions', 120, 45, '{}'),
  ('Exotic Feed', 'pet', 2, 'Premium feed that restores pet energy', 50, 18, '{}'),
  ('Loyal Charm', 'pet', 3, 'An amulet that strengthens the bond with your pet', 200, 80, '{}')
ON CONFLICT (name) DO NOTHING;
