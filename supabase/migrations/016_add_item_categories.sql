-- Migration 016: Add hundreds of items across all categories
-- Categories: weapon, armor, accessory (equipable) | collectible, materials, resources (unequipable)

-- ============================================================
-- WEAPONS (40 items, tiers 1-5)
-- ============================================================
INSERT INTO items (name, type, tier, stats) VALUES
-- Tier 1
('Wooden Club', 'weapon', 1, '{"attack": 3}'),
('Stone Knife', 'weapon', 1, '{"attack": 2, "agility": 1}'),
('Sharpened Stick', 'weapon', 1, '{"attack": 2}'),
('Bone Club', 'weapon', 1, '{"attack": 4}'),
('Rusty Dagger', 'weapon', 1, '{"attack": 3, "cunning": 1}'),
('Slingshot', 'weapon', 1, '{"attack": 2, "focus": 1}'),
('Wooden Spear', 'weapon', 1, '{"attack": 4}'),
('Stone Axe', 'weapon', 1, '{"attack": 3, "endurance": 1}'),
-- Tier 2
('Flint Spear', 'weapon', 2, '{"attack": 6}'),
('Hunting Knife', 'weapon', 2, '{"attack": 5, "agility": 2}'),
('Iron Dagger', 'weapon', 2, '{"attack": 6, "cunning": 2}'),
('Short Bow', 'weapon', 2, '{"attack": 5, "focus": 2}'),
('Bronze Sword', 'weapon', 2, '{"attack": 7}'),
('Recurve Bow', 'weapon', 2, '{"attack": 6, "focus": 2}'),
('Hand Axe', 'weapon', 2, '{"attack": 7, "strength": 1}'),
('Javelin', 'weapon', 2, '{"attack": 6, "agility": 1}'),
-- Tier 3
('Steel Sword', 'weapon', 3, '{"attack": 12}'),
('Warhammer', 'weapon', 3, '{"attack": 14, "strength": 2}'),
('Longbow', 'weapon', 3, '{"attack": 11, "focus": 3}'),
('Battle Axe', 'weapon', 3, '{"attack": 13, "strength": 2}'),
('Enchanted Staff', 'weapon', 3, '{"attack": 10, "focus": 5}'),
('Rapier', 'weapon', 3, '{"attack": 11, "agility": 4}'),
('Morning Star', 'weapon', 3, '{"attack": 13, "endurance": 2}'),
('Crossbow', 'weapon', 3, '{"attack": 12, "focus": 2}'),
-- Tier 4
('Shadowfang Blade', 'weapon', 4, '{"attack": 20, "cunning": 4}'),
('Executioner\'s Axe', 'weapon', 4, '{"attack": 22, "strength": 3}'),
('Elven Longbow', 'weapon', 4, '{"attack": 18, "focus": 6}'),
('Dragonbone Sword', 'weapon', 4, '{"attack": 21, "strength": 4}'),
('Serpent Staff', 'weapon', 4, '{"attack": 17, "focus": 7}'),
('Phoenix Blade', 'weapon', 4, '{"attack": 20, "endurance": 3}'),
('Thunderstrike Bow', 'weapon', 4, '{"attack": 19, "focus": 5}'),
('Arcane Scepter', 'weapon', 4, '{"attack": 18, "focus": 6, "cunning": 2}'),
-- Tier 5
('Valkyrie\'s Spear', 'weapon', 5, '{"attack": 28, "strength": 5, "agility": 3}'),
('Celestial Bow', 'weapon', 5, '{"attack": 25, "focus": 8}'),
('Inferno Blade', 'weapon', 5, '{"attack": 30, "strength": 6}'),
('Staff of the Ancients', 'weapon', 5, '{"attack": 24, "focus": 10}'),
('Doom Cleaver', 'weapon', 5, '{"attack": 29, "strength": 7}'),
('Tempest Edge', 'weapon', 5, '{"attack": 27, "agility": 5, "focus": 3}'),
('Worldbreaker', 'weapon', 5, '{"attack": 32, "strength": 8}'),
('Eclipse Fang', 'weapon', 5, '{"attack": 26, "cunning": 6, "focus": 4}');

-- ============================================================
-- ARMOR (35 items, tiers 1-5)
-- ============================================================
INSERT INTO items (name, type, tier, stats) VALUES
-- Tier 1
('Leather Cap', 'armor', 1, '{"defense": 2}'),
('Hide Tunic', 'armor', 1, '{"defense": 3}'),
('Cloth Leggings', 'armor', 1, '{"defense": 1}'),
('Woven Sandals', 'armor', 1, '{"defense": 1, "agility": 1}'),
('Wooden Shield', 'armor', 1, '{"defense": 3, "endurance": 1}'),
('Bone Gloves', 'armor', 1, '{"defense": 1}'),
('Traveler\'s Cloak', 'armor', 1, '{"defense": 1, "agility": 1}'),
-- Tier 2
('Hardened Leather Helm', 'armor', 2, '{"defense": 4}'),
('Studded Leather Armor', 'armor', 2, '{"defense": 6}'),
('Chain Leggings', 'armor', 2, '{"defense": 4}'),
('Iron-Soled Boots', 'armor', 2, '{"defense": 3, "endurance": 1}'),
('Bronze Buckler', 'armor', 2, '{"defense": 5, "endurance": 2}'),
('Studded Gloves', 'armor', 2, '{"defense": 3}'),
('Ranger\'s Cloak', 'armor', 2, '{"defense": 2, "agility": 2}'),
-- Tier 3
('Steel Helm', 'armor', 3, '{"defense": 8}'),
('Chainmail Hauberk', 'armor', 3, '{"defense": 10}'),
('Plate Leggings', 'armor', 3, '{"defense": 8, "endurance": 2}'),
('Knight\'s Boots', 'armor', 3, '{"defense": 6, "endurance": 2}'),
('Steel Kite Shield', 'armor', 3, '{"defense": 9, "endurance": 3}'),
('Gauntlets of Power', 'armor', 3, '{"defense": 6, "strength": 2}'),
('Mystic Robe', 'armor', 3, '{"defense": 5, "focus": 4}'),
-- Tier 4
('Obsidian Helm', 'armor', 4, '{"defense": 14, "endurance": 3}'),
('Dragon Scale Armor', 'armor', 4, '{"defense": 18, "endurance": 4}'),
('Mithril Leggings', 'armor', 4, '{"defense": 14, "agility": 3}'),
('Shadow Boots', 'armor', 4, '{"defense": 10, "agility": 5}'),
('Dragonhide Shield', 'armor', 4, '{"defense": 16, "endurance": 4}'),
('Wyrmskin Gloves', 'armor', 4, '{"defense": 10, "strength": 3}'),
('Phoenix Mantle', 'armor', 4, '{"defense": 12, "endurance": 3, "focus": 2}'),
-- Tier 5
('Valkyrie Helm', 'armor', 5, '{"defense": 20, "endurance": 5, "strength": 3}'),
('Celestial Plate', 'armor', 5, '{"defense": 24, "endurance": 6}'),
('Mythril Greaves', 'armor', 5, '{"defense": 18, "agility": 5}'),
('Dragonscale Boots', 'armor', 5, '{"defense": 16, "agility": 4, "endurance": 3}'),
('Aegis Shield', 'armor', 5, '{"defense": 22, "endurance": 6}'),
('Titan Gauntlets', 'armor', 5, '{"defense": 16, "strength": 5}'),
('Cloak of Shadows', 'armor', 5, '{"defense": 14, "agility": 6, "cunning": 4}');

-- ============================================================
-- ACCESSORIES (12 items, tiers 1-4)
-- ============================================================
INSERT INTO items (name, type, tier, stats) VALUES
('Copper Amulet', 'accessory', 1, '{"focus": 2}'),
('Wooden Ring', 'accessory', 1, '{"cunning": 2}'),
('Bone Charm', 'accessory', 1, '{"endurance": 2}'),
('Silver Pendant', 'accessory', 2, '{"focus": 4, "cunning": 2}'),
('Jade Bracelet', 'accessory', 2, '{"agility": 3, "focus": 2}'),
('Gold Band', 'accessory', 2, '{"cunning": 4, "strength": 1}'),
('Ruby Amulet', 'accessory', 3, '{"focus": 6, "endurance": 2}'),
('Sapphire Ring', 'accessory', 3, '{"agility": 4, "focus": 4}'),
('Emerald Pendant', 'accessory', 3, '{"strength": 3, "endurance": 4}'),
('Diamond Circlet', 'accessory', 4, '{"focus": 8, "cunning": 5}'),
('Phoenix Heart Amulet', 'accessory', 4, '{"endurance": 6, "strength": 4, "focus": 3}'),
('Shadow Band', 'accessory', 4, '{"cunning": 8, "agility": 5}');

-- ============================================================
-- COLLECTIBLES (50 items, tiers 1-5)
-- ============================================================
INSERT INTO items (name, type, tier, stats) VALUES
-- Tier 1
('Tribal Mask', 'collectible', 1, '{}'),
('Polished Shell', 'collectible', 1, '{}'),
('Raven Feather', 'collectible', 1, '{}'),
('Carved Totem', 'collectible', 1, '{}'),
('Ancient Coin', 'collectible', 1, '{}'),
('Smooth River Stone', 'collectible', 1, '{}'),
('Wooden Idol', 'collectible', 1, '{}'),
('Dried Flower Bundle', 'collectible', 1, '{}'),
('Bird Egg', 'collectible', 1, '{}'),
('Fossil Fragment', 'collectible', 1, '{}'),
-- Tier 2
('Obsidian Figurine', 'collectible', 2, '{}'),
('Jade Medallion', 'collectible', 2, '{}'),
('Silver Locket', 'collectible', 2, '{}'),
('Crystal Shard', 'collectible', 2, '{}'),
('War Paint Kit', 'collectible', 2, '{}'),
('Lizard Scale Charm', 'collectible', 2, '{}'),
('Carved Horn', 'collectible', 2, '{}'),
('Ember Stone', 'collectible', 2, '{}'),
('River Pearl', 'collectible', 2, '{}'),
('Fur Trophy', 'collectible', 2, '{}'),
-- Tier 3
('Enchanted Compass', 'collectible', 3, '{}'),
('Mystic Globe', 'collectible', 3, '{}'),
('Ancient Scroll', 'collectible', 3, '{}'),
('Dragon Tooth Pendant', 'collectible', 3, '{}'),
('Star Chart', 'collectible', 3, '{}'),
('War Chief\'s Medallion', 'collectible', 3, '{}'),
('Glowing Rune Stone', 'collectible', 3, '{}'),
('Phoenix Feather Quill', 'collectible', 3, '{}'),
('Serpent Idol', 'collectible', 3, '{}'),
('Moonstone Crystal', 'collectible', 3, '{}'),
-- Tier 4
('Dragon Egg', 'collectible', 4, '{}'),
('Crown Jewel', 'collectible', 4, '{}'),
('Ancient Relic', 'collectible', 4, '{}'),
('Philosopher\'s Stone', 'collectible', 4, '{}'),
('Starfire Diamond', 'collectible', 4, '{}'),
('Elder Druid Token', 'collectible', 4, '{}'),
('Void Crystal', 'collectible', 4, '{}'),
('Olympian Laurel', 'collectible', 4, '{}'),
('Eclipse Medallion', 'collectible', 4, '{}'),
('Heart of the Mountain', 'collectible', 4, '{}'),
-- Tier 5
('Phoenix Feather', 'collectible', 5, '{}'),
('Dragon Scale Fragment', 'collectible', 5, '{}'),
('Crown of the Ancients', 'collectible', 5, '{}'),
('Starfall Meteorite', 'collectible', 5, '{}'),
('Soul Gem', 'collectible', 5, '{}'),
('World Tree Seed', 'collectible', 5, '{}'),
('Elder Dragon Eye', 'collectible', 5, '{}'),
('Titan\'s Blood Vial', 'collectible', 5, '{}'),
('Celestial Atlas', 'collectible', 5, '{}'),
('Obsidian Heart', 'collectible', 5, '{}');

-- ============================================================
-- MATERIALS (65 items, tiers 1-3)
-- ============================================================
INSERT INTO items (name, type, tier, stats) VALUES
-- Tier 1: Raw materials
('Wood', 'materials', 1, '{}'),
('Stone', 'materials', 1, '{}'),
('Copper Ore', 'materials', 1, '{}'),
('Iron Ore', 'materials', 1, '{}'),
('Herbs', 'materials', 1, '{}'),
('Hides', 'materials', 1, '{}'),
('Bone', 'materials', 1, '{}'),
('Fiber', 'materials', 1, '{}'),
('Coal', 'materials', 1, '{}'),
('Flint', 'materials', 1, '{}'),
('Clay', 'materials', 1, '{}'),
('Reeds', 'materials', 1, '{}'),
('Sand', 'materials', 1, '{}'),
('Moss', 'materials', 1, '{}'),
('Resin', 'materials', 1, '{}'),
('Charcoal', 'materials', 1, '{}'),
('Pine Wood', 'materials', 1, '{}'),
('Oak Wood', 'materials', 1, '{}'),
('River Clay', 'materials', 1, '{}'),
('Wild Berries', 'materials', 1, '{}'),
-- Tier 2: Refined materials
('Oak Plank', 'materials', 2, '{}'),
('Iron Ingot', 'materials', 2, '{}'),
('Copper Ingot', 'materials', 2, '{}'),
('Hardened Leather', 'materials', 2, '{}'),
('Steel Ingot', 'materials', 2, '{}'),
('Linen Thread', 'materials', 2, '{}'),
('Silver Ore', 'materials', 2, '{}'),
('Gold Ore', 'materials', 2, '{}'),
('Processed Hide', 'materials', 2, '{}'),
('Refined Clay', 'materials', 2, '{}'),
('Bronze Ingot', 'materials', 2, '{}'),
('Waxed Thread', 'materials', 2, '{}'),
('Treated Wood', 'materials', 2, '{}'),
('Iron Chain', 'materials', 2, '{}'),
('Silk Thread', 'materials', 2, '{}'),
('Glass Shard', 'materials', 2, '{}'),
('Braided Cord', 'materials', 2, '{}'),
('Hardened Bone', 'materials', 2, '{}'),
('Polished Stone', 'materials', 2, '{}'),
('Smelted Copper', 'materials', 2, '{}'),
-- Tier 3: Advanced materials
('Mythril Ore', 'materials', 3, '{}'),
('Adamantine Shard', 'materials', 3, '{}'),
('Dragon Scale', 'materials', 3, '{}'),
('Enchanted Wood', 'materials', 3, '{}'),
('Mithril Ingot', 'materials', 3, '{}'),
('Phoenix Ash', 'materials', 3, '{}'),
('Void Essence', 'materials', 3, '{}'),
('Star Metal', 'materials', 3, '{}'),
('Elder Bark', 'materials', 3, '{}'),
('Crystal Lens', 'materials', 3, '{}'),
('Runic Stone', 'materials', 3, '{}'),
('Enchanted Iron', 'materials', 3, '{}'),
('Shadow Weave', 'materials', 3, '{}'),
('Arcane Dust', 'materials', 3, '{}'),
('Dragon Bone', 'materials', 3, '{}'),
('Celestial Ore', 'materials', 3, '{}'),
('Living Steel', 'materials', 3, '{}'),
('True Silver', 'materials', 3, '{}'),
('Soul Fragment', 'materials', 3, '{}'),
('Aether Crystal', 'materials', 3, '{}');

-- ============================================================
-- RESOURCES (30 items, tiers 1-3)
-- ============================================================
INSERT INTO items (name, type, tier, stats) VALUES
-- Tier 1: Basic consumables/supplies
('Dried Meat', 'resources', 1, '{"heal": 15}'),
('Fresh Water', 'resources', 1, '{"heal": 10}'),
('Healing Herb', 'resources', 1, '{"heal": 20}'),
('Trail Rations', 'resources', 1, '{"heal": 25}'),
('Bandage', 'resources', 1, '{"heal": 15}'),
('Torch', 'resources', 1, '{}'),
('Rope', 'resources', 1, '{}'),
('Flint and Steel', 'resources', 1, '{}'),
('Cooked Fish', 'resources', 1, '{"heal": 20}'),
('Berry Poultice', 'resources', 1, '{"heal": 25}'),
-- Tier 2: Improved supplies
('Stew', 'resources', 2, '{"heal": 40}'),
('Antidote', 'resources', 2, '{"heal": 30}'),
('Smoked Meat', 'resources', 2, '{"heal": 45}'),
('Herbal Tea', 'resources', 2, '{"heal": 35}'),
('Healing Salve', 'resources', 2, '{"heal": 50}'),
('Iron Rations', 'resources', 2, '{"heal": 55}'),
('Warding Charm', 'resources', 2, '{}'),
('Hunting Trap', 'resources', 2, '{}'),
('Spiced Wine', 'resources', 2, '{"heal": 40}'),
('Soothing Balm', 'resources', 2, '{"heal": 45}'),
-- Tier 3: Advanced supplies
('Greater Healing Potion', 'resources', 3, '{"heal": 80}'),
('Stamina Tonic', 'resources', 3, '{"heal": 70}'),
('Royal Feast', 'resources', 3, '{"heal": 90}'),
('Elixir of Vigor', 'resources', 3, '{"heal": 85}'),
('Phoenix Down', 'resources', 3, '{"heal": 100}'),
('Enchanted Bandage', 'resources', 3, '{"heal": 75}'),
('Mana Crystal', 'resources', 3, '{}'),
('Scroll of Return', 'resources', 3, '{}'),
('Ambrosia', 'resources', 3, '{"heal": 95}'),
('Spirit Potion', 'resources', 3, '{"heal": 80}');
