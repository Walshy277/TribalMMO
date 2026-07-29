-- Migration 024: Fix project contribution metagaming
-- - Deduct contributed resources from character inventory
-- - Daily contribution cap per project per character
-- ============================================================
-- FIXED: contribute_to_project — validate and deduct inventory
-- ============================================================
CREATE OR REPLACE FUNCTION public.contribute_to_project(
  p_character_id uuid,
  p_project_id uuid,
  p_wood int DEFAULT 0,
  p_stone int DEFAULT 0,
  p_food int DEFAULT 0
)
RETURNS jsonb AS $$
DECLARE
  v_project RECORD;
  v_clan_id uuid;
  v_char_name text;
  v_completed boolean := false;
  v_wood_item_id uuid;
  v_stone_item_id uuid;
  v_food_item_id uuid;
  v_wood_qty int;
  v_stone_qty int;
  v_food_qty int;
  v_today date;
  v_contributed_today int;
  v_daily_limit int := 50;
BEGIN
  SELECT cp.*, cm.clan_id INTO v_project
  FROM public.clan_projects cp
  JOIN public.clan_members cm ON cm.clan_id = cp.clan_id AND cm.character_id = p_character_id
  WHERE cp.id = p_project_id AND cp.status = 'active';

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or you are not a clan member.';
  END IF;

  SELECT c.name INTO v_char_name FROM public.characters c WHERE c.id = p_character_id;

  -- Enforce daily contribution limit per project
  v_today := CURRENT_DATE;
  SELECT COALESCE(SUM(wood_contributed + stone_contributed + food_contributed), 0)
  INTO v_contributed_today
  FROM public.clan_project_contributions
  WHERE project_id = p_project_id AND character_id = p_character_id AND created_at >= v_today;

  IF (p_wood + p_stone + p_food) + v_contributed_today > v_daily_limit THEN
    RAISE EXCEPTION 'Daily contribution limit of % reached for this project (already contributed % today).', v_daily_limit, v_contributed_today;
  END IF;

  -- Validate and deduct wood from inventory
  IF p_wood > 0 THEN
    SELECT id INTO v_wood_item_id FROM public.items WHERE name = 'Wood' LIMIT 1;
    IF v_wood_item_id IS NULL THEN
      RAISE EXCEPTION 'Wood item not found in database.';
    END IF;
    SELECT SUM(quantity)::int INTO v_wood_qty FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_wood_item_id;
    v_wood_qty := COALESCE(v_wood_qty, 0);
    IF v_wood_qty < p_wood THEN
      RAISE EXCEPTION 'Not enough Wood in inventory (have %, need %).', v_wood_qty, p_wood;
    END IF;
    -- Deduct from inventory
    UPDATE public.inventory SET quantity = quantity - p_wood
    WHERE character_id = p_character_id AND item_id = v_wood_item_id;
    DELETE FROM public.inventory WHERE character_id = p_character_id AND item_id = v_wood_item_id AND quantity <= 0;
  END IF;

  -- Validate and deduct stone from inventory
  IF p_stone > 0 THEN
    SELECT id INTO v_stone_item_id FROM public.items WHERE name = 'Stone' LIMIT 1;
    IF v_stone_item_id IS NULL THEN
      RAISE EXCEPTION 'Stone item not found in database.';
    END IF;
    SELECT SUM(quantity)::int INTO v_stone_qty FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_stone_item_id;
    v_stone_qty := COALESCE(v_stone_qty, 0);
    IF v_stone_qty < p_stone THEN
      RAISE EXCEPTION 'Not enough Stone in inventory (have %, need %).', v_stone_qty, p_stone;
    END IF;
    UPDATE public.inventory SET quantity = quantity - p_stone
    WHERE character_id = p_character_id AND item_id = v_stone_item_id;
    DELETE FROM public.inventory WHERE character_id = p_character_id AND item_id = v_stone_item_id AND quantity <= 0;
  END IF;

  -- Validate and deduct food (Wild Berries or any food-type item)
  IF p_food > 0 THEN
    SELECT id INTO v_food_item_id FROM public.items WHERE name = 'Wild Berries' LIMIT 1;
    IF v_food_item_id IS NULL THEN
      RAISE EXCEPTION 'Food item (Wild Berries) not found in database.';
    END IF;
    SELECT SUM(quantity)::int INTO v_food_qty FROM public.inventory
    WHERE character_id = p_character_id AND item_id = v_food_item_id;
    v_food_qty := COALESCE(v_food_qty, 0);
    IF v_food_qty < p_food THEN
      RAISE EXCEPTION 'Not enough Wild Berries in inventory (have %, need %).', v_food_qty, p_food;
    END IF;
    UPDATE public.inventory SET quantity = quantity - p_food
    WHERE character_id = p_character_id AND item_id = v_food_item_id;
    DELETE FROM public.inventory WHERE character_id = p_character_id AND item_id = v_food_item_id AND quantity <= 0;
  END IF;

  -- Record contribution
  INSERT INTO public.clan_project_contributions (project_id, character_id, wood_contributed, stone_contributed, food_contributed)
  VALUES (p_project_id, p_character_id, p_wood, p_stone, p_food);

  -- Update project
  UPDATE public.clan_projects
  SET
    contributed_wood = contributed_wood + p_wood,
    contributed_stone = contributed_stone + p_stone,
    contributed_food = contributed_food + p_food
  WHERE id = p_project_id
  RETURNING * INTO v_project;

  -- Check if completed
  IF v_project.contributed_wood >= v_project.total_wood
    AND v_project.contributed_stone >= v_project.total_stone
    AND v_project.contributed_food >= v_project.total_food THEN
    UPDATE public.clan_projects
    SET status = 'completed', completed_at = now()
    WHERE id = p_project_id;
    v_completed := true;

    -- Apply rewards
    IF v_project.reward_type = 'morale' THEN
      UPDATE public.clans SET morale = LEAST(100, morale + (v_project.reward_value::int)) WHERE id = v_project.clan_id;
    ELSIF v_project.reward_type = 'population' THEN
      UPDATE public.clans SET population = population + (v_project.reward_value::int) WHERE id = v_project.clan_id;
    END IF;
  END IF;

  -- Log event
  PERFORM public.add_clan_event(
    v_project.clan_id,
    CASE WHEN v_completed THEN 'project_completed' ELSE 'project_progress' END,
    CASE WHEN v_completed THEN v_char_name || ' completed the ' || v_project.name || '!'
         ELSE v_char_name || ' contributed to ' || v_project.name
    END,
    p_character_id
  );

  -- Notify all clan members if completed
  IF v_completed THEN
    INSERT INTO public.notifications (character_id, notification_type, title, description, link)
    SELECT cm.character_id, 'project_completed', 'Project Completed: ' || v_project.name,
           'The ' || v_project.name || ' has been finished!',
           '/clans'
    FROM public.clan_members cm
    WHERE cm.clan_id = v_project.clan_id;
  END IF;

  RETURN jsonb_build_object(
    'project_id', v_project.id,
    'completed', v_completed,
    'contributed_wood', p_wood,
    'contributed_stone', p_stone,
    'contributed_food', p_food
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
