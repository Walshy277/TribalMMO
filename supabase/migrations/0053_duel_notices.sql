-- 0053_duel_notices.sql
-- When a player duel resolves, mail the target so they notice the encounter.

create or replace function public.resolve_encounter(p_encounter_id bigint, p_choice_id int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_enc public.encounters%rowtype;
  v_choice jsonb;
  v_outcome jsonb;
  v_effect jsonb;
  v_duel jsonb;
  v_res jsonb;
  v_won boolean;
  v_gold int;
  v_duel_res jsonb;
  v_foe jsonb;
  v_hp_taken int;
  v_msg text;
  v_target_id uuid;
  v_actor_name text;
  v_notice_body text;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  select * into v_enc from public.encounters where id = p_encounter_id for update;
  if not found then
    raise exception 'Encounter not found.';
  end if;
  if v_enc.character_id <> v_char then
    raise exception 'That is not your encounter.';
  end if;
  if v_enc.resolved_at is not null then
    raise exception 'This encounter has already passed.';
  end if;
  if v_enc.created_at < now() - interval '15 minutes' then
    raise exception 'The moment has passed.';
  end if;

  select value into v_choice
  from jsonb_array_elements(v_enc.choices)
  where (value->>'id')::int = p_choice_id;
  if not found then
    raise exception 'That is not one of your options.';
  end if;

  v_outcome := v_enc.outcome -> p_choice_id::text;
  if v_outcome is null then
    raise exception 'That path leads nowhere.';
  end if;

  if (v_outcome->>'gold')::int < 0 then
    select gold into v_gold from public.profiles where id = v_char;
    if v_gold + (v_outcome->>'gold')::int < 0 then
      v_outcome := jsonb_build_object('message', 'You cannot afford that.');
    end if;
  end if;

  if v_outcome ? 'duel' then
    v_duel := v_outcome->'duel';

    if (v_duel->>'character_id') is not null then
      v_foe := jsonb_build_object(
        'type', 'player',
        'id', v_duel->>'character_id',
        'name', v_duel->>'name'
      );
    else
      v_foe := jsonb_build_object(
        'type', 'npc',
        'name', coalesce(v_duel->>'name', 'foe'),
        'power', coalesce((v_duel->>'power')::int, 1)
      );
    end if;

    v_duel_res := public.resolve_duel(v_char, v_foe);
    v_won := coalesce((v_duel_res->>'won')::boolean, false);
    v_hp_taken := coalesce((v_duel_res->>'hp_damage')::int, 0);

    if v_won then
      v_effect := v_duel->'victory';
      v_msg := coalesce(v_duel->>'victory_message', 'You win!');
    else
      v_effect := v_duel->'defeat';
      v_msg := coalesce(v_duel->>'defeat_message', 'You lose.');
    end if;

    v_effect := coalesce(v_effect, '{}'::jsonb) - 'hp';
    if v_hp_taken > 0 then
      v_effect := v_effect || jsonb_build_object('hp', -v_hp_taken);
    end if;
    if coalesce(v_duel_res->>'summary', '') <> '' then
      v_msg := v_msg || ' ' || (v_duel_res->>'summary');
    end if;
    v_effect := v_effect || jsonb_build_object('message', v_msg);

    v_res := public.apply_effects(v_char, v_effect);
    v_res := v_res || jsonb_build_object(
      'duel_won', v_won,
      'opponent', coalesce(v_duel->>'name', null),
      'duel_exchanges', (v_duel_res->>'exchanges')::int
    );

    -- Notify the target player (asymmetric combat; notice is the social fix)
    begin
      v_target_id := nullif(v_duel->>'character_id', '')::uuid;
    exception when others then
      v_target_id := null;
    end;

    if v_target_id is not null and v_target_id <> v_char then
      select display_name into v_actor_name from public.profiles where id = v_char;
      v_actor_name := coalesce(nullif(trim(v_actor_name), ''), 'A tribesman');
      if v_won then
        v_notice_body := format(
          '%s crossed your path in the wilds and bested you in a friendly brawl. Word travels.',
          v_actor_name
        );
      else
        v_notice_body := format(
          '%s challenged you in the wilds and you got the better of them. Word travels.',
          v_actor_name
        );
      end if;

      insert into public.mail (recipient, sender, sender_id, subject, body, gold, item_qty)
      values (
        v_target_id,
        v_actor_name,
        v_char,
        'A tribesman crossed your path',
        v_notice_body,
        0,
        0
      );
    end if;
  else
    v_won := null;
    v_res := public.apply_effects(v_char, v_outcome);
    v_res := v_res || jsonb_build_object('duel_won', null, 'opponent', null);
  end if;

  update public.encounters set resolved_at = now() where id = p_encounter_id;

  update public.profiles set cooldown_until = now() + interval '2 seconds' where id = v_char;

  return jsonb_build_object(
    'encounter_id', v_enc.id,
    'kind', v_enc.kind,
    'title', v_enc.title,
    'icon', v_enc.icon,
    'message', v_res->>'message',
    'gold_gained', (v_res->>'gold_gained')::int,
    'items_gained', v_res->'items_gained',
    'xp_gained', (v_res->>'xp_gained')::int,
    'xp_skill', v_res->>'xp_skill',
    'sxp_gained', (v_res->>'sxp_gained')::int,
    'sxp_stat', v_res->>'sxp_stat',
    'leveled', (v_res->>'leveled')::boolean,
    'hp_damage', (v_res->>'hp_damage')::int,
    'hp_gain', (v_res->>'hp_gain')::int,
    'energy_gain', (v_res->>'energy_gain')::int,
    'steps_gained', (v_res->>'steps_gained')::int,
    'duel_won', (v_res->>'duel_won')::boolean,
    'opponent', v_res->>'opponent',
    'log', v_res->'log',
    'cooldown_until', now() + interval '2 seconds'
  );
end;
$$;

do $$
begin
  execute 'revoke execute on function public.resolve_encounter(bigint, int) from public, anon';
  execute 'grant execute on function public.resolve_encounter(bigint, int) to authenticated';
end;
$$;
