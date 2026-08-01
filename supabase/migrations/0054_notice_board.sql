-- 0054_notice_board.sql
-- Global village notice board + helper to post notices.

create table if not exists public.notices (
  id bigserial primary key,
  kind text not null check (kind in ('milestone', 'world', 'clan', 'system')),
  title text not null,
  body text not null default '',
  actor_id uuid references public.profiles (id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notices_created on public.notices (created_at desc);

alter table public.notices enable row level security;

drop policy if exists "notices readable" on public.notices;
create policy "notices readable" on public.notices
  for select to authenticated
  using (true);

create or replace function public.post_notice(
  p_kind text,
  p_title text,
  p_body text,
  p_actor_id uuid default null,
  p_meta jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_kind is null or p_kind not in ('milestone', 'world', 'clan', 'system') then
    raise exception 'Invalid notice kind';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Notice title required';
  end if;

  insert into public.notices (kind, title, body, actor_id, meta)
  values (p_kind, trim(p_title), coalesce(p_body, ''), p_actor_id, coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.list_notices(p_limit int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 30), 50));
  v_rows jsonb;
begin
  if v_viewer is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id,
    'kind', n.kind,
    'title', n.title,
    'body', n.body,
    'actor_id', n.actor_id,
    'actor_name', p.display_name,
    'meta', n.meta,
    'created_at', n.created_at
  ) order by n.created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select *
    from public.notices
    order by created_at desc
    limit v_limit
  ) n
  left join public.profiles p on p.id = n.actor_id;

  return v_rows;
end;
$$;

-- Seed so the board is not empty on first open
insert into public.notices (kind, title, body)
select 'system', 'The notice board is raised',
  'Word of the village will be posted here — milestones, gatherings, and clan foundings.'
where not exists (
  select 1 from public.notices where title = 'The notice board is raised'
);

-- Hook world-event completion into notices (preserve 0041 donate semantics)
create or replace function public.donate_to_world_event(p_event_id text, p_quantity int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_ev public.world_events%rowtype;
  v_have int;
  v_need int;
  v_give int;
  v_item_name text;
  v_item_icon text;
  v_lit boolean := false;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Choose how many to offer.';
  end if;
  if p_quantity > 5000 then
    raise exception 'You can offer at most 5,000 at a time.';
  end if;

  select * into v_ev from public.world_events where id = p_event_id for update;
  if not found then
    raise exception 'That gathering is not known.';
  end if;
  if v_ev.status <> 'active' then
    raise exception 'The First Great Fire is already lit. The offering is closed.';
  end if;

  select coalesce(quantity, 0) into v_have
  from public.inventory
  where character_id = v_char and item_id = v_ev.item_id
  for update;

  if v_have < 1 then
    select name into v_item_name from public.items where item_id = v_ev.item_id;
    raise exception 'You have no % to offer.', coalesce(v_item_name, 'wood');
  end if;

  v_need := greatest(0, v_ev.goal - v_ev.progress);
  if v_need < 1 then
    raise exception 'The pile is already complete.';
  end if;

  v_give := least(p_quantity, v_have, v_need);

  update public.inventory
  set quantity = quantity - v_give
  where character_id = v_char and item_id = v_ev.item_id;
  delete from public.inventory
  where character_id = v_char and item_id = v_ev.item_id and quantity <= 0;

  insert into public.world_event_donations (event_id, character_id, amount, updated_at)
  values (v_ev.id, v_char, v_give, now())
  on conflict (event_id, character_id)
  do update set
    amount = world_event_donations.amount + excluded.amount,
    updated_at = now();

  update public.world_events
  set progress = progress + v_give
  where id = v_ev.id
  returning * into v_ev;

  if v_ev.progress >= v_ev.goal then
    update public.world_events
    set status = 'completed',
        progress = goal,
        completed_at = now(),
        buff_until = now() + interval '24 hours'
    where id = v_ev.id
    returning * into v_ev;
    v_lit := true;
    perform public.award_world_event_top_donor(v_ev.id);
    perform public.post_notice(
      'world',
      format('%s is lit!', v_ev.title),
      'The tribe gathered enough. A great fire burns.',
      v_char,
      jsonb_build_object('event_id', v_ev.id)
    );
  end if;

  select name, icon into v_item_name, v_item_icon
  from public.items where item_id = v_ev.item_id;

  insert into public.transactions (character_id, type, amount, item_id, quantity, meta)
  values (
    v_char,
    'world_event_donate',
    0,
    v_ev.item_id,
    v_give,
    jsonb_build_object('event_id', v_ev.id, 'lit', v_lit)
  );

  return jsonb_build_object(
    'event_id', v_ev.id,
    'donated', v_give,
    'item_id', v_ev.item_id,
    'item_name', v_item_name,
    'item_icon', v_item_icon,
    'progress', least(v_ev.progress, v_ev.goal),
    'goal', v_ev.goal,
    'status', v_ev.status,
    'lit', v_lit,
    'buff_until', v_ev.buff_until,
    'buff_active', v_ev.status = 'completed' and v_ev.buff_until > now(),
    'my_donated', (
      select amount from public.world_event_donations
      where event_id = v_ev.id and character_id = v_char
    )
  );
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'list_notices(int)',
    'donate_to_world_event(text, int)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;

  execute 'revoke execute on function public.post_notice(text, text, text, uuid, jsonb) from public, anon, authenticated';
end;
$$;
