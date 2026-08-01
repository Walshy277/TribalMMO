-- 0056_clan_vault_and_feed.sql
-- Clan vault (shared gold + items) and the clan activity feed. clan_log is an
-- internal helper (only ever called from other SECURITY DEFINER functions),
-- same lockdown pattern as grant_item / post_notice.

alter table public.clans
  add column if not exists vault_gold integer not null default 0;

create table if not exists public.clan_vault_items (
  clan_id uuid not null references public.clans (id) on delete cascade,
  item_id integer not null references public.items (item_id),
  quantity integer not null default 0 check (quantity >= 0),
  primary key (clan_id, item_id)
);

create table if not exists public.clan_events (
  id bigserial primary key,
  clan_id uuid not null references public.clans (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_clan_vault_items_clan on public.clan_vault_items (clan_id);
create index if not exists idx_clan_events_clan on public.clan_events (clan_id, id desc);

-- ---------- Row Level Security ----------

alter table public.clan_vault_items enable row level security;
alter table public.clan_events enable row level security;

drop policy if exists "clan vault items members only" on public.clan_vault_items;
create policy "clan vault items members only" on public.clan_vault_items
  for select to authenticated
  using (exists (
    select 1 from public.clan_members m
    where m.clan_id = clan_vault_items.clan_id and m.character_id = auth.uid()
  ));

drop policy if exists "clan events members only" on public.clan_events;
create policy "clan events members only" on public.clan_events
  for select to authenticated
  using (exists (
    select 1 from public.clan_members m
    where m.clan_id = clan_events.clan_id and m.character_id = auth.uid()
  ));

-- ---------- clan_log (internal helper) ----------

create or replace function public.clan_log(
  p_clan_id uuid,
  p_actor uuid,
  p_kind text,
  p_message text,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clan_events (clan_id, actor_id, kind, message, meta)
  values (p_clan_id, p_actor, p_kind, p_message, coalesce(p_meta, '{}'::jsonb));
end;
$$;

revoke execute on function public.clan_log(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

-- ---------- clan_vault_deposit_gold (any member) ----------

create or replace function public.clan_vault_deposit_gold(p_amount int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_member public.clan_members%rowtype;
  v_gold int;
  v_vault_gold int;
  v_display_name text;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if p_amount is null or p_amount < 1 then
    raise exception 'Choose an amount of at least 1 gold.';
  end if;

  select * into v_member from public.clan_members where character_id = v_char;
  if not found then
    raise exception 'You do not belong to a clan.';
  end if;

  select gold into v_gold from public.profiles where id = v_char for update;
  if v_gold < p_amount then
    raise exception 'Not enough gold';
  end if;

  update public.profiles set gold = gold - p_amount where id = v_char;

  update public.clans set vault_gold = vault_gold + p_amount
  where id = v_member.clan_id
  returning vault_gold into v_vault_gold;

  select display_name into v_display_name from public.profiles where id = v_char;

  perform public.clan_log(
    v_member.clan_id, v_char, 'vault_deposit_gold',
    format('%s deposited %s gold into the vault.', v_display_name, p_amount),
    jsonb_build_object('amount', p_amount)
  );

  insert into public.transactions (character_id, type, amount, item_id, quantity, meta)
  values (v_char, 'clan_vault_deposit_gold', -p_amount, null, 0, jsonb_build_object('clan_id', v_member.clan_id));

  return jsonb_build_object('vault_gold', v_vault_gold, 'deposited', p_amount);
end;
$$;

-- ---------- clan_vault_withdraw_gold (elder+) ----------

create or replace function public.clan_vault_withdraw_gold(p_amount int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_member public.clan_members%rowtype;
  v_clan public.clans%rowtype;
  v_display_name text;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if p_amount is null or p_amount < 1 then
    raise exception 'Choose an amount of at least 1 gold.';
  end if;

  select * into v_member from public.clan_members where character_id = v_char;
  if not found or v_member.role not in ('chieftain', 'elder') then
    raise exception 'Only the chieftain or elders may withdraw from the vault.';
  end if;

  select * into v_clan from public.clans where id = v_member.clan_id for update;
  if v_clan.vault_gold < p_amount then
    raise exception 'The vault does not hold that much gold.';
  end if;

  update public.clans set vault_gold = vault_gold - p_amount where id = v_clan.id;
  update public.profiles set gold = gold + p_amount where id = v_char;

  select display_name into v_display_name from public.profiles where id = v_char;

  perform public.clan_log(
    v_clan.id, v_char, 'vault_withdraw_gold',
    format('%s withdrew %s gold from the vault.', v_display_name, p_amount),
    jsonb_build_object('amount', p_amount)
  );

  insert into public.transactions (character_id, type, amount, item_id, quantity, meta)
  values (v_char, 'clan_vault_withdraw_gold', p_amount, null, 0, jsonb_build_object('clan_id', v_clan.id));

  return jsonb_build_object('vault_gold', v_clan.vault_gold - p_amount, 'withdrawn', p_amount);
end;
$$;

-- ---------- clan_vault_deposit_item (any member; no trophies/uniques) ----------

create or replace function public.clan_vault_deposit_item(p_item_id int, p_quantity int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_member public.clan_members%rowtype;
  v_item public.items%rowtype;
  v_have int;
  v_display_name text;
  v_new_qty int;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Choose a quantity of at least 1.';
  end if;

  select * into v_member from public.clan_members where character_id = v_char;
  if not found then
    raise exception 'You do not belong to a clan.';
  end if;

  select * into v_item from public.items where item_id = p_item_id;
  if not found then
    raise exception 'That item does not exist.';
  end if;
  if v_item.item_type = 'trophy' then
    raise exception 'Trophies cannot be stored in the clan vault.';
  end if;
  if coalesce(v_item.is_unique, false) then
    raise exception 'That relic is bound to you and cannot be deposited.';
  end if;

  select quantity into v_have from public.inventory
  where character_id = v_char and item_id = p_item_id
  for update;
  if not found or v_have < p_quantity then
    raise exception 'You do not have that many to deposit.';
  end if;

  update public.inventory set quantity = quantity - p_quantity
  where character_id = v_char and item_id = p_item_id;
  delete from public.inventory
  where character_id = v_char and item_id = p_item_id and quantity <= 0;

  insert into public.clan_vault_items (clan_id, item_id, quantity)
  values (v_member.clan_id, p_item_id, p_quantity)
  on conflict (clan_id, item_id)
  do update set quantity = clan_vault_items.quantity + excluded.quantity
  returning quantity into v_new_qty;

  select display_name into v_display_name from public.profiles where id = v_char;

  perform public.clan_log(
    v_member.clan_id, v_char, 'vault_deposit_item',
    format('%s deposited %sx %s into the vault.', v_display_name, p_quantity, v_item.name),
    jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity)
  );

  insert into public.transactions (character_id, type, amount, item_id, quantity, meta)
  values (v_char, 'clan_vault_deposit_item', 0, p_item_id, p_quantity, jsonb_build_object('clan_id', v_member.clan_id));

  return jsonb_build_object('item_id', p_item_id, 'name', v_item.name, 'icon', v_item.icon, 'quantity', v_new_qty);
end;
$$;

-- ---------- clan_vault_withdraw_item (elder+) ----------

create or replace function public.clan_vault_withdraw_item(p_item_id int, p_quantity int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_member public.clan_members%rowtype;
  v_have int;
  v_item public.items%rowtype;
  v_display_name text;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Choose a quantity of at least 1.';
  end if;

  select * into v_member from public.clan_members where character_id = v_char;
  if not found or v_member.role not in ('chieftain', 'elder') then
    raise exception 'Only the chieftain or elders may withdraw from the vault.';
  end if;

  select quantity into v_have from public.clan_vault_items
  where clan_id = v_member.clan_id and item_id = p_item_id
  for update;
  if not found or v_have < p_quantity then
    raise exception 'The vault does not hold that much of that item.';
  end if;

  update public.clan_vault_items set quantity = quantity - p_quantity
  where clan_id = v_member.clan_id and item_id = p_item_id;
  delete from public.clan_vault_items
  where clan_id = v_member.clan_id and item_id = p_item_id and quantity <= 0;

  perform public.grant_item(v_char, p_item_id, p_quantity);

  select * into v_item from public.items where item_id = p_item_id;
  select display_name into v_display_name from public.profiles where id = v_char;

  perform public.clan_log(
    v_member.clan_id, v_char, 'vault_withdraw_item',
    format('%s withdrew %sx %s from the vault.', v_display_name, p_quantity, v_item.name),
    jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity)
  );

  insert into public.transactions (character_id, type, amount, item_id, quantity, meta)
  values (v_char, 'clan_vault_withdraw_item', 0, p_item_id, p_quantity, jsonb_build_object('clan_id', v_member.clan_id));

  return jsonb_build_object('item_id', p_item_id, 'name', v_item.name, 'icon', v_item.icon, 'quantity', p_quantity);
end;
$$;

-- ---------- get_clan_vault ----------

create or replace function public.get_clan_vault()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_member public.clan_members%rowtype;
  v_gold int;
  v_items jsonb;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_member from public.clan_members where character_id = v_char;
  if not found then
    raise exception 'You do not belong to a clan.';
  end if;

  select vault_gold into v_gold from public.clans where id = v_member.clan_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', i.item_id,
    'name', i.name,
    'icon', i.icon,
    'item_type', i.item_type,
    'rarity', i.rarity,
    'quantity', v.quantity
  ) order by i.item_type, i.name), '[]'::jsonb)
  into v_items
  from public.clan_vault_items v
  join public.items i on i.item_id = v.item_id
  where v.clan_id = v_member.clan_id and v.quantity > 0;

  return jsonb_build_object('gold', v_gold, 'items', v_items);
end;
$$;

-- ---------- list_clan_events ----------

create or replace function public.list_clan_events(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_member public.clan_members%rowtype;
  v_limit int := greatest(1, least(coalesce(p_limit, 40), 100));
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
    'id', e.id,
    'actor_id', e.actor_id,
    'actor_name', p.display_name,
    'kind', e.kind,
    'message', e.message,
    'meta', e.meta,
    'created_at', e.created_at
  ) order by e.id desc), '[]'::jsonb)
  into v_rows
  from (
    select *
    from public.clan_events
    where clan_id = v_member.clan_id
    order by id desc
    limit v_limit
  ) e
  left join public.profiles p on p.id = e.actor_id;

  return v_rows;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'clan_vault_deposit_gold(int)',
    'clan_vault_withdraw_gold(int)',
    'clan_vault_deposit_item(int, int)',
    'clan_vault_withdraw_item(int, int)',
    'get_clan_vault()',
    'list_clan_events(int)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
