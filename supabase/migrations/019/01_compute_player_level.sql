-- 1. compute_player_level (run this FIRST — other functions depend on it)
CREATE OR REPLACE FUNCTION public.compute_player_level(p_character_id uuid)
RETURNS INTEGER AS $$
DECLARE
  total_level INTEGER;
BEGIN
  SELECT COALESCE(SUM(level), 0) INTO total_level
  FROM skills
  WHERE character_id = p_character_id;
  RETURN LEAST(total_level, 100);
END;
$$ LANGUAGE plpgsql;
