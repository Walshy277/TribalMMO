-- Migration 021: Clan Settlements - Social persistence, community projects, events, laws
-- Transforms clans from basic groups into living settlements

-- ============================================================
-- 1. Clan settlement resources & laws
-- ============================================================
ALTER TABLE public.clans
  ADD COLUMN IF NOT EXISTS food int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wood int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stone int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS morale int DEFAULT 50,
  ADD COLUMN IF NOT EXISTS spirit_favor int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS population int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tax_rate int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS donation_policy text DEFAULT 'optional',
  ADD COLUMN IF NOT EXISTS pvp_policy text DEFAULT 'peaceful',
  ADD COLUMN IF NOT EXISTS recruitment_policy text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS leader_elections boolean DEFAULT false;

-- ============================================================
-- 2. Clan projects (community projects)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clan_projects (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  clan_id uuid REFERENCES public.clans(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'building',
  total_wood int NOT NULL DEFAULT 0,
  total_stone int NOT NULL DEFAULT 0,
  total_food int NOT NULL DEFAULT 0,
  contributed_wood int NOT NULL DEFAULT 0,
  contributed_stone int NOT NULL DEFAULT 0,
  contributed_food int NOT NULL DEFAULT 0,
  reward_description text,
  reward_type text,
  reward_value text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone
);

-- ============================================================
-- 3. Clan project contributions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clan_project_contributions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid REFERENCES public.clan_projects(id) ON DELETE CASCADE NOT NULL,
  character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  wood_contributed int NOT NULL DEFAULT 0,
  stone_contributed int NOT NULL DEFAULT 0,
  food_contributed int NOT NULL DEFAULT 0,
  contributed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 4. Clan events (activity feed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clan_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  clan_id uuid REFERENCES public.clans(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  description text NOT NULL,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 5. Achievements / reputation titles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  achievement_type text NOT NULL,
  title text NOT NULL,
  description text,
  awarded_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(character_id, achievement_type)
);

-- ============================================================
-- 6. World events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.world_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  event_type text NOT NULL,
  modifiers jsonb DEFAULT '{}'::jsonb,
  progress int DEFAULT 0,
  target int,
  reward_description text,
  reward_value text,
  started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  ends_at timestamp with time zone,
  status text DEFAULT 'active'
);

-- ============================================================
-- 7. Notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  description text,
  link text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 8. Clan member stats
-- ============================================================
ALTER TABLE public.clan_members
  ADD COLUMN IF NOT EXISTS total_donated_wood int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_donated_stone int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_donated_food int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_donated_gold int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combat_wins int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resources_gathered int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_crafted int DEFAULT 0;

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE public.clan_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_project_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view clan projects" ON public.clan_projects;
CREATE POLICY "Anyone can view clan projects" ON public.clan_projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Clan members can manage projects" ON public.clan_projects;
CREATE POLICY "Clan members can manage projects" ON public.clan_projects FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clan_members WHERE clan_id = clan_projects.clan_id AND character_id IN (SELECT id FROM public.characters WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Anyone can view contributions" ON public.clan_project_contributions;
CREATE POLICY "Anyone can view contributions" ON public.clan_project_contributions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own contributions" ON public.clan_project_contributions;
CREATE POLICY "Users can create own contributions" ON public.clan_project_contributions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.characters WHERE id = character_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can view clan events" ON public.clan_events;
CREATE POLICY "Anyone can view clan events" ON public.clan_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view achievements" ON public.achievements;
CREATE POLICY "Anyone can view achievements" ON public.achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own achievements" ON public.achievements;
CREATE POLICY "Users can manage own achievements" ON public.achievements FOR ALL USING (
  EXISTS (SELECT 1 FROM public.characters WHERE id = character_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.characters WHERE id = character_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.characters WHERE id = character_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can view world events" ON public.world_events;
CREATE POLICY "Anyone can view world events" ON public.world_events FOR SELECT USING (true);

-- ============================================================
-- RPC: Add clan event (internal helper)
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_clan_event(
  p_clan_id uuid,
  p_event_type text,
  p_description text,
  p_character_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.clan_events (clan_id, event_type, description, character_id, metadata)
  VALUES (p_clan_id, p_event_type, p_description, p_character_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Donate resources to clan stockpile
-- ============================================================
CREATE OR REPLACE FUNCTION public.donate_to_clan(
  p_character_id uuid,
  p_food int DEFAULT 0,
  p_wood int DEFAULT 0,
  p_stone int DEFAULT 0,
  p_gold int DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_clan_id uuid;
  v_char_name text;
BEGIN
  -- Get character's clan
  SELECT cm.clan_id, c.name INTO v_clan_id, v_char_name
  FROM public.clan_members cm
  JOIN public.characters c ON c.id = cm.character_id
  WHERE cm.character_id = p_character_id;

  IF v_clan_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a clan.';
  END IF;

  -- Deduct from character
  UPDATE public.characters
  SET gold = gold - p_gold
  WHERE id = p_character_id AND gold >= p_gold;

  -- Add to clan
  UPDATE public.clans
  SET
    food = food + p_food,
    wood = wood + p_wood,
    stone = stone + p_stone,
    morale = LEAST(100, morale + CASE WHEN (p_food + p_wood + p_stone + p_gold) > 0 THEN 1 ELSE 0 END)
  WHERE id = v_clan_id;

  -- Track on member
  UPDATE public.clan_members
  SET
    total_donated_wood = total_donated_wood + p_wood,
    total_donated_stone = total_donated_stone + p_stone,
    total_donated_food = total_donated_food + p_food,
    total_donated_gold = total_donated_gold + p_gold
  WHERE character_id = p_character_id;

  -- Log event
  PERFORM public.add_clan_event(
    v_clan_id,
    'donation',
    CASE
      WHEN p_food > 0 AND p_wood = 0 AND p_stone = 0 AND p_gold = 0 THEN v_char_name || ' donated ' || p_food || ' Food'
      WHEN p_wood > 0 AND p_food = 0 AND p_stone = 0 AND p_gold = 0 THEN v_char_name || ' donated ' || p_wood || ' Wood'
      WHEN p_stone > 0 AND p_food = 0 AND p_wood = 0 AND p_gold = 0 THEN v_char_name || ' donated ' || p_stone || ' Stone'
      WHEN p_gold > 0 AND p_food = 0 AND p_wood = 0 AND p_stone = 0 THEN v_char_name || ' donated ' || p_gold || ' Gold'
      ELSE v_char_name || ' donated resources'
    END,
    p_character_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Contribute to a clan project
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
BEGIN
  SELECT cp.*, cm.clan_id INTO v_project
  FROM public.clan_projects cp
  JOIN public.clan_members cm ON cm.clan_id = cp.clan_id AND cm.character_id = p_character_id
  WHERE cp.id = p_project_id AND cp.status = 'active';

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or you are not a clan member.';
  END IF;

  SELECT c.name INTO v_char_name FROM public.characters c WHERE c.id = p_character_id;

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

  -- Create notification for all clan members if completed
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

-- ============================================================
-- RPC: Create clan project (chieftain or elder)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_clan_project(
  p_character_id uuid,
  p_name text,
  p_description text,
  p_total_wood int DEFAULT 0,
  p_total_stone int DEFAULT 0,
  p_total_food int DEFAULT 0,
  p_reward_description text DEFAULT NULL,
  p_reward_type text DEFAULT NULL,
  p_reward_value text DEFAULT NULL,
  p_icon text DEFAULT 'building'
)
RETURNS void AS $$
DECLARE
  v_clan_id uuid;
  v_role text;
BEGIN
  SELECT cm.clan_id, cm.role INTO v_clan_id, v_role
  FROM public.clan_members cm
  WHERE cm.character_id = p_character_id;

  IF v_role NOT IN ('chieftain', 'elder') THEN
    RAISE EXCEPTION 'Only Chieftains and Elders can create projects.';
  END IF;

  INSERT INTO public.clan_projects (clan_id, name, description, icon, total_wood, total_stone, total_food, reward_description, reward_type, reward_value)
  VALUES (v_clan_id, p_name, p_description, p_icon, p_total_wood, p_total_stone, p_total_food, p_reward_description, p_reward_type, p_reward_value);

  PERFORM public.add_clan_event(v_clan_id, 'project_started', 'A new project has started: ' || p_name, p_character_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Award achievement
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_achievement(
  p_character_id uuid,
  p_achievement_type text,
  p_title text,
  p_description text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.achievements (character_id, achievement_type, title, description)
  VALUES (p_character_id, p_achievement_type, p_title, p_description)
  ON CONFLICT (character_id, achievement_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Create world event (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_world_event(
  p_name text,
  p_description text,
  p_event_type text,
  p_modifiers jsonb DEFAULT '{}'::jsonb,
  p_target int DEFAULT NULL,
  p_reward_description text DEFAULT NULL,
  p_reward_value text DEFAULT NULL,
  p_duration_hours int DEFAULT 24
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.world_events (name, description, event_type, modifiers, target, reward_description, reward_value, ends_at)
  VALUES (p_name, p_description, p_event_type, p_modifiers, p_target, p_reward_description, p_reward_value, now() + (p_duration_hours || ' hours')::interval);

  -- Notify all players
  INSERT INTO public.notifications (character_id, notification_type, title, description, link)
  SELECT c.id, 'world_event', 'World Event: ' || p_name, p_description, '/clans'
  FROM public.characters c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
