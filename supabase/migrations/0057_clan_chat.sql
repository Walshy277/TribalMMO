-- 0057_clan_chat.sql
-- Clan chat: a simple message log per clan, rate-limited both by the shared
-- check_rate_limit() bucket and a softer per-clan-member cap (30 / 5 min).

create table if not exists public.clan_messages (
  id bigserial primary key,
  clan_id uuid not null references public.clans (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clan_messages_clan_id on public.clan_messages (clan_id, id desc);

-- ---------- Row Level Security ----------

alter table public.clan_messages enable row level security;

drop policy if exists "clan messages members only" on public.clan_messages;
create policy "clan messages members only" on public.clan_messages
  for select to authenticated
  using (exists (
    select 1 from public.clan_members m
    where m.clan_id = clan_messages.clan_id and m.character_id = auth.uid()
  ));

-- ---------- send_clan_message ----------

create or replace function public.send_clan_message(p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_member public.clan_members%rowtype;
  v_recent int;
  v_display_name text;
  v_id bigint;
  v_created_at timestamptz;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if length(v_body) = 0 then
    raise exception 'Message cannot be empty.';
  end if;
  if length(v_body) > 400 then
    raise exception 'Message too long (max 400 characters).';
  end if;

  select * into v_member from public.clan_members where character_id = v_char;
  if not found then
    raise exception 'You do not belong to a clan.';
  end if;

  select display_name into v_display_name from public.profiles where id = v_char;
  if v_display_name is null or length(trim(v_display_name)) = 0 then
    raise exception 'Choose a display name before speaking in clan chat.';
  end if;

  select count(*)::int into v_recent
  from public.clan_messages
  where sender_id = v_char and created_at > now() - interval '5 minutes';
  if v_recent >= 30 then
    raise exception 'You are sending messages too quickly. Slow down.';
  end if;

  insert into public.clan_messages (clan_id, sender_id, body)
  values (v_member.clan_id, v_char, v_body)
  returning id, created_at into v_id, v_created_at;

  return jsonb_build_object(
    'id', v_id,
    'sender_id', v_char,
    'sender_name', v_display_name,
    'body', v_body,
    'created_at', v_created_at
  );
end;
$$;

-- ---------- list_clan_messages ----------

create or replace function public.list_clan_messages(p_before_id bigint default null, p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_member public.clan_members%rowtype;
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 100));
  v_rows jsonb;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_member from public.clan_members where character_id = v_char;
  if not found then
    raise exception 'You do not belong to a clan.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'sender_id', m.sender_id,
    'sender_name', p.display_name,
    'body', m.body,
    'created_at', m.created_at
  ) order by m.id desc), '[]'::jsonb)
  into v_rows
  from (
    select *
    from public.clan_messages
    where clan_id = v_member.clan_id
      and (p_before_id is null or id < p_before_id)
    order by id desc
    limit v_limit
  ) m
  left join public.profiles p on p.id = m.sender_id;

  return v_rows;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'send_clan_message(text)',
    'list_clan_messages(bigint, int)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
