-- Migration 032: NPC equipment & loot system
-- NPCs are data-driven enemies with equipment slots and loot tables.
-- Equipment modifies NPC stats. Loot drops are rolled server-side.

-- ============================================================
-- 1. npcs table — base stat definitions
-- ============================================================
CREATE TABLE public.npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  level INT NOT NULL DEFAULT 1,
  base_strength INT NOT NULL DEFAULT 1,
  base_defence INT NOT NULL DEFAULT 1,
  base_speed INT NOT NULL DEFAULT 1,
  base_vitality INT NOT NULL DEFAULT 1,
  hp INT NOT NULL DEFAULT 20,
  gold_min INT NOT NULL DEFAULT 0,
  gold_max INT NOT NULL DEFAULT 5,
  xp_reward INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read npcs"
  ON public.npcs FOR SELECT
  USING (true);

-- ============================================================
-- 2. npc_equipment — binds items to NPC equipment slots
-- ============================================================
CREATE TABLE public.npc_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id UUID NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  slot TEXT NOT NULL CHECK (slot IN ('weapon', 'armor', 'accessory')),
  UNIQUE(npc_id, slot)
);

ALTER TABLE public.npc_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read npc_equipment"
  ON public.npc_equipment FOR SELECT
  USING (true);

-- ============================================================
-- 3. npc_loot — item drop tables per NPC
-- ============================================================
CREATE TABLE public.npc_loot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id UUID NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  chance NUMERIC(4,2) NOT NULL CHECK (chance > 0 AND chance <= 100),
  min_qty INT NOT NULL DEFAULT 1,
  max_qty INT NOT NULL DEFAULT 1,
  UNIQUE(npc_id, item_name)
);

ALTER TABLE public.npc_loot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read npc_loot"
  ON public.npc_loot FOR SELECT
  USING (true);

-- ============================================================
-- 4. get_npc_effective_stats — compute NPC stats with equipment
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_npc_effective_stats(p_npc_id UUID)
RETURNS TABLE (
  strength INT,
  defence INT,
  speed INT,
  vitality INT,
  attack INT,
  defense INT,
  max_hp INT
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_npc RECORD;
  v_str INT;
  v_def INT;
  v_spd INT;
  v_vit INT;
  v_atk INT;
  v_def_bonus INT;
  v_equip RECORD;
  v_stats jsonb;
BEGIN
  SELECT * INTO v_npc FROM public.npcs WHERE id = p_npc_id;
  IF NOT FOUND THEN
    strength := 0; defence := 0; speed := 0; vitality := 0;
    attack := 0; defense := 0; max_hp := 0;
    RETURN NEXT; RETURN;
  END IF;

  v_str := v_npc.base_strength;
  v_def := v_npc.base_defence;
  v_spd := v_npc.base_speed;
  v_vit := v_npc.base_vitality;
  v_atk := 0;
  v_def_bonus := 0;

  FOR v_equip IN
    SELECT i.stats FROM public.npc_equipment ne
    JOIN public.items i ON i.id = ne.item_id
    WHERE ne.npc_id = p_npc_id
  LOOP
    v_stats := v_equip.stats;
    -- Map all possible stat keys from items to the 4 core stats + attack/defense
    v_str := v_str + COALESCE((v_stats->>'strength')::int, 0);
    v_def := v_def + COALESCE((v_stats->>'defence')::int, 0) + COALESCE((v_stats->>'endurance')::int, 0);
    v_spd := v_spd + COALESCE((v_stats->>'speed')::int, 0) + COALESCE((v_stats->>'agility')::int, 0);
    v_vit := v_vit + COALESCE((v_stats->>'vitality')::int, 0);
    v_atk := v_atk + COALESCE((v_stats->>'attack')::int, 0);
    v_def_bonus := v_def_bonus + COALESCE((v_stats->>'defense')::int, 0);
  END LOOP;

  strength := v_str;
  defence := v_def;
  speed := v_spd;
  vitality := v_vit;
  attack := v_str + v_atk;
  defense := v_def + v_def_bonus;
  max_hp := GREATEST(1, v_npc.hp);
  RETURN NEXT;
END;
$$;

-- ============================================================
-- 5. roll_npc_loot — roll loot drops for an NPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.roll_npc_loot(p_npc_id UUID)
RETURNS TABLE (
  item_name TEXT,
  quantity INT
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_loot RECORD;
  v_roll NUMERIC;
  v_qty INT;
BEGIN
  FOR v_loot IN
    SELECT * FROM public.npc_loot WHERE npc_id = p_npc_id
  LOOP
    v_roll := random() * 100;
    IF v_roll <= v_loot.chance THEN
      v_qty := v_loot.min_qty + floor(random() * (v_loot.max_qty - v_loot.min_qty + 1))::int;
      item_name := v_loot.item_name;
      quantity := v_qty;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 6. reward_npc_kill — grants gold, loot, and XP after kill
-- ============================================================
CREATE OR REPLACE FUNCTION public.reward_npc_kill(
  p_character_id UUID,
  p_npc_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_npc RECORD;
  v_gold INT;
  v_loot jsonb := '[]'::jsonb;
  v_loot_row RECORD;
  v_xp_gain INT;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT * INTO v_npc FROM public.npcs WHERE id = p_npc_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NPC not found'; END IF;

  v_gold := v_npc.gold_min + floor(random() * (v_npc.gold_max - v_npc.gold_min + 1))::int;

  UPDATE public.characters SET gold = gold + v_gold WHERE id = p_character_id;

  FOR v_loot_row IN SELECT * FROM public.roll_npc_loot(p_npc_id)
  LOOP
    PERFORM public.give_item(p_character_id, v_loot_row.item_name, v_loot_row.quantity);
    v_loot := v_loot || jsonb_build_object('item', v_loot_row.item_name, 'qty', v_loot_row.quantity);
  END LOOP;

  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'npc_kill', v_gold,
    'Defeated ' || v_npc.name || ' for ' || v_gold || ' gold',
    jsonb_build_object('npc_id', p_npc_id, 'loot', v_loot, 'gold', v_gold)
  );

  RETURN jsonb_build_object(
    'gold', v_gold,
    'loot', v_loot
  );
END;
$$;

-- ============================================================
-- 7. Seed NPC data from the existing combat enemies
-- ============================================================
INSERT INTO public.npcs (name, description, level, base_strength, base_defence, base_speed, base_vitality, hp, gold_min, gold_max, xp_reward) VALUES
  ('Wild Boar', 'A bristle-backed brute that charges first and thinks never.', 1, 3, 1, 4, 3, 15, 1, 5, 10),
  ('Angry Wolf', 'A lean predator that hunts in packs.', 2, 4, 2, 6, 3, 20, 2, 8, 15),
  ('Forest Bear', 'A mountain of muscle and fury.', 3, 6, 3, 3, 6, 35, 5, 15, 25),
  ('Rival Scout', 'Quick and cunning, this rival scout knows how to survive.', 2, 5, 2, 7, 3, 18, 4, 12, 20),
  ('River Serpent', 'A coiled predator that strikes from murky depths.', 1, 3, 1, 5, 2, 12, 2, 6, 12),
  ('Stone Golem', 'A lumbering construct of living rock, slow but unyielding.', 4, 4, 5, 1, 8, 40, 8, 22, 30),
  ('Shadow Stalker', 'A phantom-like assassin that strikes from the shadows.', 3, 7, 1, 8, 3, 22, 6, 18, 28),
  ('Fire Elemental', 'A being of pure flame, crackling with destructive energy.', 4, 8, 2, 5, 5, 25, 10, 26, 35),
  ('Giant Spider', 'A many-legged nightmare that traps its prey.', 2, 5, 2, 5, 3, 16, 3, 9, 18),
  ('Ancient Warden', 'An ancient construct tasked with guarding forgotten halls.', 5, 6, 6, 4, 10, 55, 15, 35, 45);

-- Loot tables for each NPC
-- Wild Boar
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Raw Meat', 60, 1, 2 FROM public.npcs WHERE name = 'Wild Boar';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Boar Hide', 30, 1, 1 FROM public.npcs WHERE name = 'Wild Boar';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Boar Tusk', 10, 1, 1 FROM public.npcs WHERE name = 'Wild Boar';

-- Angry Wolf
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Wolf Pelt', 50, 1, 1 FROM public.npcs WHERE name = 'Angry Wolf';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Raw Meat', 40, 1, 1 FROM public.npcs WHERE name = 'Angry Wolf';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Wolf Fang', 10, 1, 1 FROM public.npcs WHERE name = 'Angry Wolf';

-- Forest Bear
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Thick Fur', 60, 1, 1 FROM public.npcs WHERE name = 'Forest Bear';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Raw Meat', 30, 1, 2 FROM public.npcs WHERE name = 'Forest Bear';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Bear Claw', 10, 1, 1 FROM public.npcs WHERE name = 'Forest Bear';

-- Rival Scout
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Old Coin', 50, 1, 2 FROM public.npcs WHERE name = 'Rival Scout';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Rations', 30, 1, 1 FROM public.npcs WHERE name = 'Rival Scout';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Map Fragment', 20, 1, 1 FROM public.npcs WHERE name = 'Rival Scout';

-- River Serpent
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Serpent Scales', 50, 1, 1 FROM public.npcs WHERE name = 'River Serpent';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'River Stone', 35, 1, 2 FROM public.npcs WHERE name = 'River Serpent';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Serpent Fang', 15, 1, 1 FROM public.npcs WHERE name = 'River Serpent';

-- Stone Golem
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Stone Shard', 60, 1, 2 FROM public.npcs WHERE name = 'Stone Golem';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Crystal Fragment', 25, 1, 1 FROM public.npcs WHERE name = 'Stone Golem';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Golem Core', 15, 1, 1 FROM public.npcs WHERE name = 'Stone Golem';

-- Shadow Stalker
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Shadow Essence', 35, 1, 1 FROM public.npcs WHERE name = 'Shadow Stalker';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Dark Silk', 40, 1, 1 FROM public.npcs WHERE name = 'Shadow Stalker';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Strange Pouch', 25, 1, 1 FROM public.npcs WHERE name = 'Shadow Stalker';

-- Fire Elemental
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Ember Shard', 50, 1, 1 FROM public.npcs WHERE name = 'Fire Elemental';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Fire Essence', 30, 1, 1 FROM public.npcs WHERE name = 'Fire Elemental';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Cinder Ore', 20, 1, 1 FROM public.npcs WHERE name = 'Fire Elemental';

-- Giant Spider
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Silk Web', 55, 1, 1 FROM public.npcs WHERE name = 'Giant Spider';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Spider Venom', 25, 1, 1 FROM public.npcs WHERE name = 'Giant Spider';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Chitin Fragment', 20, 1, 1 FROM public.npcs WHERE name = 'Giant Spider';

-- Ancient Warden
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Ancient Relic', 20, 1, 1 FROM public.npcs WHERE name = 'Ancient Warden';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Warden Plate', 30, 1, 1 FROM public.npcs WHERE name = 'Ancient Warden';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Runic Stone', 35, 1, 1 FROM public.npcs WHERE name = 'Ancient Warden';
INSERT INTO public.npc_loot (npc_id, item_name, chance, min_qty, max_qty)
SELECT id, 'Gold Bar', 15, 1, 1 FROM public.npcs WHERE name = 'Ancient Warden';

-- ============================================================
-- 8. Equip NPCs with items for stat bonuses
-- ============================================================
-- Rival Scout wields a Rusty Dagger (+3 atk)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'weapon'
FROM public.npcs n, public.items i
WHERE n.name = 'Rival Scout' AND i.name = 'Rusty Dagger';

-- Stone Golem wears a Wooden Shield (+3 def, +1 endurance → defence)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'armor'
FROM public.npcs n, public.items i
WHERE n.name = 'Stone Golem' AND i.name = 'Wooden Shield';

-- Shadow Stalker wields a Stone Knife (+2 atk, +1 agility → speed)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'weapon'
FROM public.npcs n, public.items i
WHERE n.name = 'Shadow Stalker' AND i.name = 'Stone Knife';

-- Fire Elemental wears a Traveler's Cloak (+1 def, +1 agility → speed)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'armor'
FROM public.npcs n, public.items i
WHERE n.name = 'Fire Elemental' AND i.name = 'Traveler''s Cloak';

-- Wild Boar wears Bone Gloves (+1 def)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'armor'
FROM public.npcs n, public.items i
WHERE n.name = 'Wild Boar' AND i.name = 'Bone Gloves';

-- River Serpent has a Bone Charm (+2 endurance → defence)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'accessory'
FROM public.npcs n, public.items i
WHERE n.name = 'River Serpent' AND i.name = 'Bone Charm';

-- Angry Wolf wears a Leather Cap (+2 def)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'armor'
FROM public.npcs n, public.items i
WHERE n.name = 'Angry Wolf' AND i.name = 'Leather Cap';

-- Forest Bear wears a Copper Amulet (+2 focus → no direct map, just flavour)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'accessory'
FROM public.npcs n, public.items i
WHERE n.name = 'Forest Bear' AND i.name = 'Copper Amulet';

-- Giant Spider has a Wooden Ring (+2 cunning → no direct map, just flavour)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'accessory'
FROM public.npcs n, public.items i
WHERE n.name = 'Giant Spider' AND i.name = 'Wooden Ring';

-- Ancient Warden wields a Bronze Sword (+7 atk)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'weapon'
FROM public.npcs n, public.items i
WHERE n.name = 'Ancient Warden' AND i.name = 'Bronze Sword';

-- Ancient Warden wears a Hardened Leather Helm (+4 def)
INSERT INTO public.npc_equipment (npc_id, item_id, slot)
SELECT n.id, i.id, 'armor'
FROM public.npcs n, public.items i
WHERE n.name = 'Ancient Warden' AND i.name = 'Hardened Leather Helm';

-- ============================================================
-- 9. Rewrite train() — grants stat points instead of Combat XP
-- ============================================================
DROP FUNCTION IF EXISTS public.train(uuid, text);

CREATE OR REPLACE FUNCTION public.train(
  p_character_id uuid,
  p_activity text
)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_stamina_cost int;
  v_activity_label text;
  v_stat_name text;
  v_stat_gain numeric;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT stamina INTO v_stamina FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  CASE p_activity
    WHEN 'sparring' THEN
      v_stamina_cost := 10; v_activity_label := 'Sparring'; v_stat_name := 'strength';
    WHEN 'conditioning' THEN
      v_stamina_cost := 12; v_activity_label := 'Conditioning'; v_stat_name := 'defence';
    WHEN 'sprinting' THEN
      v_stamina_cost := 10; v_activity_label := 'Sprinting'; v_stat_name := 'speed';
    WHEN 'vitality_training' THEN
      v_stamina_cost := 12; v_activity_label := 'Vitality Training'; v_stat_name := 'vitality';
    ELSE
      RAISE EXCEPTION 'Unknown activity: %', p_activity;
  END CASE;

  IF v_stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  -- Flat stat gain: base +0.5, up to +1.5 with random variance
  v_stat_gain := 0.5 + random() * 1.0;

  EXECUTE format('UPDATE public.characters SET %I = %I + %s WHERE id = $1', v_stat_name, v_stat_name, v_stat_gain)
  USING p_character_id;

  -- Still grant hidden Combat XP for future matchmaking
  PERFORM public.check_skill_xp(p_character_id, 'Combat', GREATEST(1, floor(v_stat_gain * 5)::int));

  RETURN jsonb_build_object(
    'activity', v_activity_label, 'stat', v_stat_name,
    'stat_gain', round(v_stat_gain::numeric, 1),
    'stamina_cost', v_stamina_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. Rewrite explore_step() — grants speed instead of Combat XP
-- ============================================================
DROP FUNCTION IF EXISTS public.explore_step(uuid);

CREATE OR REPLACE FUNCTION public.explore_step(p_character_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_stamina int;
  v_speed int;
  v_stat_gain numeric;
  v_item_name text;
  v_item_qty int;
  v_gold_find int;
  v_trap_damage int;
  v_zone text;
  v_event_type text;
  v_event_text text;

  v_zones text[] := ARRAY['Dark Forest', 'Open Plains', 'Riverbank', 'Jagged Caves', 'Ancient Ruins', 'Deep Swamp'];
  v_event_types text[] := ARRAY['resource','resource','resource','resource','resource','encounter','encounter','encounter','flavor','flavor','flavor','treasure','trap','merchant'];
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT stamina, speed INTO v_stamina, v_speed FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF v_stamina < 5 THEN RAISE EXCEPTION 'Not enough stamina'; END IF;

  UPDATE public.characters SET stamina = stamina - 5, stamina_updated_at = now() WHERE id = p_character_id;

  v_zone := v_zones[1 + floor(random() * array_length(v_zones, 1))::int];
  v_event_type := v_event_types[1 + floor(random() * array_length(v_event_types, 1))::int];

  -- Grant small speed increase for exploring
  v_stat_gain := 0.1 + random() * 0.3;
  UPDATE public.characters SET speed = speed + v_stat_gain WHERE id = p_character_id;

  -- Hidden Combat XP for matchmaking
  PERFORM public.check_skill_xp(p_character_id, 'Combat', GREATEST(1, floor(v_speed * 0.5 + random() * 3)::int));

  IF v_event_type = 'resource' THEN
    CASE v_zone
      WHEN 'Dark Forest' THEN v_item_name := (ARRAY['Wood', 'Herbs', 'Wild Berries', 'Bark Fiber', 'Mushrooms'])[1 + floor(random() * 5)::int];
      WHEN 'Open Plains' THEN v_item_name := (ARRAY['Dry Grass', 'Flint', 'Wild Herbs', 'Clay', 'Feathers'])[1 + floor(random() * 5)::int];
      WHEN 'Riverbank' THEN v_item_name := (ARRAY['River Stone', 'Reed Fiber', 'Driftwood', 'Fish', 'Clay'])[1 + floor(random() * 5)::int];
      WHEN 'Jagged Caves' THEN v_item_name := (ARRAY['Stone', 'Ore Nugget', 'Crystal Shard', 'Bone', 'Cave Mushroom'])[1 + floor(random() * 5)::int];
      WHEN 'Ancient Ruins' THEN v_item_name := (ARRAY['Rusty Gear', 'Ancient Coin', 'Scroll Fragment', 'Old Rope', 'Strange Dust'])[1 + floor(random() * 5)::int];
      WHEN 'Deep Swamp' THEN v_item_name := (ARRAY['Bog Iron', 'Leech', 'Swamp Moss', 'Rotwood', 'Slime'])[1 + floor(random() * 5)::int];
      ELSE v_item_name := 'Wood';
    END CASE;
    v_item_qty := 1 + floor(random() * 3)::int;
    PERFORM public.give_item(p_character_id, v_item_name, v_item_qty);
    v_event_text := 'Found ' || v_item_qty || 'x ' || v_item_name || '!';
  ELSIF v_event_type = 'encounter' THEN
    v_event_text := (ARRAY[
      'A wild boar charges from the undergrowth!',
      'A bandit leaps out, blade drawn!',
      'A territorial wolf snarls at you!',
      'A giant spider drops from above!',
      'A mud-caked golem rises from the swamp!'
    ])[1 + floor(random() * 5)::int];
  ELSIF v_event_type = 'treasure' THEN
    v_event_text := (ARRAY[
      'You discover a hidden cache beneath loose stones!',
      'A rusted chest sits in an alcove!',
      'Something glints in the mud — a treasure!'
    ])[1 + floor(random() * 3)::int];
    v_gold_find := 5 + floor(random() * 10)::int;
    UPDATE public.characters SET gold = gold + v_gold_find WHERE id = p_character_id;
    CASE v_zone
      WHEN 'Jagged Caves' THEN v_item_name := 'Crystal Shard';
      WHEN 'Ancient Ruins' THEN v_item_name := 'Ancient Coin';
      WHEN 'Deep Swamp' THEN v_item_name := 'Bog Iron';
      WHEN 'Dark Forest' THEN v_item_name := 'Mushrooms';
      WHEN 'Riverbank' THEN v_item_name := 'River Stone';
      ELSE v_item_name := 'Flint';
    END CASE;
    v_item_qty := 1 + floor(random() * 3)::int;
    PERFORM public.give_item(p_character_id, v_item_name, v_item_qty);
    v_event_text := v_event_text || ' +' || v_gold_find || ' gold, +' || v_item_qty || 'x ' || v_item_name || '!';
  ELSIF v_event_type = 'trap' THEN
    v_event_text := (ARRAY[
      'You step on a hidden spike trap!',
      'A tripwire catches your ankle — you stumble!',
      'The ground gives way into a shallow pit!'
    ])[1 + floor(random() * 3)::int];
    v_trap_damage := GREATEST(2, 15 - COALESCE(v_speed, 1));
    UPDATE public.characters SET stamina = GREATEST(0, stamina - v_trap_damage), stamina_updated_at = now() WHERE id = p_character_id;
    v_event_text := v_event_text || ' -' || v_trap_damage || ' Stamina!';
  ELSIF v_event_type = 'flavor' THEN
    v_event_text := 'The wind whispers through the trees. You press on.';
  ELSIF v_event_type = 'merchant' THEN
    v_event_text := 'A hooded trader nods at you and continues walking.';
  END IF;

  IF v_event_text IS NULL THEN v_event_text := 'You wander aimlessly for a while.'; END IF;

  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object(
    'zone', v_zone, 'event_type', v_event_type,
    'event_text', v_event_text, 'speed_gain', round(v_stat_gain::numeric, 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11. Rewrite resolve_combat_win() — gives gold + stat point instead of Combat XP
-- ============================================================
DROP FUNCTION IF EXISTS public.resolve_combat_win(uuid, int);

CREATE OR REPLACE FUNCTION public.resolve_combat_win(p_character_id uuid, p_xp_reward int)
RETURNS jsonb AS $$
DECLARE
  v_gold_reward int;
  v_char record;
  v_stat_gain numeric;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF v_char IS NULL THEN RETURN jsonb_build_object('xp', 0, 'gold', 0); END IF;

  v_gold_reward := GREATEST(1, floor((v_char.strength + v_char.speed) * 0.1 + random() * 3))::int;
  UPDATE public.characters SET gold = gold + v_gold_reward WHERE id = p_character_id;

  -- Random stat boost for winning
  v_stat_gain := 0.3 + random() * 0.7;
  CASE floor(random() * 4)::int
    WHEN 0 THEN UPDATE public.characters SET strength = strength + v_stat_gain WHERE id = p_character_id;
    WHEN 1 THEN UPDATE public.characters SET defence = defence + v_stat_gain WHERE id = p_character_id;
    WHEN 2 THEN UPDATE public.characters SET speed = speed + v_stat_gain WHERE id = p_character_id;
    WHEN 3 THEN UPDATE public.characters SET vitality = vitality + v_stat_gain WHERE id = p_character_id;
  END CASE;

  -- Hidden Combat XP for matchmaking
  PERFORM public.check_skill_xp(p_character_id, 'Combat', GREATEST(1, p_xp_reward + floor(random() * 5)::int));

  RETURN jsonb_build_object('xp', 0, 'gold', v_gold_reward);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 12. Rewrite hunt() — uses character strength instead of Combat skill
-- ============================================================
CREATE OR REPLACE FUNCTION public.hunt(
  p_character_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_char RECORD;
  v_skill_level int;
  v_stamina_cost int := 8;
  v_xp_gain int;
  v_equip_str int := 0;
  v_synergy_bonus int := 0;
  v_item_name text;
  v_item_qty int;
  v_item_id uuid;
  v_existing_inv RECORD;
  v_success boolean;
  v_message text;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  SELECT COALESCE(level, 1) INTO v_skill_level FROM public.skills
  WHERE character_id = p_character_id AND name = 'Hunting';

  IF v_char.stamina < v_stamina_cost THEN
    RAISE EXCEPTION 'Not enough stamina (need %)', v_stamina_cost;
  END IF;

  -- Equipment strength bonus
  SELECT COALESCE(SUM((i.stats->>'strength')::int), 0) INTO v_equip_str
  FROM public.inventory inv
  JOIN public.items i ON i.id = inv.item_id
  WHERE inv.character_id = p_character_id AND inv.equipped = true;

  -- Strength synergy bonus (replaces old Combat skill synergy)
  v_synergy_bonus := GREATEST(0, (v_char.strength + v_equip_str) / 10);

  UPDATE public.characters
  SET stamina = stamina - v_stamina_cost, stamina_updated_at = now()
  WHERE id = p_character_id;

  v_success := random() > GREATEST(0.1, 0.5 - v_skill_level * 0.04);

  IF NOT v_success THEN
    v_xp_gain := 5 + floor(random() * 3)::int;
    PERFORM public.check_skill_xp(p_character_id, 'Hunting', v_xp_gain);
    PERFORM public.compute_player_level(p_character_id);
    RETURN jsonb_build_object(
      'success', false, 'xp_gained', v_xp_gain,
      'item_name', null, 'item_qty', 0,
      'stamina_cost', v_stamina_cost,
      'message', 'The prey escaped your trap. Try again.'
    );
  END IF;

  v_item_name := (ARRAY['Raw Meat', 'Rabbit Fur', 'Boar Hide', 'Feathers', 'Bone', 'Sinew'])[1 + floor(random() * 6)::int];
  v_item_qty := 1 + floor(random() * (1 + v_skill_level / 5))::int
              + GREATEST(0, (v_char.strength + v_equip_str) / 4)
              + v_synergy_bonus;

  SELECT id INTO v_item_id FROM public.items WHERE name = v_item_name LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.items (name, type, rarity) VALUES (v_item_name, 'resource', 1)
    RETURNING id INTO v_item_id;
  END IF;

  SELECT id, quantity INTO v_existing_inv
  FROM public.inventory WHERE character_id = p_character_id AND item_id = v_item_id;

  IF FOUND THEN
    UPDATE public.inventory SET quantity = v_existing_inv.quantity + v_item_qty WHERE id = v_existing_inv.id;
  ELSE
    INSERT INTO public.inventory (character_id, item_id, quantity) VALUES (p_character_id, v_item_id, v_item_qty);
  END IF;

  v_xp_gain := 10 + floor(random() * 6)::int;
  PERFORM public.check_skill_xp(p_character_id, 'Hunting', v_xp_gain);
  PERFORM public.compute_player_level(p_character_id);

  RETURN jsonb_build_object(
    'success', true, 'xp_gained', v_xp_gain,
    'item_name', v_item_name, 'item_qty', v_item_qty,
    'stamina_cost', v_stamina_cost,
    'message', 'You caught ' || v_item_qty || 'x ' || v_item_name || '!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
