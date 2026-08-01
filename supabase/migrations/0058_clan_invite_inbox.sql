-- 0058_clan_invite_inbox.sql
-- List pending clan invites for the current player; enrich invite mail body with invite id.

create or replace function public.list_my_clan_invites()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_rows jsonb;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'clan_id', c.id,
    'clan_name', c.name,
    'clan_tag', c.tag,
    'clan_banner', c.banner,
    'inviter_id', i.inviter_id,
    'inviter_name', p.display_name,
    'created_at', i.created_at,
    'expires_at', i.expires_at
  ) order by i.created_at desc), '[]'::jsonb)
  into v_rows
  from public.clan_invites i
  join public.clans c on c.id = i.clan_id
  join public.profiles p on p.id = i.inviter_id
  where i.invitee_id = v_char
    and i.status = 'pending'
    and i.expires_at > now();

  return v_rows;
end;
$$;

-- Patch invite mail to include invite id for clarity
create or replace function public.invite_to_clan(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_member public.clan_members%rowtype;
  v_clan public.clans%rowtype;
  v_inviter_name text;
  v_invitee uuid;
  v_invite_id bigint;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if v_name is null or length(v_name) = 0 then
    raise exception 'Tribesman name required.';
  end if;

  select * into v_member from public.clan_members where character_id = v_char;
  if not found or v_member.role not in ('chieftain', 'elder') then
    raise exception 'Only the chieftain or elders may invite tribesmen.';
  end if;

  select * into v_clan from public.clans where id = v_member.clan_id;

  select display_name into v_inviter_name from public.profiles where id = v_char;
  if v_inviter_name is null or length(trim(v_inviter_name)) = 0 then
    raise exception 'Choose a display name before inviting tribesmen.';
  end if;

  select id into v_invitee
  from public.profiles
  where display_name is not null
    and lower(trim(display_name)) = lower(v_name)
  limit 1;

  if v_invitee is null then
    raise exception 'No tribesman by that name.';
  end if;
  if v_invitee = v_char then
    raise exception 'You cannot invite yourself.';
  end if;
  if exists (select 1 from public.clan_members where character_id = v_invitee) then
    raise exception 'That tribesman already belongs to a clan.';
  end if;
  if exists (
    select 1 from public.clan_invites
    where clan_id = v_clan.id and invitee_id = v_invitee
      and status = 'pending' and expires_at > now()
  ) then
    raise exception 'That tribesman already has a pending invitation from your clan.';
  end if;

  insert into public.clan_invites (clan_id, inviter_id, invitee_id)
  values (v_clan.id, v_char, v_invitee)
  returning id into v_invite_id;

  insert into public.mail (recipient, sender, sender_id, subject, body)
  values (
    v_invitee,
    v_inviter_name,
    v_char,
    format('Invitation from [%s] %s', v_clan.tag, v_clan.name),
    format(
      '%s invites you to join [%s] %s. Open the Clan hall to accept or decline (invite #%s).',
      v_inviter_name, v_clan.tag, v_clan.name, v_invite_id
    )
  );

  return jsonb_build_object('invite_id', v_invite_id, 'invitee', v_name, 'clan_id', v_clan.id);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'list_my_clan_invites()',
    'invite_to_clan(text)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
