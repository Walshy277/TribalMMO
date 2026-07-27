-- Add level column to characters
ALTER TABLE characters ADD COLUMN level INTEGER NOT NULL DEFAULT 1;

-- Create function to compute player level from skills
CREATE OR REPLACE FUNCTION compute_player_level(p_character_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_tier INTEGER;
BEGIN
  SELECT COALESCE(SUM(tier), 0) INTO total_tier
  FROM skills
  WHERE character_id = p_character_id;

  -- Cap at 100 total
  RETURN LEAST(total_tier, 100);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update level when skills change
CREATE OR REPLACE FUNCTION update_character_level()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE characters
  SET level = compute_player_level(NEW.character_id)
  WHERE id = NEW.character_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_skill_change_update_level
  AFTER INSERT OR UPDATE ON skills
  FOR EACH ROW
  EXECUTE FUNCTION update_character_level();

-- Set initial levels for all existing characters
UPDATE characters c
SET level = compute_player_level(c.id);
