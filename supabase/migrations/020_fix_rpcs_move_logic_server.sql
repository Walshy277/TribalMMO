-- Migration 020: Fix broken RPCs and move all game logic server-side
-- Fixes: check_skill_xp (tier→level), give_item missing, shrine_bless missing,
--        explore_step event system, combat gold rewards, clan management RPCs, auction bidding

-- ============================================================
-- FIX: check_skill_xp (was using deleted 'tier' column)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_skill_xp(p_character_id uuid, p_skill_name text, p_xp_gained int)
RETURNS void AS $$
DECLARE
  v_skill RECORD;
  v_new_xp int;
  v_new_level int;
  v_max_xp int;
BEGIN
  SELECT id, level, experience INTO v_skill
  FROM public.skills
  WHERE character_id = p_character_id AND name = p_skill_name;

  IF NOT FOUND THEN RETURN; END IF;

  v_new_xp := v_skill.experience + p_xp_gained;
  v_max_xp := v_skill.level * 100;

  IF v_new_xp >= v_max_xp AND v_skill.level < 100 THEN
    v_new_level := v_skill.level + 1;
  ELSE
    v_new_level := v_skill.level;
  END IF;

  UPDATE public.skills
  SET experience = v_new_xp, level = v_new_level
  WHERE id = v_skill.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CREATE: give_item helper (used by train RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.give_item(p_character_id uuid, p_item_name text, p_quantity int)
RETURNS void AS $$
DECLARE
  v_item_id uuid;
  v_existing RECORD;
BEGIN
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

-- ============================================================
-- CREATE: shrine_bless (used by shrine_pray)
-- ============================================================
CREATE OR REPLACE FUNCTION public.shrine_bless(p_character_id uuid)
RETURNS text AS $$
DECLARE
  v_stat text;
  v_blessing text;
BEGIN
  v_stat := (ARRAY['strength', 'defence', 'speed', 'vitality'])[1 + floor(random() * 4)::int];

  UPDATE public.characters SET
    strength = CASE WHEN v_stat = 'strength' THEN strength + 1 ELSE strength END,
    defence = CASE WHEN v_stat = 'defence' THEN defence + 1 ELSE defence END,
    speed = CASE WHEN v_stat = 'speed' THEN speed + 1 ELSE speed END,
    vitality = CASE WHEN v_stat = 'vitality' THEN vitality + 1 ELSE vitality END
  WHERE id = p_character_id;

  v_blessing := CASE v_stat
    WHEN 'strength' THEN 'The spirits grant you strength. +1 STR'
    WHEN 'defence' THEN 'A protective ward settles over you. +1 DEF'
    WHEN 'speed' THEN 'Wind quickens your step. +1 SPD'
    WHEN 'vitality' THEN 'Warmth fills your body. +1 VIT'
  END;

  RETURN v_blessing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX: explore_step (complete rewrite with full event system)
-- ============================================================
DROP FUNCTION IF EXISTS public.explore_step(uuid);
CREATE OR REPLACE FUNCTION public.explore_step(p_character_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_speed int;
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
  v_treasure_texts text[] := ARRAY[
    'You discover a hidden cache beneath loose stones!',
    'A rusted chest sits in an alcove!',
    'Something glints in the mud — a treasure!'
  ];
BEGIN
  SELECT stamina, speed INTO v_stamina, v_speed FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < 5 THEN RAISE EXCEPTION 'Not enough stamina'; END IF;

  UPDATE public.characters SET stamina = stamina - 5, stamina_updated_at = now() WHERE id = p_character_id;

  v_zone := v_zones[1 + floor(random() * array_length(v_zones, 1))::int];
  v_event_type := v_event_types[1 + floor(random() * array_length(v_event_types, 1))::int];

  -- Exploration always grants some Combat XP
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
    PERFORM public.give_item(p_character_id, v_item_name, v_item_qty);
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
    PERFORM public.give_item(p_character_id, v_item_name, v_item_qty);
    v_event_text := v_event_text || ' +' || v_gold_find || ' gold, +' || v_item_qty || 'x ' || v_item_name || '!';

  ELSIF v_event_type = 'trap' THEN
    v_event_text := v_trap_texts[1 + floor(random() * array_length(v_trap_texts, 1))::int];
    v_trap_damage := GREATEST(2, 15 - COALESCE(v_speed, 1));
    UPDATE public.characters SET stamina = GREATEST(0, stamina - v_trap_damage), stamina_updated_at = now() WHERE id = p_character_id;
    v_event_text := v_event_text || ' -' || v_trap_damage || ' Stamina!';

  ELSIF v_event_type = 'flavor' THEN
    v_event_text := 'The wind whispers through the trees. You press on.';

  ELSIF v_event_type = 'merchant' THEN
    v_event_text := 'A hooded trader nods at you and continues walking.';
  END IF;

  IF v_event_text IS NULL THEN v_event_text := 'You wander aimlessly for a while.'; END IF;

  UPDATE characters SET level = compute_player_level(p_character_id) WHERE id = p_character_id;

  RETURN jsonb_build_object(
    'zone', v_zone,
    'event_type', v_event_type,
    'event_text', v_event_text,
    'xp_gained', v_xp_gain
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX: resolve_combat_win (add gold reward)
-- ============================================================
DROP FUNCTION IF EXISTS public.resolve_combat_win(uuid, int);
CREATE OR REPLACE FUNCTION public.resolve_combat_win(p_character_id uuid, p_xp_reward int)
RETURNS jsonb AS $$
DECLARE
  v_gold_reward int;
BEGIN
  PERFORM public.check_skill_xp(p_character_id, 'Combat', p_xp_reward);

  v_gold_reward := 5 + floor(random() * 10)::int;
  UPDATE public.characters SET gold = gold + v_gold_reward WHERE id = p_character_id;

  UPDATE characters SET level = compute_player_level(p_character_id) WHERE id = p_character_id;

  RETURN jsonb_build_object('xp', p_xp_reward, 'gold', v_gold_reward);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX: start_action (use level instead of tier for slot check)
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

-- ============================================================
-- FIX: complete_action (gold instead of coins)
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

-- ============================================================
-- FIX: complete_action also updated by019/05 explore_step
-- so we need to make sure the explore_step uses updated functions
-- ============================================================

-- ============================================================
-- CLAN MANAGEMENT RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_clan(p_character_id uuid, p_clan_id uuid)
RETURNS void AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION public.kick_clan_member(p_chieftain_id uuid, p_target_id uuid)
RETURNS void AS $$
DECLARE
  v_chieftain_clan uuid;
BEGIN
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
-- AUCTION: Atomic bid placement
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_bid(p_character_id uuid, p_auction_id uuid, p_bid_amount int)
RETURNS void AS $$
DECLARE
  v_auction RECORD;
BEGIN
  SELECT * INTO v_auction FROM public.auction_house WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auction not found'; END IF;
  IF now() >= v_auction.ends_at THEN RAISE EXCEPTION 'Auction has ended'; END IF;
  IF v_auction.seller_id = p_character_id THEN RAISE EXCEPTION 'Cannot bid on your own auction'; END IF;
  IF p_bid_amount <= v_auction.current_bid THEN RAISE EXCEPTION 'Bid must be higher than current bid'; END IF;
  IF (SELECT gold FROM public.characters WHERE id = p_character_id) < p_bid_amount THEN
    RAISE EXCEPTION 'Not enough gold';
  END IF;

  -- Refund previous bidder
  IF v_auction.current_bidder_id IS NOT NULL THEN
    UPDATE public.characters SET gold = gold + v_auction.current_bid
    WHERE id = v_auction.current_bidder_id;
  END IF;

  -- Deduct gold from new bidder
  UPDATE public.characters SET gold = gold - p_bid_amount WHERE id = p_character_id;

  -- Update auction
  UPDATE public.auction_house
  SET current_bid = p_bid_amount, current_bidder_id = p_character_id
  WHERE id = p_auction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX: admin_update_skill_level (cap at 100)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_skill_level(
  p_character_id uuid,
  p_skill_name text,
  p_new_level int
)
RETURNS void AS $$
BEGIN
  UPDATE public.skills
  SET level = GREATEST(1, LEAST(100, p_new_level))
  WHERE character_id = p_character_id AND name = p_skill_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX: advance_skill (cap at 100)
-- ============================================================
CREATE OR REPLACE FUNCTION public.advance_skill(p_skill_id uuid, p_xp_gain int)
RETURNS jsonb AS $$
DECLARE
  v_skill record;
  v_new_xp int;
  v_max_xp int;
  v_new_level int;
  v_leveled_up boolean;
BEGIN
  SELECT id, level, experience INTO v_skill
  FROM public.skills WHERE id = p_skill_id FOR UPDATE;

  v_new_xp := v_skill.experience + p_xp_gain;
  v_max_xp := v_skill.level * 100;

  IF v_new_xp >= v_max_xp AND v_skill.level < 100 THEN
    v_new_level := v_skill.level + 1;
    v_leveled_up := true;
  ELSE
    v_new_level := v_skill.level;
    v_leveled_up := false;
  END IF;

  UPDATE public.skills
  SET experience = v_new_xp, level = v_new_level
  WHERE id = v_skill.id;

  RETURN jsonb_build_object(
    'leveled_up', v_leveled_up,
    'new_level', v_new_level,
    'xp', v_new_xp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
