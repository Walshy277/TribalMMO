-- 0055_clans_core.sql
-- Clan core: clans, clan_members (one clan per character), clan_invites,
-- and the founding / membership / roster RPCs. Founding costs 10 gold
-- (kept cheap for testing) and posts a notice on the village board.

create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tag text not null unique,
  philosophy text,
  banner text not null default '🏕️',
  chieftain_id uuid not null references public.profiles (id) on delete cascade,
  recruitment text not null default 'invite' check (recruitment in ('open', 'invite')),
  created_at timestamptz not null default now()
);

create table if not exists public.clan_members (
  clan_id uuid not null references public.clans (id) on delete cascade,
  character_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('chieftain', 'elder', 'member')),
  joined_at timestamptz not null default now()
);

create table if not exists public.clan_invites (
  id bigserial primary key,
  clan_id uuid not null references public.clans (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index if not exists idx_clan_members_clan on public.clan_members (clan_id);
create index if not exists idx_clan_invites_invitee on public.clan_invites (invitee_id, status);
create index if not exists idx_clan_invites_clan on public.clan_invites (clan_id, status);

-- ---------- Row Level Security ----------

alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_invites enable row level security;

drop policy if exists "clans readable" on public.clans;
create policy "clans readable" on public.clans
  for select to authenticated
  using (true);

drop policy if exists "clan members readable" on public.clan_members;
create policy "clan members readable" on public.clan_members
  for select to authenticated
  using (true);

drop policy if exists "clan invites own" on public.clan_invites;
create policy "clan invites own" on public.clan_invites
  for select to authenticated
  using (invitee_id = auth.uid() or inviter_id = auth.uid());

-- ---------- create_clan ----------

create or replace function public.create_clan(
  p_name text,
  p_tag text,
  p_philosophy text default null,
  p_banner text default '🏕️'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_tag text := upper(trim(coalesce(p_tag, '')));
  v_philosophy text := nullif(trim(coalesce(p_philosophy, '')), '');
  v_banner text := coalesce(nullif(trim(coalesce(p_banner, '')), ''), '🏕️');
  v_gold int;
  v_clan_id uuid;
  v_display_name text;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if exists (select 1 from public.clan_members where character_id = v_char) then
    raise exception 'You already belong to a clan.';
  end if;

  if v_name !~ '^[A-Za-z0-9 _-]{3,24}$' then
    raise exception 'Clan names must be 3-24 characters: letters, numbers, spaces, - and _ only.';
  end if;
  if v_tag !~ '^[A-Za-z0-9]{2,5}$' then
    raise exception 'Clan tags must be 2-5 letters or numbers.';
  end if;
  if v_philosophy is not null and length(v_philosophy) > 280 then
    raise exception 'Philosophy too long (max 280 characters).';
  end if;

  if exists (select 1 from public.clans where lower(name) = lower(v_name)) then
    raise exception 'A clan already carries that name.';
  end if;
  if exists (select 1 from public.clans where tag = v_tag) then
    raise exception 'That clan tag is already claimed.';
  end if;

  select display_name into v_display_name from public.profiles where id = v_char;
  if v_display_name is null or length(trim(v_display_name)) = 0 then
    raise exception 'Choose a display name before founding a clan.';
  end if;

  select gold into v_gold from public.profiles where id = v_char for update;
  if coalesce(v_gold, 0) < 10 then
    raise exception 'Founding a clan costs 10 gold.';
  end if;

  begin
    insert into public.clans (name, tag, philosophy, banner, chieftain_id, recruitment)
    values (v_name, v_tag, v_philosophy, v_banner, v_char, 'invite')
    returning id into v_clan_id;
  exception when unique_violation then
    raise exception 'That clan name or tag was just claimed by someone else.';
  end;

  insert into public.clan_members (clan_id, character_id, role)
  values (v_clan_id, v_char, 'chieftain');

  update public.profiles set gold = gold - 10 where id = v_char;

  insert into public.transactions (character_id, type, amount, item_id, quantity, meta)
  values (
    v_char, 'clan_found', -10, null, 0,
    jsonb_build_object('clan_id', v_clan_id, 'name', v_name, 'tag', v_tag)
  );

  perform public.post_notice(
    'clan',
    format('[%s] %s is founded!', v_tag, v_name),
    format('%s has raised the banner of a new clan.', v_display_name),
    v_char,
    jsonb_build_object('clan_id', v_clan_id, 'tag', v_tag, 'name', v_name)
  );

  return public.get_clan(v_clan_id);
end;
$$;

-- ---------- disband_clan ----------

create or replace function public.disband_clan()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_member public.clan_members%rowtype;
  v_clan public.clans%rowtype;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  select * into v_member from public.clan_members where character_id = v_char for update;
  if not found then
    raise exception 'You do not belong to a clan.';
  end if;
  if v_member.role <> 'chieftain' then
    raise exception 'Only the chieftain may disband the clan.';
  end if;

  select * into v_clan from public.clans where id = v_member.clan_id;

  delete from public.clans where id = v_member.clan_id;

  perform public.post_notice(
    'clan',
    format('[%s] %s has disbanded.', v_clan.tag, v_clan.name),
    'The banner has been lowered for the last time.',
    v_char,
    jsonb_build_object('clan_id', v_clan.id, 'tag', v_clan.tag, 'name', v_clan.name)
  );
end;
$$;

-- ---------- join_clan (open recruitment only) ----------

create or replace function public.join_clan(p_clan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_clan public.clans%rowtype;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if p_clan_id is null then
    raise exception 'Clan required';
  end if;

  if exists (select 1 from public.clan_members where character_id = v_char) then
    raise exception 'You already belong to a clan.';
  end if;

  select * into v_clan from public.clans where id = p_clan_id for update;
  if not found then
    raise exception 'That clan does not exist.';
  end if;
  if v_clan.recruitment <> 'open' then
    raise exception 'That clan is invite-only.';
  end if;

  insert into public.clan_members (clan_id, character_id, role)
  values (v_clan.id, v_char, 'member');

  return public.get_clan(v_clan.id);
end;
$$;

-- ---------- leave_clan (chieftain must disband instead) ----------

create or replace function public.leave_clan()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_member public.clan_members%rowtype;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  select * into v_member from public.clan_members where character_id = v_char for update;
  if not found then
    raise exception 'You do not belong to a clan.';
  end if;
  if v_member.role = 'chieftain' then
    raise exception 'The chieftain cannot abandon the clan. Disband it instead.';
  end if;

  delete from public.clan_members where character_id = v_char;
end;
$$;

-- ---------- invite_to_clan (elder+) ----------

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
    format('%s invites you to join [%s] %s. Visit your clan invitations to respond.',
      v_inviter_name, v_clan.tag, v_clan.name)
  );

  return jsonb_build_object('invite_id', v_invite_id, 'invitee', v_name, 'clan_id', v_clan.id);
end;
$$;

-- ---------- respond_clan_invite ----------

create or replace function public.respond_clan_invite(p_invite_id bigint, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_invite public.clan_invites%rowtype;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  select * into v_invite from public.clan_invites
  where id = p_invite_id and invitee_id = v_char
  for update;

  if not found then
    raise exception 'No such invitation.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'That invitation is no longer pending.';
  end if;
  if v_invite.expires_at < now() then
    update public.clan_invites set status = 'revoked' where id = v_invite.id;
    raise exception 'That invitation has expired.';
  end if;

  if coalesce(p_accept, false) then
    if exists (select 1 from public.clan_members where character_id = v_char) then
      update public.clan_invites set status = 'revoked' where id = v_invite.id;
      raise exception 'You already belong to a clan.';
    end if;

    insert into public.clan_members (clan_id, character_id, role)
    values (v_invite.clan_id, v_char, 'member');

    update public.clan_invites set status = 'accepted' where id = v_invite.id;
  else
    update public.clan_invites set status = 'declined' where id = v_invite.id;
  end if;

  return jsonb_build_object(
    'invite_id', v_invite.id,
    'clan_id', v_invite.clan_id,
    'accepted', coalesce(p_accept, false)
  );
end;
$$;

-- ---------- kick_member (elder+; elders may not kick elders/chieftain) ----------

create or replace function public.kick_member(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_actor public.clan_members%rowtype;
  v_target public.clan_members%rowtype;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if p_character_id is null then
    raise exception 'Tribesman required.';
  end if;
  if p_character_id = v_char then
    raise exception 'Use leave_clan to depart the clan yourself.';
  end if;

  select * into v_actor from public.clan_members where character_id = v_char;
  if not found or v_actor.role not in ('chieftain', 'elder') then
    raise exception 'Only the chieftain or elders may remove tribesmen.';
  end if;

  select * into v_target from public.clan_members
  where character_id = p_character_id and clan_id = v_actor.clan_id
  for update;
  if not found then
    raise exception 'That tribesman is not in your clan.';
  end if;

  if v_target.role = 'chieftain' then
    raise exception 'The chieftain cannot be removed.';
  end if;
  if v_target.role = 'elder' and v_actor.role <> 'chieftain' then
    raise exception 'Only the chieftain may remove an elder.';
  end if;

  delete from public.clan_members where character_id = p_character_id;
end;
$$;

-- ---------- set_member_role (chieftain only; elder|member) ----------

create or replace function public.set_member_role(p_character_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_actor public.clan_members%rowtype;
  v_target public.clan_members%rowtype;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if p_role not in ('elder', 'member') then
    raise exception 'Role must be elder or member.';
  end if;

  select * into v_actor from public.clan_members where character_id = v_char;
  if not found or v_actor.role <> 'chieftain' then
    raise exception 'Only the chieftain may assign roles.';
  end if;
  if p_character_id = v_char then
    raise exception 'The chieftain cannot change their own role this way.';
  end if;

  select * into v_target from public.clan_members
  where character_id = p_character_id and clan_id = v_actor.clan_id
  for update;
  if not found then
    raise exception 'That tribesman is not in your clan.';
  end if;
  if v_target.role = 'chieftain' then
    raise exception 'There can be only one chieftain.';
  end if;

  update public.clan_members set role = p_role where character_id = p_character_id;
end;
$$;

-- ---------- get_my_clan ----------

create or replace function public.get_my_clan()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_clan public.clans%rowtype;
  v_my_role text;
  v_members jsonb;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  select c.* into v_clan
  from public.clans c
  join public.clan_members m on m.clan_id = c.id
  where m.character_id = v_char;

  if not found then
    return null;
  end if;

  select role into v_my_role from public.clan_members
  where clan_id = v_clan.id and character_id = v_char;

  select coalesce(jsonb_agg(jsonb_build_object(
    'character_id', m.character_id,
    'display_name', p.display_name,
    'role', m.role,
    'is_online', p.last_seen_at is not null and p.last_seen_at > now() - interval '15 minutes',
    'last_seen_at', p.last_seen_at,
    'zone', p.zone,
    'joined_at', m.joined_at
  ) order by case m.role when 'chieftain' then 0 when 'elder' then 1 else 2 end, p.display_name), '[]'::jsonb)
  into v_members
  from public.clan_members m
  join public.profiles p on p.id = m.character_id
  where m.clan_id = v_clan.id;

  return jsonb_build_object(
    'id', v_clan.id,
    'name', v_clan.name,
    'tag', v_clan.tag,
    'philosophy', v_clan.philosophy,
    'banner', v_clan.banner,
    'chieftain_id', v_clan.chieftain_id,
    'recruitment', v_clan.recruitment,
    'created_at', v_clan.created_at,
    'member_count', jsonb_array_length(v_members),
    'my_role', v_my_role,
    'members', v_members
  );
end;
$$;

-- ---------- get_clan (public summary + roster) ----------

create or replace function public.get_clan(p_clan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_clan public.clans%rowtype;
  v_members jsonb;
begin
  if v_viewer is null then
    raise exception 'Not authenticated';
  end if;
  if p_clan_id is null then
    raise exception 'Clan required';
  end if;

  select * into v_clan from public.clans where id = p_clan_id;
  if not found then
    raise exception 'That clan does not exist.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'character_id', m.character_id,
    'display_name', p.display_name,
    'role', m.role,
    'is_online', p.last_seen_at is not null and p.last_seen_at > now() - interval '15 minutes',
    'last_seen_at', p.last_seen_at,
    'zone', p.zone,
    'joined_at', m.joined_at
  ) order by case m.role when 'chieftain' then 0 when 'elder' then 1 else 2 end, p.display_name), '[]'::jsonb)
  into v_members
  from public.clan_members m
  join public.profiles p on p.id = m.character_id
  where m.clan_id = v_clan.id;

  return jsonb_build_object(
    'id', v_clan.id,
    'name', v_clan.name,
    'tag', v_clan.tag,
    'philosophy', v_clan.philosophy,
    'banner', v_clan.banner,
    'chieftain_id', v_clan.chieftain_id,
    'recruitment', v_clan.recruitment,
    'created_at', v_clan.created_at,
    'member_count', jsonb_array_length(v_members),
    'members', v_members
  );
end;
$$;

-- ---------- list_clans ----------

create or replace function public.list_clans(p_limit int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 30), 100));
  v_rows jsonb;
begin
  if v_viewer is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'tag', t.tag,
    'banner', t.banner,
    'member_count', t.member_count,
    'recruitment', t.recruitment,
    'chieftain_name', t.chieftain_name
  ) order by t.member_count desc, t.name), '[]'::jsonb)
  into v_rows
  from (
    select c.id, c.name, c.tag, c.banner, c.recruitment,
           coalesce(mc.member_count, 0) as member_count,
           p.display_name as chieftain_name
    from public.clans c
    left join public.profiles p on p.id = c.chieftain_id
    left join (
      select clan_id, count(*)::int as member_count
      from public.clan_members
      group by clan_id
    ) mc on mc.clan_id = c.id
    order by coalesce(mc.member_count, 0) desc, c.name
    limit v_limit
  ) t;

  return v_rows;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'create_clan(text, text, text, text)',
    'disband_clan()',
    'join_clan(uuid)',
    'leave_clan()',
    'invite_to_clan(text)',
    'respond_clan_invite(bigint, boolean)',
    'kick_member(uuid)',
    'set_member_role(uuid, text)',
    'get_my_clan()',
    'get_clan(uuid)',
    'list_clans(int)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
