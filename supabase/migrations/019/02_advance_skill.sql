-- 2. advance_skill (cap at 100)
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
  WHERE id = p_skill_id;

  RETURN jsonb_build_object(
    'leveled_up', v_leveled_up,
    'new_level', v_new_level,
    'xp', v_new_xp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
