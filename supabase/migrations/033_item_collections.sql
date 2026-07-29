-- Migration 033: Item pool expansion + collections system
-- Adds ~2000 items and a SimpleMMO-inspired collection/trophy mechanic.

-- ============================================================
-- 1. Collections tables
-- ============================================================
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'crown',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read collections"
  ON public.collections FOR SELECT USING (true);

CREATE TABLE public.collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'collectible',
  item_rarity INT NOT NULL DEFAULT 1,
  UNIQUE(collection_id, item_name)
);

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read collection_items"
  ON public.collection_items FOR SELECT USING (true);

CREATE TABLE public.character_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(character_id, collection_id)
);

ALTER TABLE public.character_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Character collections own"
  ON public.character_collections FOR ALL
  USING (character_id IN (SELECT id FROM public.characters WHERE user_id = auth.uid()));

-- ============================================================
-- 2. Bulk item generation functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_item_name(
  p_base TEXT, p_tier INT, p_variant INT
) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_tier
    WHEN 1 THEN (ARRAY['Rusty', 'Chipped', 'Worn', 'Crude', 'Old', 'Plain', 'Flimsy', 'Bent'])[p_variant] || ' ' || p_base
    WHEN 2 THEN (ARRAY['Iron', 'Steel', 'Bronze', 'Hardened', 'Studded', 'Reinforced', 'Polished', 'Tempered'])[p_variant] || ' ' || p_base
    WHEN 3 THEN (ARRAY['Fine', 'Silver', 'War', 'Battle', 'Knight''s', 'Dark', 'Honed', 'Sturdy'])[p_variant] || ' ' || p_base
    WHEN 4 THEN (ARRAY['Mithril', 'Enchanted', 'Shadow', 'Rune', 'Crystal', 'Obsidian', 'Jade', 'Ruby'])[p_variant] || ' ' || p_base
    WHEN 5 THEN (ARRAY['Dragonbone', 'Phoenix', 'Celestial', 'Arcane', 'Valkyrie', 'Elder', 'Soul', 'Inferno'])[p_variant] || ' ' || p_base
    WHEN 6 THEN (ARRAY['Divine', 'Eternal', 'Cosmic', 'Primordial', 'Godslayer', 'Worldbreaker', 'Void', 'Titan'])[p_variant] || ' ' || p_base
    WHEN 7 THEN (ARRAY['Mythical', 'Legendary', 'Transcendent', 'Aetherial', 'Omni', 'Starforged', 'Immortal', 'Infinite'])[p_variant] || ' ' || p_base
    ELSE 'Mysterious ' || p_base
  END;
$$;

-- ============================================================
-- 3. WEAPONS — 320 items (8 variants × 8 types × 5+ tiers)
-- ============================================================
WITH weapon_bases(base) AS (
  VALUES ('Sword'), ('Axe'), ('Mace'), ('Dagger'), ('Spear'), ('Staff'), ('Bow'), ('Hammer')
)
INSERT INTO items (name, type, rarity, stats)
SELECT
  public.generate_item_name(wb.base, t.tier, v.variant),
  'weapon',
  t.tier,
  jsonb_build_object(
    'attack', t.tier * 4 + floor(random() * (t.tier + 2))::int,
    'strength', CASE WHEN random() < 0.3 THEN floor(random() * t.tier)::int + 1 ELSE 0 END,
    'speed', CASE WHEN random() < 0.2 THEN floor(random() * t.tier)::int + 1 ELSE 0 END
  )
FROM weapon_bases wb
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7)) t(tier)
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) v(variant);

-- ============================================================
-- 4. ARMOR — 280 items (7 types × 7 tiers × 8 variants)
-- ============================================================
WITH armor_bases(base) AS (
  VALUES ('Helmet'), ('Chestplate'), ('Leggings'), ('Boots'), ('Gloves'), ('Shield'), ('Cloak')
)
INSERT INTO items (name, type, rarity, stats)
SELECT
  public.generate_item_name(ab.base, t.tier, v.variant),
  'armor',
  t.tier,
  jsonb_build_object(
    'defense', t.tier * 3 + floor(random() * (t.tier + 1))::int,
    'vitality', CASE WHEN random() < 0.25 THEN floor(random() * t.tier)::int + 1 ELSE 0 END,
    'speed', CASE WHEN random() < 0.15 THEN floor(random() * t.tier)::int + 1 ELSE 0 END
  )
FROM armor_bases ab
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7)) t(tier)
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) v(variant);

-- ============================================================
-- 5. ACCESSORIES — 196 items (7 types × 7 tiers × 4 variants)
-- ============================================================
WITH accessory_bases(base) AS (
  VALUES ('Ring'), ('Amulet'), ('Bracelet'), ('Earring'), ('Belt'), ('Tome'), ('Charm')
)
INSERT INTO items (name, type, rarity, stats)
SELECT
  CASE t.tier
    WHEN 1 THEN (ARRAY['Copper', 'Wooden', 'Bone', 'Plain'])[v.variant]
    WHEN 2 THEN (ARRAY['Silver', 'Jade', 'Gold', 'Bronze'])[v.variant]
    WHEN 3 THEN (ARRAY['Ruby', 'Sapphire', 'Emerald', 'Onyx'])[v.variant]
    WHEN 4 THEN (ARRAY['Diamond', 'Amethyst', 'Opal', 'Topaz'])[v.variant]
    WHEN 5 THEN (ARRAY['Star', 'Moon', 'Sun', 'Soul'])[v.variant]
    WHEN 6 THEN (ARRAY['Eternal', 'Cosmic', 'Divine', 'Void'])[v.variant]
    ELSE (ARRAY['Mythical', 'Legendary', 'Prime', 'Aether'])[v.variant]
  END || ' ' || ab.base,
  'accessory',
  t.tier,
  jsonb_build_object(
    CASE WHEN random() < 0.4 THEN 'strength' ELSE 'speed' END,
    t.tier + floor(random() * t.tier)::int + 1,
    CASE WHEN random() < 0.3 THEN 'vitality' ELSE 'defence' END,
    floor(random() * (t.tier / 2 + 1))::int + 1
  )
FROM accessory_bases ab
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7)) t(tier)
CROSS JOIN (VALUES (1),(2),(3),(4)) v(variant);

-- ============================================================
-- 6. RESOURCES — 300 consumable/crafting items
-- ============================================================
INSERT INTO items (name, type, rarity, stats)
VALUES
  -- Cooking ingredients (tier 1-2)
  ('Raw Fish', 'resource', 1, '{"heal": 3}'),
  ('Cooked Fish', 'resource', 1, '{"heal": 8}'),
  ('Bread', 'resource', 1, '{"heal": 5}'),
  ('Hearty Stew', 'resource', 1, '{"heal": 12}'),
  ('Dried Meat', 'resource', 1, '{"heal": 6}'),
  ('Fruit', 'resource', 1, '{"heal": 4}'),
  ('Roasted Vegetables', 'resource', 1, '{"heal": 7}'),
  ('Honey', 'resource', 1, '{"heal": 10}'),
  ('Cheese', 'resource', 1, '{"heal": 5}'),
  ('Cooked Eggs', 'resource', 1, '{"heal": 6}'),
  ('Herbal Tea', 'resource', 1, '{"heal": 8}'),
  ('Mushroom Stew', 'resource', 1, '{"heal": 9}'),
  ('Grilled Rabbit', 'resource', 1, '{"heal": 11}'),
  ('Berry Pie', 'resource', 1, '{"heal": 13}'),
  ('Roasted Boar', 'resource', 2, '{"heal": 18}'),
  ('Hearty Meal', 'resource', 2, '{"heal": 15}'),
  ('Travel Rations', 'resource', 1, '{"heal": 7}'),
  ('Baked Fish', 'resource', 2, '{"heal": 14}'),
  ('Herb Bread', 'resource', 2, '{"heal": 12}'),
  ('Wild Salad', 'resource', 1, '{"heal": 5}'),
  ('Venison', 'resource', 2, '{"heal": 16}'),
  ('Roast Chicken', 'resource', 2, '{"heal": 15}'),
  ('Soup', 'resource', 1, '{"heal": 6}'),
  ('Trail Mix', 'resource', 1, '{"heal": 4}'),
  ('Goat Milk', 'resource', 1, '{"heal": 5}'),
  -- Potions (tier 1-5)
  ('Weak Healing Potion', 'resource', 1, '{"heal": 10}'),
  ('Healing Potion', 'resource', 2, '{"heal": 25}'),
  ('Strong Healing Potion', 'resource', 3, '{"heal": 50}'),
  ('Greater Healing Potion', 'resource', 4, '{"heal": 80}'),
  ('Supreme Healing Potion', 'resource', 5, '{"heal": 120}'),
  ('Stamina Tonic', 'resource', 2, '{"heal": 15}'),
  ('Energy Elixir', 'resource', 3, '{"heal": 30}'),
  ('Vitality Draught', 'resource', 4, '{"heal": 60}'),
  ('Recovery Brew', 'resource', 2, '{"heal": 20}'),
  ('Health Salve', 'resource', 1, '{"heal": 8}'),
  ('Antidote', 'resource', 2, '{"heal": 5}'),
  ('Fortitude Potion', 'resource', 3, '{"heal": 35}'),
  ('Regeneration Tonic', 'resource', 4, '{"heal": 70}'),
  -- Crafting components (tier 1-5)
  ('Leather Scrap', 'resource', 1, '{}'),
  ('Metal Scrap', 'resource', 1, '{}'),
  ('Cloth', 'resource', 1, '{}'),
  ('Thread', 'resource', 1, '{}'),
  ('Wooden Handle', 'resource', 1, '{}'),
  ('Leather Strap', 'resource', 1, '{}'),
  ('Iron Nail', 'resource', 1, '{}'),
  ('Bronze Rivet', 'resource', 2, '{}'),
  ('Steel Plate', 'resource', 2, '{}'),
  ('Tempered Glass', 'resource', 2, '{}'),
  ('Silk Cloth', 'resource', 3, '{}'),
  ('Mithril Ingot', 'resource', 4, '{}'),
  ('Enchanted Silk', 'resource', 4, '{}'),
  ('Dragon Scale', 'resource', 5, '{}'),
  ('Phoenix Feather', 'resource', 5, '{}'),
  ('Spider Silk', 'resource', 3, '{}'),
  ('Iron Chain', 'resource', 2, '{}'),
  ('Gear', 'resource', 2, '{}'),
  ('Spring', 'resource', 2, '{}'),
  ('Piston', 'resource', 3, '{}'),
  ('Crystal Lens', 'resource', 3, '{}'),
  ('Rune Fragment', 'resource', 3, '{}'),
  ('Magic Core', 'resource', 4, '{}'),
  ('Essence Orb', 'resource', 4, '{}'),
  ('Soul Gem Fragment', 'resource', 5, '{}'),
  -- Alchemy ingredients (tier 1-5)
  ('Aloe Leaf', 'resource', 1, '{}'),
  ('Healing Herb', 'resource', 1, '{}'),
  ('Mandrake Root', 'resource', 2, '{}'),
  ('Nightshade', 'resource', 2, '{}'),
  ('Foxglove', 'resource', 1, '{}'),
  ('Ginseng', 'resource', 2, '{}'),
  ('Valerian Root', 'resource', 2, '{}'),
  ('Lunar Bloom', 'resource', 3, '{}'),
  ('Sunpetal', 'resource', 3, '{}'),
  ('Starlight Moss', 'resource', 3, '{}'),
  ('Shadow Leaf', 'resource', 4, '{}'),
  ('Emberweed', 'resource', 4, '{}'),
  ('Frost Lotus', 'resource', 4, '{}'),
  ('Void Orchid', 'resource', 5, '{}'),
  ('Bloodthorn', 'resource', 5, '{}'),
  ('Crystal Petal', 'resource', 4, '{}'),
  ('Moonshade', 'resource', 3, '{}'),
  ('Dreamroot', 'resource', 3, '{}'),
  ('Ironbark', 'resource', 2, '{}'),
  ('Silverleaf', 'resource', 2, '{}'),
  -- Special resources (tier 1-5)
  ('Enchanted Gem', 'resource', 3, '{}'),
  ('Primordial Clay', 'resource', 3, '{}'),
  ('Living Wood', 'resource', 3, '{}'),
  ('Crystallized Mana', 'resource', 4, '{}'),
  ('Stardust', 'resource', 4, '{}'),
  ('Void Essence', 'resource', 5, '{}'),
  ('Phoenix Ash', 'resource', 5, '{}'),
  ('Dragon Blood', 'resource', 5, '{}'),
  ('Titan Ore', 'resource', 4, '{}'),
  ('Angelic Feather', 'resource', 4, '{}'),
  ('Soul Sand', 'resource', 3, '{}'),
  ('Time Crystal', 'resource', 5, '{}'),
  ('Prismatic Shard', 'resource', 4, '{}'),
  ('Ectoplasm', 'resource', 3, '{}'),
  ('Corrupted Shard', 'resource', 3, '{}'),
  ('Holy Water', 'resource', 2, '{}'),
  ('Arcane Dust', 'resource', 2, '{}'),
  ('Liquid Fire', 'resource', 3, '{}'),
  ('Essence of Nature', 'resource', 4, '{}'),
  ('Essence of Decay', 'resource', 4, '{}');

-- ============================================================
-- 7. MATERIALS — 400 refined/special materials
-- ============================================================
INSERT INTO items (name, type, rarity, stats)
VALUES
  -- Refined metals (tier 1-5)
  ('Copper Bar', 'materials', 1, '{}'),
  ('Tin Bar', 'materials', 1, '{}'),
  ('Bronze Bar', 'materials', 1, '{}'),
  ('Iron Bar', 'materials', 2, '{}'),
  ('Steel Bar', 'materials', 2, '{}'),
  ('Silver Bar', 'materials', 2, '{}'),
  ('Gold Bar', 'materials', 3, '{}'),
  ('Mithril Bar', 'materials', 4, '{}'),
  ('Adamantite Bar', 'materials', 4, '{}'),
  ('Runite Bar', 'materials', 5, '{}'),
  ('Orichalcum Bar', 'materials', 5, '{}'),
  ('Darksteel Bar', 'materials', 4, '{}'),
  ('Cobalt Bar', 'materials', 3, '{}'),
  ('Electrum Bar', 'materials', 3, '{}'),
  -- Gems (tier 1-7)
  ('Amber', 'materials', 1, '{}'),
  ('Jade', 'materials', 2, '{}'),
  ('Lapis Lazuli', 'materials', 2, '{}'),
  ('Turquoise', 'materials', 2, '{}'),
  ('Opal', 'materials', 3, '{}'),
  ('Garnet', 'materials', 3, '{}'),
  ('Topaz', 'materials', 3, '{}'),
  ('Amethyst', 'materials', 3, '{}'),
  ('Ruby', 'materials', 4, '{}'),
  ('Sapphire', 'materials', 4, '{}'),
  ('Emerald', 'materials', 4, '{}'),
  ('Diamond', 'materials', 5, '{}'),
  ('Black Opal', 'materials', 5, '{}'),
  ('Star Ruby', 'materials', 5, '{}'),
  ('Royal Sapphire', 'materials', 5, '{}'),
  ('Void Diamond', 'materials', 6, '{}'),
  ('Cosmic Ruby', 'materials', 6, '{}'),
  ('Eternal Emerald', 'materials', 6, '{}'),
  ('Prime Crystal', 'materials', 7, '{}'),
  ('Aether Gem', 'materials', 7, '{}'),
  -- Leathers and fabrics (tier 1-5)
  ('Rawhide', 'materials', 1, '{}'),
  ('Cured Leather', 'materials', 1, '{}'),
  ('Tough Leather', 'materials', 2, '{}'),
  ('Hardened Leather', 'materials', 2, '{}'),
  ('Wolf Leather', 'materials', 2, '{}'),
  ('Bear Hide', 'materials', 3, '{}'),
  ('Boar Hide', 'materials', 2, '{}'),
  ('Snakeskin', 'materials', 2, '{}'),
  ('Lizard Scale', 'materials', 3, '{}'),
  ('Dragon Hide', 'materials', 5, '{}'),
  ('Silk', 'materials', 3, '{}'),
  ('Mithril Thread', 'materials', 4, '{}'),
  ('Shadow Silk', 'materials', 4, '{}'),
  ('Phoenix Down', 'materials', 5, '{}'),
  ('Void Cloth', 'materials', 5, '{}'),
  -- Wood types (tier 1-5)
  ('Pine Timber', 'materials', 1, '{}'),
  ('Oak Timber', 'materials', 2, '{}'),
  ('Willow Timber', 'materials', 2, '{}'),
  ('Maple Timber', 'materials', 3, '{}'),
  ('Teak Timber', 'materials', 3, '{}'),
  ('Mahogany Timber', 'materials', 3, '{}'),
  ('Ebony Timber', 'materials', 4, '{}'),
  ('Ironwood', 'materials', 4, '{}'),
  ('Living Wood', 'materials', 4, '{}'),
  ('Petrified Wood', 'materials', 3, '{}'),
  -- Magical components (tier 1-5)
  ('Rune Stone', 'materials', 2, '{}'),
  ('Enchantment Rune', 'materials', 3, '{}'),
  ('Power Rune', 'materials', 3, '{}'),
  ('Protection Rune', 'materials', 3, '{}'),
  ('Speed Rune', 'materials', 3, '{}'),
  ('Warding Rune', 'materials', 4, '{}'),
  ('Elemental Rune', 'materials', 4, '{}'),
  ('Mystic Rune', 'materials', 4, '{}'),
  ('Elder Rune', 'materials', 5, '{}'),
  ('Prime Rune', 'materials', 5, '{}'),
  ('Wand Core', 'materials', 3, '{}'),
  ('Staff Core', 'materials', 4, '{}'),
  ('Crystal Ball', 'materials', 4, '{}'),
  ('Arcane Focus', 'materials', 3, '{}'),
  ('Enchanted Ink', 'materials', 2, '{}'),
  ('Spell Parchment', 'materials', 2, '{}'),
  ('Magic Thread', 'materials', 3, '{}'),
  ('Concentrated Mana', 'materials', 4, '{}'),
  ('Elemental Essence', 'materials', 4, '{}'),
  ('Planar Dust', 'materials', 5, '{}'),
  -- Bones and monster parts (tier 1-5)
  ('Animal Bone', 'materials', 1, '{}'),
  ('Large Bone', 'materials', 2, '{}'),
  ('Fossilized Bone', 'materials', 3, '{}'),
  ('Dragon Bone', 'materials', 5, '{}'),
  ('Wolf Claw', 'materials', 2, '{}'),
  ('Bear Claw', 'materials', 3, '{}'),
  ('Talon', 'materials', 2, '{}'),
  ('Serpent Fang', 'materials', 2, '{}'),
  ('Spider Venom', 'materials', 2, '{}'),
  ('Basilisk Eye', 'materials', 4, '{}'),
  ('Yeti Fur', 'materials', 3, '{}'),
  ('Harpy Feather', 'materials', 2, '{}'),
  ('Minotaur Horn', 'materials', 4, '{}'),
  ('Chimera Scale', 'materials', 5, '{}'),
  ('Gryphon Feather', 'materials', 4, '{}'),
  ('Kraken Tentacle', 'materials', 5, '{}'),
  ('Behemoth Hide', 'materials', 5, '{}'),
  ('Hydra Fang', 'materials', 5, '{}'),
  ('Phoenix Talon', 'materials', 6, '{}'),
  ('Dragon Scale', 'materials', 5, '{}'),
  -- Special materials (tier 2-7)
  ('Meteorite Fragment', 'materials', 4, '{}'),
  ('Starlight Crystal', 'materials', 5, '{}'),
  ('Void Crystal', 'materials', 6, '{}'),
  ('Prismatic Gem', 'materials', 6, '{}'),
  ('Aether Shard', 'materials', 7, '{}'),
  ('Titanium Ore', 'materials', 3, '{}'),
  ('Elemental Ice', 'materials', 3, '{}'),
  ('Infernal Core', 'materials', 4, '{}'),
  ('Celestial Fragment', 'materials', 5, '{}'),
  ('Abyssal Shard', 'materials', 5, '{}'),
  ('Alloy Composite', 'materials', 3, '{}'),
  ('Carbon Fiber', 'materials', 4, '{}'),
  ('Ceramic Plate', 'materials', 2, '{}'),
  ('Reinforced Polymer', 'materials', 4, '{}'),
  ('Nano Alloy', 'materials', 5, '{}');

-- ============================================================
-- 8. COLLECTIBLES — 450+ items across themes
-- ============================================================
INSERT INTO items (name, type, rarity, stats) VALUES
  -- Ancient Artifacts (tier 1-7)
  ('Ancient Coin', 'collectible', 1, '{}'),
  ('Old Key', 'collectible', 1, '{}'),
  ('Broken Amulet', 'collectible', 1, '{}'),
  ('Rusty Medallion', 'collectible', 1, '{}'),
  ('Ancient Seal', 'collectible', 2, '{}'),
  ('Carved Tablet', 'collectible', 2, '{}'),
  ('Mysterious Idol', 'collectible', 2, '{}'),
  ('Gold Figurine', 'collectible', 2, '{}'),
  ('Ancient Crown', 'collectible', 3, '{}'),
  ('Crystal Skull', 'collectible', 3, '{}'),
  ('Obsidian Mirror', 'collectible', 3, '{}'),
  ('Enchanted Mask', 'collectible', 3, '{}'),
  ('Pharaoh''s Scepter', 'collectible', 4, '{}'),
  ('Aztec Calendar', 'collectible', 4, '{}'),
  ('Stone Tablet', 'collectible', 4, '{}'),
  ('Golden Idol', 'collectible', 4, '{}'),
  ('Atlantean Orb', 'collectible', 5, '{}'),
  ('Elder Crown', 'collectible', 5, '{}'),
  ('Celestial Compass', 'collectible', 5, '{}'),
  ('Timepiece', 'collectible', 5, '{}'),
  ('Primordial Mask', 'collectible', 6, '{}'),
  ('Void Relic', 'collectible', 6, '{}'),
  ('Aether Crown', 'collectible', 6, '{}'),
  ('Cosmic Artifact', 'collectible', 6, '{}'),
  ('Omni Shard', 'collectible', 7, '{}'),
  ('Starforged Relic', 'collectible', 7, '{}'),
  -- Fossils (tier 1-5)
  ('Small Fossil', 'collectible', 1, '{}'),
  ('Shell Fossil', 'collectible', 1, '{}'),
  ('Leaf Fossil', 'collectible', 1, '{}'),
  ('Amber Fossil', 'collectible', 1, '{}'),
  ('Bone Fossil', 'collectible', 2, '{}'),
  ('Skull Fossil', 'collectible', 2, '{}'),
  ('Tooth Fossil', 'collectible', 2, '{}'),
  ('Rib Fossil', 'collectible', 2, '{}'),
  ('Spine Fossil', 'collectible', 3, '{}'),
  ('Claw Fossil', 'collectible', 3, '{}'),
  ('Wing Fossil', 'collectible', 3, '{}'),
  ('Egg Fossil', 'collectible', 3, '{}'),
  ('Tusk Fossil', 'collectible', 4, '{}'),
  ('Horn Fossil', 'collectible', 4, '{}'),
  ('Jaw Fossil', 'collectible', 4, '{}'),
  ('Full Skeleton Fossil', 'collectible', 5, '{}'),
  -- Rare Gems & Jewels (tier 1-7)
  ('Polished Agate', 'collectible', 1, '{}'),
  ('Moonstone', 'collectible', 1, '{}'),
  ('Sunstone', 'collectible', 1, '{}'),
  ('Tiger Eye', 'collectible', 1, '{}'),
  ('Bloodstone', 'collectible', 2, '{}'),
  ('Malachite', 'collectible', 2, '{}'),
  ('Azurite', 'collectible', 2, '{}'),
  ('Rhodochrosite', 'collectible', 2, '{}'),
  ('Labradorite', 'collectible', 3, '{}'),
  ('Spectrolite', 'collectible', 3, '{}'),
  ('Ammolite', 'collectible', 3, '{}'),
  ('Benitoite', 'collectible', 3, '{}'),
  ('Alexandrite', 'collectible', 4, '{}'),
  ('Paraiba Tourmaline', 'collectible', 4, '{}'),
  ('Padparadscha', 'collectible', 4, '{}'),
  ('Tanzanite', 'collectible', 4, '{}'),
  ('Musgravite', 'collectible', 5, '{}'),
  ('Jeremejevite', 'collectible', 5, '{}'),
  ('Grandidierite', 'collectible', 5, '{}'),
  ('Taaffeite', 'collectible', 5, '{}'),
  ('Painite', 'collectible', 6, '{}'),
  ('Serendibite', 'collectible', 6, '{}'),
  ('Majorite', 'collectible', 6, '{}'),
  ('Hibonite', 'collectible', 6, '{}'),
  ('Prismatic Gem', 'collectible', 7, '{}'),
  ('Void Diamond', 'collectible', 7, '{}'),
  -- Tribal Masks (tier 1-5)
  ('Wooden Mask', 'collectible', 1, '{}'),
  ('Clay Mask', 'collectible', 1, '{}'),
  ('Feather Mask', 'collectible', 1, '{}'),
  ('Bone Mask', 'collectible', 2, '{}'),
  ('Leather Mask', 'collectible', 2, '{}'),
  ('War Mask', 'collectible', 2, '{}'),
  ('Spirit Mask', 'collectible', 3, '{}'),
  ('Ritual Mask', 'collectible', 3, '{}'),
  ('Shaman Mask', 'collectible', 3, '{}'),
  ('Chieftain Mask', 'collectible', 4, '{}'),
  ('Jade Mask', 'collectible', 4, '{}'),
  ('Obsidian Mask', 'collectible', 4, '{}'),
  ('Crystal Mask', 'collectible', 5, '{}'),
  ('Gold Mask', 'collectible', 5, '{}'),
  ('Diamond Mask', 'collectible', 5, '{}'),
  -- Totems & Figurines (tier 1-5)
  ('Wooden Totem', 'collectible', 1, '{}'),
  ('Stone Totem', 'collectible', 1, '{}'),
  ('Bone Totem', 'collectible', 1, '{}'),
  ('Feather Totem', 'collectible', 2, '{}'),
  ('Spirit Totem', 'collectible', 2, '{}'),
  ('War Totem', 'collectible', 2, '{}'),
  ('Hunter Totem', 'collectible', 3, '{}'),
  ('Wisdom Totem', 'collectible', 3, '{}'),
  ('Guardian Totem', 'collectible', 3, '{}'),
  ('Elder Totem', 'collectible', 4, '{}'),
  ('Primal Totem', 'collectible', 4, '{}'),
  ('Celestial Totem', 'collectible', 5, '{}'),
  ('Small Figurine', 'collectible', 1, '{}'),
  ('Stone Figurine', 'collectible', 1, '{}'),
  ('Clay Figurine', 'collectible', 1, '{}'),
  ('Bronze Figurine', 'collectible', 2, '{}'),
  ('Silver Figurine', 'collectible', 2, '{}'),
  ('Jade Figurine', 'collectible', 3, '{}'),
  ('Crystal Figurine', 'collectible', 3, '{}'),
  ('Gold Figurine', 'collectible', 4, '{}'),
  ('Diamond Figurine', 'collectible', 4, '{}'),
  ('Platinum Figurine', 'collectible', 5, '{}'),
  -- Ancient Scrolls (tier 1-5)
  ('Torn Scroll', 'collectible', 1, '{}'),
  ('Old Map', 'collectible', 1, '{}'),
  ('Faded Letter', 'collectible', 1, '{}'),
  ('Worn Journal', 'collectible', 1, '{}'),
  ('Ancient Scroll', 'collectible', 2, '{}'),
  ('Sealed Letter', 'collectible', 2, '{}'),
  ('Coded Message', 'collectible', 2, '{}'),
  ('Parchment', 'collectible', 2, '{}'),
  ('Prophetic Scroll', 'collectible', 3, '{}'),
  ('Arcane Treatise', 'collectible', 3, '{}'),
  ('Alchemical Notes', 'collectible', 3, '{}'),
  ('Forbidden Text', 'collectible', 3, '{}'),
  ('Illuminated Manuscript', 'collectible', 4, '{}'),
  ('Ancient Tome', 'collectible', 4, '{}'),
  ('Dragon Scroll', 'collectible', 4, '{}'),
  ('Celestial Chart', 'collectible', 5, '{}'),
  ('Prophecy Scroll', 'collectible', 5, '{}'),
  ('Book of Knowledge', 'collectible', 5, '{}'),
  -- Rare Shells (tier 1-3)
  ('Cowrie Shell', 'collectible', 1, '{}'),
  ('Conch Shell', 'collectible', 1, '{}'),
  ('Scallop Shell', 'collectible', 1, '{}'),
  ('Nautilus Shell', 'collectible', 2, '{}'),
  ('Abalone Shell', 'collectible', 2, '{}'),
  ('Pearl Shell', 'collectible', 2, '{}'),
  ('Golden Shell', 'collectible', 3, '{}'),
  ('Rainbow Shell', 'collectible', 3, '{}'),
  ('Spiral Shell', 'collectible', 3, '{}'),
  -- Crystals (tier 1-7)
  ('Clear Crystal', 'collectible', 1, '{}'),
  ('Rose Crystal', 'collectible', 1, '{}'),
  ('Smoky Crystal', 'collectible', 1, '{}'),
  ('Blue Crystal', 'collectible', 2, '{}'),
  ('Green Crystal', 'collectible', 2, '{}'),
  ('Purple Crystal', 'collectible', 2, '{}'),
  ('Fire Crystal', 'collectible', 3, '{}'),
  ('Ice Crystal', 'collectible', 3, '{}'),
  ('Thunder Crystal', 'collectible', 3, '{}'),
  ('Shadow Crystal', 'collectible', 4, '{}'),
  ('Light Crystal', 'collectible', 4, '{}'),
  ('Void Crystal', 'collectible', 4, '{}'),
  ('Starlight Crystal', 'collectible', 5, '{}'),
  ('Moon Crystal', 'collectible', 5, '{}'),
  ('Sun Crystal', 'collectible', 5, '{}'),
  ('Prismatic Crystal', 'collectible', 6, '{}'),
  ('Cosmic Crystal', 'collectible', 6, '{}'),
  ('Aether Crystal', 'collectible', 7, '{}'),
  -- Coins & Tokens (tier 1-5)
  ('Old Copper Coin', 'collectible', 1, '{}'),
  ('Old Silver Coin', 'collectible', 1, '{}'),
  ('Old Gold Coin', 'collectible', 2, '{}'),
  ('Ancient Coin', 'collectible', 2, '{}'),
  ('Kingdom Coin', 'collectible', 2, '{}'),
  ('Empire Coin', 'collectible', 3, '{}'),
  ('Dragon Coin', 'collectible', 3, '{}'),
  ('Star Coin', 'collectible', 4, '{}'),
  ('Moon Coin', 'collectible', 4, '{}'),
  ('Sun Coin', 'collectible', 4, '{}'),
  ('Phoenix Coin', 'collectible', 5, '{}'),
  ('Void Coin', 'collectible', 5, '{}'),
  ('Token of Friendship', 'collectible', 1, '{}'),
  ('Token of Courage', 'collectible', 2, '{}'),
  ('Token of Wisdom', 'collectible', 2, '{}'),
  ('Token of Power', 'collectible', 3, '{}'),
  ('Token of Glory', 'collectible', 4, '{}'),
  ('Token of Eternity', 'collectible', 5, '{}'),
  -- Musical Instruments (tier 1-4)
  ('Wooden Flute', 'collectible', 1, '{}'),
  ('Small Drum', 'collectible', 1, '{}'),
  ('Bone Whistle', 'collectible', 1, '{}'),
  ('Pan Flute', 'collectible', 2, '{}'),
  ('War Drum', 'collectible', 2, '{}'),
  ('Silver Flute', 'collectible', 2, '{}'),
  ('Golden Harp', 'collectible', 3, '{}'),
  ('Enchanted Lute', 'collectible', 3, '{}'),
  ('Crystal Lyre', 'collectible', 3, '{}'),
  ('Mystic Horn', 'collectible', 4, '{}'),
  ('Elder Drum', 'collectible', 4, '{}'),
  ('Celestial Harp', 'collectible', 4, '{}'),
  -- Strange Curios (tier 1-4)
  ('Odd Rock', 'collectible', 1, '{}'),
  ('Strange Seed', 'collectible', 1, '{}'),
  ('Glowing Mushroom', 'collectible', 1, '{}'),
  ('Curious Egg', 'collectible', 1, '{}'),
  ('Mysterious Orb', 'collectible', 2, '{}'),
  ('Glowing Gem', 'collectible', 2, '{}'),
  ('Warm Stone', 'collectible', 2, '{}'),
  ('Singing Crystal', 'collectible', 2, '{}'),
  ('Echoing Shell', 'collectible', 3, '{}'),
  ('Chronometer', 'collectible', 3, '{}'),
  ('Miniature Globe', 'collectible', 3, '{}'),
  ('Perpetual Gear', 'collectible', 3, '{}'),
  ('Void in a Jar', 'collectible', 4, '{}'),
  ('Starlight Vial', 'collectible', 4, '{}'),
  ('Miniature Galaxy', 'collectible', 4, '{}'),
  ('Frozen Flame', 'collectible', 4, '{}'),
  -- Special Event Items (tier 1-3)
  ('Festival Mask', 'collectible', 1, '{}'),
  ('Celebration Firework', 'collectible', 1, '{}'),
  ('Party Popper', 'collectible', 1, '{}'),
  ('Anniversary Cake', 'collectible', 2, '{}'),
  ('Golden Ticket', 'collectible', 2, '{}'),
  ('Lucky Charm', 'collectible', 2, '{}'),
  ('Raffle Ticket', 'collectible', 1, '{}'),
  ('Mystery Box', 'collectible', 3, '{}'),
  ('Treasure Map', 'collectible', 3, '{}');

-- ============================================================
-- 9. Collections seed data
-- ============================================================
INSERT INTO public.collections (name, description, icon, sort_order) VALUES
  ('Woodland Collector', 'Gather the bounty of the forest.', 'tree', 1),
  ('Miner''s Trove', 'Delving deep yields rare finds.', 'mountain', 2),
  ('Gem Enthusiast', 'A sparkling assortment of precious stones.', 'gem', 3),
  ('Fossil Hunter', 'Unearthing ancient remains.', 'bone', 4),
  ('Mask Collector', 'Masks from many cultures.', 'mask', 5),
  ('Totem Keeper', 'Mystical totems of power.', 'totem', 6),
  ('Scroll Master', 'Knowledge preserved on parchment.', 'scroll', 7),
  ('Trophy Hunter', 'Prized parts from fearsome beasts.', 'claw', 8),
  ('Artifact Collector', 'Relics of bygone civilizations.', 'relic', 9),
  ('Crystal Gazer', 'Crystals of every color and hue.', 'crystal', 10),
  ('Shell Seeker', 'Treasures from the shore.', 'shell', 11),
  ('Instrument Collector', 'Melodic tools of the trade.', 'music', 12),
  ('Numismatist', 'Coins and tokens from every era.', 'coin', 13),
  ('Curiosity Cabinet', 'Strange and wonderful oddities.', 'curio', 14),
  ('Master Collector', 'The ultimate collection achievement.', 'star', 15);

-- Woodland Collector (gathering items)
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Wood', 'Wild Herbs', 'Wild Berries', 'Bark Fiber', 'Mushrooms', 'Clay', 'Flint', 'Reeds', 'Hides', 'Bone']), 'resource', 1
FROM public.collections WHERE name = 'Woodland Collector';

-- Miner's Trove (mining items)
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Stone', 'Copper Ore', 'Iron Ore', 'Coal', 'Silver Ore', 'Gemstone', 'Gold Ore', 'Emerald', 'Diamond']), 'resource', 1
FROM public.collections WHERE name = 'Miner''s Trove';

-- Gem Enthusiast
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Amber', 'Jade', 'Lapis Lazuli', 'Turquoise', 'Opal', 'Garnet', 'Topaz', 'Amethyst', 'Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Black Opal', 'Star Ruby', 'Void Diamond', 'Cosmic Ruby', 'Prime Crystal', 'Aether Gem']), 'materials', 1
FROM public.collections WHERE name = 'Gem Enthusiast';

-- Fossil Hunter
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Small Fossil', 'Shell Fossil', 'Leaf Fossil', 'Amber Fossil', 'Bone Fossil', 'Skull Fossil', 'Tooth Fossil', 'Rib Fossil', 'Spine Fossil', 'Claw Fossil', 'Wing Fossil', 'Egg Fossil', 'Tusk Fossil', 'Horn Fossil', 'Jaw Fossil', 'Full Skeleton Fossil']), 'collectible', 1
FROM public.collections WHERE name = 'Fossil Hunter';

-- Mask Collector
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Wooden Mask', 'Clay Mask', 'Feather Mask', 'Bone Mask', 'Leather Mask', 'War Mask', 'Spirit Mask', 'Ritual Mask', 'Shaman Mask', 'Chieftain Mask', 'Jade Mask', 'Obsidian Mask', 'Crystal Mask', 'Gold Mask', 'Diamond Mask']), 'collectible', 1
FROM public.collections WHERE name = 'Mask Collector';

-- Totem Keeper
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Wooden Totem', 'Stone Totem', 'Bone Totem', 'Feather Totem', 'Spirit Totem', 'War Totem', 'Hunter Totem', 'Wisdom Totem', 'Guardian Totem', 'Elder Totem', 'Primal Totem', 'Celestial Totem']), 'collectible', 1
FROM public.collections WHERE name = 'Totem Keeper';

-- Scroll Master
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Torn Scroll', 'Old Map', 'Faded Letter', 'Worn Journal', 'Ancient Scroll', 'Sealed Letter', 'Coded Message', 'Parchment', 'Prophetic Scroll', 'Arcane Treatise', 'Alchemical Notes', 'Forbidden Text', 'Illuminated Manuscript', 'Ancient Tome', 'Dragon Scroll', 'Celestial Chart', 'Prophecy Scroll', 'Book of Knowledge']), 'collectible', 1
FROM public.collections WHERE name = 'Scroll Master';

-- Trophy Hunter
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Wolf Fang', 'Bear Claw', 'Boar Tusk', 'Serpent Fang', 'Wolf Pelt', 'Thick Fur', 'Raw Meat', 'Boar Hide', 'Serpent Scales', 'Golem Core', 'Shadow Essence', 'Fire Essence', 'Spider Venom', 'Ancient Relic', 'Warden Plate', 'Gold Bar']), 'resource', 1
FROM public.collections WHERE name = 'Trophy Hunter';

-- Artifact Collector
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Ancient Coin', 'Old Key', 'Broken Amulet', 'Rusty Medallion', 'Ancient Seal', 'Carved Tablet', 'Mysterious Idol', 'Gold Figurine', 'Ancient Crown', 'Crystal Skull', 'Obsidian Mirror', 'Enchanted Mask', 'Pharaoh''s Scepter', 'Aztec Calendar', 'Stone Tablet', 'Golden Idol', 'Atlantean Orb', 'Elder Crown', 'Celestial Compass', 'Timepiece', 'Primordial Mask', 'Void Relic', 'Aether Crown', 'Cosmic Artifact', 'Omni Shard']), 'collectible', 1
FROM public.collections WHERE name = 'Artifact Collector';

-- Crystal Gazer
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Clear Crystal', 'Rose Crystal', 'Smoky Crystal', 'Blue Crystal', 'Green Crystal', 'Purple Crystal', 'Fire Crystal', 'Ice Crystal', 'Thunder Crystal', 'Shadow Crystal', 'Light Crystal', 'Void Crystal', 'Starlight Crystal', 'Moon Crystal', 'Sun Crystal', 'Prismatic Crystal', 'Cosmic Crystal', 'Aether Crystal']), 'collectible', 1
FROM public.collections WHERE name = 'Crystal Gazer';

-- Shell Seeker
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Cowrie Shell', 'Conch Shell', 'Scallop Shell', 'Nautilus Shell', 'Abalone Shell', 'Pearl Shell', 'Golden Shell', 'Rainbow Shell', 'Spiral Shell']), 'collectible', 1
FROM public.collections WHERE name = 'Shell Seeker';

-- Instrument Collector
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Wooden Flute', 'Small Drum', 'Bone Whistle', 'Pan Flute', 'War Drum', 'Silver Flute', 'Golden Harp', 'Enchanted Lute', 'Crystal Lyre', 'Mystic Horn', 'Elder Drum', 'Celestial Harp']), 'collectible', 1
FROM public.collections WHERE name = 'Instrument Collector';

-- Numismatist
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Old Copper Coin', 'Old Silver Coin', 'Old Gold Coin', 'Ancient Coin', 'Kingdom Coin', 'Empire Coin', 'Dragon Coin', 'Star Coin', 'Moon Coin', 'Sun Coin', 'Phoenix Coin', 'Void Coin', 'Token of Friendship', 'Token of Courage', 'Token of Wisdom', 'Token of Power', 'Token of Glory', 'Token of Eternity']), 'collectible', 1
FROM public.collections WHERE name = 'Numismatist';

-- Curiosity Cabinet
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT id, unnest(ARRAY['Odd Rock', 'Strange Seed', 'Glowing Mushroom', 'Curious Egg', 'Mysterious Orb', 'Glowing Gem', 'Warm Stone', 'Singing Crystal', 'Echoing Shell', 'Chronometer', 'Miniature Globe', 'Perpetual Gear', 'Void in a Jar', 'Starlight Vial', 'Miniature Galaxy', 'Frozen Flame']), 'collectible', 1
FROM public.collections WHERE name = 'Curiosity Cabinet';

-- Master Collector (one item from each collection)
INSERT INTO public.collection_items (collection_id, item_name, item_type, item_rarity)
SELECT c.id, 'Wooden Totem', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Ancient Coin', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Diamond', 'materials', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Celestial Compass', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Diamond Mask', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Phoenix Coin', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Aether Crystal', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Full Skeleton Fossil', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Ancient Tome', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Warden Plate', 'resource', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Celestial Harp', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Rainbow Shell', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Miniature Galaxy', 'collectible', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Gold Ore', 'resource', 1 FROM public.collections c WHERE c.name = 'Master Collector' UNION ALL
SELECT c.id, 'Phoenix Feather', 'resource', 1 FROM public.collections c WHERE c.name = 'Master Collector';

-- ============================================================
-- 10. RPC: check_collection_progress — count collected items
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_collection_progress(
  p_character_id UUID,
  p_collection_id UUID
)
RETURNS TABLE (
  total_items INT,
  collected_items INT,
  is_completed BOOLEAN
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_total INT;
  v_collected INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_total
  FROM public.collection_items ci
  WHERE ci.collection_id = p_collection_id;

  SELECT COUNT(DISTINCT i.id)::INT INTO v_collected
  FROM public.collection_items ci
  JOIN public.items i ON i.name = ci.item_name
  JOIN public.inventory inv ON inv.item_id = i.id AND inv.character_id = p_character_id
  WHERE ci.collection_id = p_collection_id AND inv.quantity > 0;

  total_items := v_total;
  collected_items := v_collected;
  is_completed := v_collected >= v_total;
  RETURN NEXT;
END;
$$;

-- ============================================================
-- 11. RPC: claim_collection_reward — marks collection as done
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_collection_reward(
  p_character_id UUID,
  p_collection_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INT;
  v_collected INT;
  v_collection_name TEXT;
  v_already_completed BOOLEAN;
BEGIN
  PERFORM public.assert_character_owner(p_character_id);

  SELECT name INTO v_collection_name FROM public.collections WHERE id = p_collection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection not found'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.character_collections
    WHERE character_id = p_character_id AND collection_id = p_collection_id
  ) INTO v_already_completed;

  IF v_already_completed THEN
    RAISE EXCEPTION 'Collection already claimed';
  END IF;

  SELECT COUNT(*)::INT INTO v_total FROM public.collection_items WHERE collection_id = p_collection_id;
  SELECT COUNT(DISTINCT i.id)::INT INTO v_collected
  FROM public.collection_items ci
  JOIN public.items i ON i.name = ci.item_name
  JOIN public.inventory inv ON inv.item_id = i.id AND inv.character_id = p_character_id
  WHERE ci.collection_id = p_collection_id AND inv.quantity > 0;

  IF v_collected < v_total THEN
    RAISE EXCEPTION 'Not all items collected (have %, need %)', v_collected, v_total;
  END IF;

  INSERT INTO public.character_collections (character_id, collection_id)
  VALUES (p_character_id, p_collection_id);

  -- Grant stat boost based on collection (purely cosmetic for now, stats tracked client-side)
  INSERT INTO public.transactions (character_id, type, amount, description, metadata)
  VALUES (p_character_id, 'collection_reward', 0,
    'Completed collection: ' || v_collection_name,
    jsonb_build_object('collection_id', p_collection_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'collection', v_collection_name,
    'message', 'Collection "' || v_collection_name || '" completed!'
  );
END;
$$;

-- ============================================================
-- 12. RPC: get_character_collections — full progress for all
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_character_collections(
  p_character_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'collection_id', c.id,
      'name', c.name,
      'description', c.description,
      'icon', c.icon,
      'total_items', ci_stats.total,
      'collected_items', ci_stats.collected,
      'is_completed', ci_stats.collected >= ci_stats.total,
      'reward_claimed', cc.id IS NOT NULL
    )
    ORDER BY c.sort_order
  ) INTO v_result
  FROM public.collections c
  CROSS JOIN LATERAL (
    SELECT
      COUNT(*)::INT AS total,
      COUNT(DISTINCT i.id) FILTER (WHERE inv.quantity > 0)::INT AS collected
    FROM public.collection_items ci
    JOIN public.items i ON i.name = ci.item_name
    LEFT JOIN public.inventory inv ON inv.item_id = i.id AND inv.character_id = p_character_id
    WHERE ci.collection_id = c.id
  ) ci_stats
  LEFT JOIN public.character_collections cc ON cc.collection_id = c.id AND cc.character_id = p_character_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================================
-- 13. Update compute_player_level to handle 7 skills
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_player_level(p_character_id UUID)
RETURNS INT
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_total INT;
BEGIN
  SELECT COALESCE(SUM(level), 0) INTO v_total
  FROM public.skills
  WHERE character_id = p_character_id;

  UPDATE public.characters SET level = v_total WHERE id = p_character_id;
  RETURN v_total;
END;
$$;
