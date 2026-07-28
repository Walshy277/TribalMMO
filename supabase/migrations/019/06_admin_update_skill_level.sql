-- 6. admin_update_skill_level (cap at 100)
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
