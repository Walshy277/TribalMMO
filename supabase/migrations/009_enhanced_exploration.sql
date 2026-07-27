-- Migration 009: Enhanced exploration system
-- Deeper zones, real inventory items, XP per step, more event types

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
  v_result jsonb;

  -- 6 zones with different vibes
  v_zones text[] := ARRAY['Dark Forest', 'Open Plains', 'Riverbank', 'Jagged Caves', 'Ancient Ruins', 'Deep Swamp'];

  -- event weights: resource(5), encounter(3), flavor(3), treasure(1), trap(1), merchant(1) = 14 total
  v_event_types text[] := ARRAY[
    'resource','resource','resource','resource','resource',
    'encounter','encounter','encounter',
    'flavor','flavor','flavor',
    'treasure',
    'trap',
    'merchant'
  ];

  -- Dark Forest resources
  v_forest_items text[] := ARRAY['Wood', 'Herbs', 'Wild Berries', 'Bark Fiber', 'Mushrooms'];
  -- Plains resources
  v_plains_items text[] := ARRAY['Dry Grass', 'Flint', 'Wild Herbs', 'Clay', 'Feathers'];
  -- Riverbank resources
  v_river_items text[] := ARRAY['River Stone', 'Reed Fiber', 'Driftwood', 'Fish', 'Clay'];
  -- Cave resources
  v_cave_items text[] := ARRAY['Stone', 'Ore Nugget', 'Crystal Shard', 'Bone', 'Cave Mushroom'];
  -- Ruins resources
  v_ruins_items text[] := ARRAY['Rusty Gear', 'Ancient Coin', 'Scroll Fragment', 'Old Rope', 'Strange Dust'];
  -- Swamp resources
  v_swamp_items text[] := ARRAY['Bog Iron', 'Leech', 'Swamp Moss', 'Rotwood', 'Slime'];

  v_flavor_by_zone text[] := ARRAY[
    'An owl watches you from a twisted branch.',
    'The wind carries a faint drumbeat.',
    'You hear water flowing nearby.',
    'Dripping echoes fill the darkness.',
    'Crumbling stone stretches before you.',
    'Thick mist clings to the ground.'
  ];

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

  -- combat rewards scale with zone danger
  v_zone_combat_xp int;
BEGIN
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < 5 THEN RAISE EXCEPTION 'Not enough stamina'; END IF;

  -- Deduct stamina
  UPDATE public.characters
  SET stamina = stamina - 5, stamina_updated_at = now()
  WHERE id = p_character_id;

  -- Pick zone and event
  v_zone := v_zones[1 + floor(random() * array_length(v_zones, 1))::int];
  v_event_type := v_event_types[1 + floor(random() * array_length(v_event_types, 1))::int];

  -- XP per step: 1-3 XP to Survival
  v_xp_gain := 1 + floor(random() * 3)::int;
  PERFORM public.check_skill_xp(p_character_id, 'Survival', v_xp_gain);

  -- Default combat XP by zone
  CASE v_zone
    WHEN 'Dark Forest' THEN v_zone_combat_xp := 8;
    WHEN 'Open Plains' THEN v_zone_combat_xp := 6;
    WHEN 'Riverbank' THEN v_zone_combat_xp := 5;
    WHEN 'Jagged Caves' THEN v_zone_combat_xp := 12;
    WHEN 'Ancient Ruins' THEN v_zone_combat_xp := 15;
    WHEN 'Deep Swamp' THEN v_zone_combat_xp := 14;
    ELSE v_zone_combat_xp := 8;
  END CASE;

  -- ===== RESOURCE EVENT =====
  IF v_event_type = 'resource' THEN
    -- Pick item based on zone
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

    -- Find or create item
    SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.items (name, type, tier) VALUES (v_item_name, 'resource', 1)
      RETURNING id INTO v_item_id;
    END IF;

    -- Add to inventory
    SELECT id, quantity INTO v_existing_inv FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_item_id;

    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty
      WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity)
      VALUES (p_character_id, v_item_id, v_item_qty);
    END IF;

    v_event_text := 'Found ' || v_item_qty || 'x ' || v_item_name || '!';

  -- ===== ENCOUNTER EVENT =====
  ELSIF v_event_type = 'encounter' THEN
    v_event_text := v_encounter_texts[1 + floor(random() * array_length(v_encounter_texts, 1))::int];

  -- ===== TREASURE EVENT (rare) =====
  ELSIF v_event_type = 'treasure' THEN
    v_event_text := v_treasure_texts[1 + floor(random() * array_length(v_treasure_texts, 1))::int];

    -- Treasure gives coins + a bonus item
    v_coin_find := 10 + floor(random() * 20)::int;
    UPDATE public.characters SET coins = coins + v_coin_find WHERE id = p_character_id;

    -- Bonus item based on zone
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
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty
      WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity)
      VALUES (p_character_id, v_item_id, v_item_qty);
    END IF;

    v_event_text := v_event_text || ' +' || v_coin_find || ' coins, ' || v_item_qty || 'x ' || v_item_name || '!';

  -- ===== TRAP EVENT =====
  ELSIF v_event_type = 'trap' THEN
    v_event_text := v_trap_texts[1 + floor(random() * array_length(v_trap_texts, 1))::int];

    -- Cunning reduces trap damage; base 8-15
    v_trap_damage := GREATEST(2, 15 - (SELECT cunning FROM public.characters WHERE id = p_character_id));
    UPDATE public.characters
    SET stamina = GREATEST(0, stamina - v_trap_damage), stamina_updated_at = now()
    WHERE id = p_character_id;

    v_event_text := v_event_text || ' -' || v_trap_damage || ' Stamina!';

  -- ===== MERCHANT EVENT =====
  ELSIF v_event_type = 'merchant' THEN
    v_event_text := v_merchant_texts[1 + floor(random() * array_length(v_merchant_texts, 1))::int];
    v_event_text := v_event_text || ' They offer a Stamina Potion for 15 coins.';

  -- ===== FLAVOR EVENT =====
  ELSE
    -- Zone-specific flavor
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
    'trap_damage', CASE WHEN v_event_type = 'trap' THEN v_trap_damage ELSE null END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRAIN: Instant skill training (no timers)
-- ============================================================
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
BEGIN
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  -- Determine cost and skill by activity
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

  IF v_stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  -- Deduct stamina
  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  -- XP: 5-12 per training session
  v_xp_gain := 5 + floor(random() * 8)::int;
  PERFORM public.check_skill_xp(p_character_id, v_skill_name, v_xp_gain);

  -- Item rewards for certain activities
  v_item_name := NULL;
  v_item_qty := 0;
  v_coin_reward := 0;

  IF p_activity = 'foraging' THEN
    -- Random resource
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
    -- Small coin reward for winning bouts
    v_coin_reward := 2 + floor(random() * 5)::int;
    UPDATE public.characters SET coins = coins + v_coin_reward WHERE id = p_character_id;

  ELSIF p_activity = 'conditioning' THEN
    -- Rare chance for a hide
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
