-- Migration 004: Economy system
-- Adds: stamina regeneration, NPC shops, daily rewards, transaction log

-- Add stamina_updated_at to characters for real-time regeneration
ALTER TABLE characters ADD COLUMN IF NOT EXISTS stamina_updated_at TIMESTAMPTZ DEFAULT NOW();

-- NPC General Store items
CREATE TABLE IF NOT EXISTS shop_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,           -- 'consumable', 'weapon', 'armor', 'tool', 'resource'
  tier INT DEFAULT 1,
  description TEXT,
  buy_price INT NOT NULL,       -- cost to buy from shop
  sell_price INT NOT NULL,      -- coins received when selling to shop
  stock INT DEFAULT -1,         -- -1 = infinite stock
  stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily reward tracking
CREATE TABLE IF NOT EXISTS daily_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  last_claimed_at TIMESTAMPTZ NOT NULL,
  streak INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id)
);

-- Transaction log for full audit trail
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- 'action_reward', 'marketplace_buy', 'marketplace_sell', 'marketplace_tax', 'auction_bid', 'auction_win', 'auction_sale', 'auction_tax', 'shop_buy', 'shop_sell', 'daily_reward', 'stamina_potion', 'crafting_fee'
  amount INT NOT NULL,          -- positive = earned, negative = spent
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Shop items are readable by everyone, only admins can modify
CREATE POLICY "Shop items readable by authenticated" ON shop_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage shop items" ON shop_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.username = 'admin')
  );

-- Daily rewards: players can read/write their own
CREATE POLICY "Own daily rewards" ON daily_rewards
  FOR ALL TO authenticated USING (character_id IN (
    SELECT id FROM characters WHERE user_id = auth.uid()
  ));

-- Transactions: players can read their own
CREATE POLICY "Own transactions" ON transactions
  FOR SELECT TO authenticated USING (character_id IN (
    SELECT id FROM characters WHERE user_id = auth.uid()
  ));

CREATE POLICY "Insert own transactions" ON transactions
  FOR INSERT TO authenticated WITH CHECK (character_id IN (
    SELECT id FROM characters WHERE user_id = auth.uid()
  ));

-- Seed shop items
INSERT INTO shop_items (name, type, tier, description, buy_price, sell_price, stats) VALUES
  ('Stamina Potion', 'consumable', 1, 'Restores 25 stamina', 15, 5, '{"heal": 25}'),
  ('Minor Healing Salve', 'consumable', 1, 'Restores 50 stamina', 30, 10, '{"heal": 50}'),
  ('Iron Sword', 'weapon', 1, 'A sturdy iron sword', 50, 20, '{"attack": 5}'),
  ('Iron Shield', 'armor', 1, 'A solid iron shield', 45, 18, '{"defense": 5}'),
  ('Steel Sword', 'weapon', 2, 'A finely crafted steel blade', 150, 60, '{"attack": 10}'),
  ('Steel Armor', 'armor', 2, 'Full steel plate armor', 140, 55, '{"defense": 10}'),
  ('Herb Bundle', 'resource', 1, 'A bundle of healing herbs', 10, 3, '{}'),
  ('Leather Pouch', 'tool', 1, 'Increases carry capacity', 25, 10, '{"carry_bonus": 5}'),
  ('Sharpening Stone', 'tool', 2, 'Keeps weapons in top condition', 60, 25, '{"attack_bonus": 2}'),
  ('Tribal Amulet', 'armor', 2, 'An amulet of the ancient tribe', 200, 80, '{"defense": 8, "focus": 2}')
ON CONFLICT (name) DO NOTHING;

-- Update max_stamina formula trigger
CREATE OR REPLACE FUNCTION update_max_stamina()
RETURNS TRIGGER AS $$
BEGIN
  NEW.max_stamina := 50 + (NEW.endurance * 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_max_stamina ON characters;
CREATE TRIGGER trigger_update_max_stamina
  BEFORE INSERT OR UPDATE OF endurance ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_max_stamina();
