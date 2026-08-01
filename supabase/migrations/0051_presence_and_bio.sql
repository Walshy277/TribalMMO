-- 0051_presence_and_bio.sql
-- Profile bio + expose last_seen_at / is_online on public and character profiles.

alter table public.profiles
  add column if not exists bio text;

create or replace function public.set_bio(p_bio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_bio text := trim(coalesce(p_bio, ''));
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;
  if length(v_bio) > 280 then
    raise exception 'Bio too long (max 280 characters)';
  end if;

  update public.profiles
  set bio = nullif(v_bio, ''),
      updated_at = now()
  where id = v_char;
end;
$$;

create or replace function public.list_online_players(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_rows jsonb;
begin
  if v_viewer is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'zone', p.zone,
    'last_seen_at', p.last_seen_at
  ) order by p.last_seen_at desc nulls last), '[]'::jsonb)
  into v_rows
  from (
    select id, display_name, zone, last_seen_at
    from public.profiles
    where display_name is not null
      and length(trim(display_name)) > 0
      and last_seen_at is not null
      and last_seen_at > now() - interval '15 minutes'
      and not coalesce(is_admin, false)
    order by last_seen_at desc
    limit v_limit
  ) p;

  return v_rows;
end;
$$;

create or replace function public.get_public_profile_by_id(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_equipment jsonb;
  v_pet jsonb;
  v_trophies jsonb;
  v_steps bigint;
  v_clan jsonb;
begin
  if v_viewer is null then
    raise exception 'Not authenticated';
  end if;
  if p_id is null then
    raise exception 'Character required';
  end if;

  select * into v_prof from public.profiles where id = p_id;
  if not found then
    raise exception 'No tribesman found.';
  end if;
  if v_prof.display_name is null or length(trim(v_prof.display_name)) = 0 then
    raise exception 'That tribesman has not chosen a name yet.';
  end if;

  if v_viewer = p_id then
    perform public.record_playtime(p_id);
    select * into v_prof from public.profiles where id = p_id;
  end if;

  select coalesce(jsonb_object_agg(e.slot, jsonb_build_object(
    'item_id', i.item_id,
    'name', i.name,
    'icon', i.icon,
    'item_type', i.item_type,
    'rarity', i.rarity,
    'rarity_pct', i.rarity_pct,
    'skill', i.skill
  )), '{}'::jsonb)
  into v_equipment
  from public.equipment e
  join public.items i on i.item_id = e.item_id
  where e.character_id = p_id;

  select jsonb_build_object(
    'pet_id', p.pet_id,
    'name', p.name,
    'icon', p.icon,
    'tier', p.tier,
    'rarity', p.rarity,
    'description', p.description,
    'bonus_type', p.bonus_type,
    'bonus_amount', p.bonus_amount,
    'bonuses', p.bonuses,
    'is_active', true
  )
  into v_pet
  from public.character_pets cp
  join public.pets p on p.pet_id = cp.pet_id
  where cp.character_id = p_id and cp.is_active
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', i.item_id,
    'name', i.name,
    'icon', i.icon,
    'rarity', i.rarity,
    'rarity_pct', i.rarity_pct,
    'description', i.description
  ) order by i.name), '[]'::jsonb)
  into v_trophies
  from public.inventory inv
  join public.items i on i.item_id = inv.item_id
  where inv.character_id = p_id
    and i.item_type = 'trophy'
    and inv.quantity > 0;

  select coalesce(sum(steps)::bigint, 0) into v_steps
  from public.zone_progress
  where character_id = p_id;

  -- Optional clan badge (table may not exist yet before 0055)
  v_clan := null;
  if to_regclass('public.clan_members') is not null then
    execute $q$
      select jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'tag', c.tag,
        'role', m.role
      )
      from public.clan_members m
      join public.clans c on c.id = m.clan_id
      where m.character_id = $1
    $q$ into v_clan using p_id;
  end if;

  return jsonb_build_object(
    'id', v_prof.id,
    'display_name', v_prof.display_name,
    'bio', v_prof.bio,
    'zone', v_prof.zone,
    'joined_at', v_prof.created_at,
    'play_seconds', v_prof.play_seconds,
    'last_seen_at', v_prof.last_seen_at,
    'is_online', v_prof.last_seen_at is not null
      and v_prof.last_seen_at > now() - interval '15 minutes',
    'networth', public.compute_networth(p_id),
    'steps', v_steps,
    'equipment', v_equipment,
    'active_pet', v_pet,
    'trophies', v_trophies,
    'clan', v_clan,
    'is_self', v_viewer = p_id
  );
end;
$$;

create or replace function public.get_character_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_skills jsonb;
  v_stats jsonb;
  v_equipment jsonb;
  v_inventory jsonb;
  v_energy jsonb;
  v_zone_progress jsonb;
  v_pets jsonb;
  v_hp_state jsonb;
  v_day text;
  v_beg_count int;
  v_beg_remaining int;
  v_clan_id uuid;
  v_clan_tag text;
  v_clan_role text;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id) values (v_char) on conflict (id) do nothing;
  insert into public.character_skills (character_id, skill)
  select v_char, s.skill
  from unnest(array['woodcutting','mining','gathering','hunting','fishing','farming','taming']) as s(skill)
  on conflict do nothing;
  insert into public.character_stats (character_id, stat)
  select v_char, s.stat
  from unnest(array['strength','defence','speed','iq']) as s(stat)
  on conflict do nothing;
  insert into public.zone_progress (character_id, zone) values (v_char, 'forest') on conflict do nothing;

  perform public.record_playtime(v_char);

  select * into v_prof from public.profiles where id = v_char;

  select coalesce(jsonb_object_agg(s.skill, jsonb_build_object(
    'level', s.level,
    'xp', s.xp,
    'xp_next', public.xp_for_next_level(s.level)
  )), '{}'::jsonb)
  into v_skills
  from public.character_skills s
  where s.character_id = v_char
    and s.skill in ('woodcutting','mining','gathering','hunting','fishing','farming','taming');

  select coalesce(jsonb_object_agg(s.stat, jsonb_build_object(
    'value', s.value
  )), '{}'::jsonb)
  into v_stats
  from public.character_stats s
  where s.character_id = v_char;

  select coalesce(jsonb_object_agg(z.zone, jsonb_build_object(
    'steps', z.steps,
    'mastery', z.mastery
  )), '{}'::jsonb)
  into v_zone_progress
  from public.zone_progress z
  where z.character_id = v_char;

  select coalesce(jsonb_object_agg(e.slot, jsonb_build_object(
    'item_id', i.item_id,
    'name', i.name,
    'icon', i.icon,
    'description', i.description,
    'item_type', i.item_type,
    'rarity', i.rarity,
    'rarity_pct', i.rarity_pct,
    'power', i.power,
    'price', i.price,
    'skill', i.skill,
    'quantity', 1,
    'is_unique', coalesce(i.is_unique, false),
    'is_gift', i.gift_contents is not null
  )), '{}'::jsonb)
  into v_equipment
  from public.equipment e
  join public.items i on i.item_id = e.item_id
  where e.character_id = v_char;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', i.item_id,
    'name', i.name,
    'icon', i.icon,
    'description', i.description,
    'item_type', i.item_type,
    'rarity', i.rarity,
    'rarity_pct', i.rarity_pct,
    'power', i.power,
    'price', i.price,
    'skill', i.skill,
    'quantity', inv.quantity,
    'durability', inv.durability,
    'max_durability', inv.max_durability,
    'quality', inv.quality,
    'is_unique', coalesce(i.is_unique, false),
    'is_gift', i.gift_contents is not null
  ) order by i.item_type, i.rarity_pct desc, i.name), '[]'::jsonb)
  into v_inventory
  from public.inventory inv
  join public.items i on i.item_id = inv.item_id
  where inv.character_id = v_char;

  select coalesce(jsonb_agg(jsonb_build_object(
    'pet_id', p.pet_id,
    'name', p.name,
    'icon', p.icon,
    'tier', p.tier,
    'rarity', p.rarity,
    'price', p.price,
    'description', p.description,
    'bonus_type', p.bonus_type,
    'bonus_amount', p.bonus_amount,
    'bonuses', p.bonuses,
    'gift_only', p.gift_only,
    'is_active', cp.is_active
  ) order by p.tier, p.pet_id), '[]'::jsonb)
  into v_pets
  from public.character_pets cp
  join public.pets p on p.pet_id = cp.pet_id
  where cp.character_id = v_char;

  v_energy := public.compute_energy(v_char);
  v_hp_state := public.get_hp_state(v_char);

  v_day := to_char((now() at time zone 'utc'), 'YYYY-MM-DD');
  if (v_prof.counters->>'beg_day') is not distinct from v_day then
    v_beg_count := coalesce((v_prof.counters->>'beg_count')::int, 0);
  else
    v_beg_count := 0;
  end if;
  v_beg_remaining := greatest(0, 100 - v_beg_count);

  v_clan_id := null;
  v_clan_tag := null;
  v_clan_role := null;
  if to_regclass('public.clan_members') is not null then
    execute $q$
      select m.clan_id, c.tag, m.role
      from public.clan_members m
      join public.clans c on c.id = m.clan_id
      where m.character_id = $1
    $q$ into v_clan_id, v_clan_tag, v_clan_role using v_char;
  end if;

  return jsonb_build_object(
    'id', v_prof.id,
    'display_name', v_prof.display_name,
    'bio', v_prof.bio,
    'gold', v_prof.gold,
    'energy', v_energy,
    'skills', v_skills,
    'stats', v_stats,
    'stat_mult', public.active_stat_mult(v_char),
    'equipment', v_equipment,
    'inventory', v_inventory,
    'pets', v_pets,
    'zone', v_prof.zone,
    'zone_progress', v_zone_progress,
    'hp', (v_hp_state->>'current')::int,
    'max_hp', (v_hp_state->>'max')::int,
    'tutorial_step', v_prof.tutorial_step,
    'unread_mail', (select count(*) from public.mail where recipient = v_char and claimed_at is null),
    'is_admin', v_prof.is_admin,
    'cooldown_until', v_prof.cooldown_until,
    'begs_today', v_beg_count,
    'begs_remaining', v_beg_remaining,
    'play_seconds', v_prof.play_seconds,
    'last_seen_at', v_prof.last_seen_at,
    'is_online', v_prof.last_seen_at is not null
      and v_prof.last_seen_at > now() - interval '15 minutes',
    'joined_at', v_prof.created_at,
    'networth', public.compute_networth(v_char),
    'clan_id', v_clan_id,
    'clan_tag', v_clan_tag,
    'clan_role', v_clan_role
  );
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'set_bio(text)',
    'list_online_players(int)',
    'get_public_profile_by_id(uuid)',
    'get_character_profile()'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
