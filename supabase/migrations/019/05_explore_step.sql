-- 5. explore_step (new exploration with RNG events, Combat XP, speed-based trap damage)
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
  v_gold_find int;
  v_trap_damage int;
  v_zone text;
  v_event_type text;
  v_event_text text;

  v_zones text[] := ARRAY['Dark Forest', 'Open Plains', 'Riverbank', 'Jagged Caves', 'Ancient Ruins', 'Deep Swamp'];
  v_event_types text[] := ARRAY['resource','resource','resource','resource','resource','encounter','encounter','encounter','flavor','flavor','flavor','treasure','trap','merchant'];
  v_forest_items text[] := ARRAY['Wood', 'Herbs', 'Wild Berries', 'Bark Fiber', 'Mushrooms'];
  v_plains_items text[] := ARRAY['Dry Grass', 'Flint', 'Wild Herbs', 'Clay', 'Feathers'];
  v_river_items text[] := ARRAY['River Stone', 'Reed Fiber', 'Driftwood', 'Fish', 'Clay'];
  v_cave_items text[] := ARRAY['Stone', 'Ore Nugget', 'Crystal Shard', 'Bone', 'Cave Mushroom'];
  v_ruins_items text[] := ARRAY['Rusty Gear', 'Ancient Coin', 'Scroll Fragment', 'Old Rope', 'Strange Dust'];
  v_swamp_items text[] := ARRAY['Bog Iron', 'Leech', 'Swamp Moss', 'Rotwood', 'Slime'];
  v_encounter_texts text[] := ARRAY['A wild boar charges from the undergrowth!','A bandit leaps out, blade drawn!','A territorial wolf snarls at you!','A giant spider drops from above!','A mud-caked golem rises from the swamp!'];
  v_trap_texts text[] := ARRAY['You step on a hidden spike trap!','A tripwire catches your ankle — you stumble!','The ground gives way into a shallow pit!'];
  v_treasure_texts text[] := ARRAY['You discover a hidden cache beneath loose stones!','A rusted chest sits in an alcove!','Something glints in the mud — a treasure!'];
BEGIN
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < 5 THEN RAISE EXCEPTION 'Not enough stamina'; END IF;

  UPDATE public.characters SET stamina = stamina - 5, stamina_updated_at = now() WHERE id = p_character_id;

  v_zone := v_zones[1 + floor(random() * array_length(v_zones, 1))::int];
  v_event_type := v_event_types[1 + floor(random() * array_length(v_event_types, 1))::int];

  v_xp_gain := 3 + floor(random() * 5)::int;
  PERFORM public.check_skill_xp(p_character_id, 'Combat', v_xp_gain);

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
      INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'materials', 1) RETURNING id INTO v_item_id;
    END IF;
    SELECT id, quantity INTO v_existing_inv FROM public.inventory WHERE character_id = p_character_id AND item_id = v_item_id;
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
    v_gold_find := 10 + floor(random() * 20)::int;
    UPDATE public.characters SET gold = gold + v_gold_find WHERE id = p_character_id;
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
      INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'materials', 1) RETURNING id INTO v_item_id;
    END IF;
    SELECT id, quantity INTO v_existing_inv FROM public.inventory WHERE character_id = p_character_id AND item_id = v_item_id;
    IF FOUND THEN
      UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty WHERE id = v_existing_inv.id;
    ELSE
      INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_item_id, v_item_qty);
    END IF;
    v_event_text := v_event_text || ' +' || v_gold_find || ' gold, +' || v_item_qty || 'x ' || v_item_name || '!';

  ELSIF v_event_type = 'trap' THEN
    v_event_text := v_trap_texts[1 + floor(random() * array_length(v_trap_texts, 1))::int];
    v_trap_damage := GREATEST(2, 15 - COALESCE((SELECT speed FROM public.characters WHERE id = p_character_id), 1));
    UPDATE public.characters SET stamina = GREATEST(0, stamina - v_trap_damage), stamina_updated_at = now() WHERE id = p_character_id;
    v_event_text := v_event_text || ' -' || v_trap_damage || ' Stamina!';

  ELSIF v_event_type = 'flavor' THEN
    v_event_text := 'The wind whispers through the trees. You press on.';

  ELSIF v_event_type = 'merchant' THEN
    v_event_text := 'A hooded trader nods at you and continues walking.';
  END IF;

  IF v_event_text IS NULL THEN v_event_text := 'You wander aimlessly for a while.'; END IF;

  UPDATE characters SET level = compute_player_level(p_character_id) WHERE id = p_character_id;

  RETURN jsonb_build_object('zone', v_zone, 'event_type', v_event_type, 'event_text', v_event_text, 'xp_gained', v_xp_gain);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
