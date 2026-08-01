-- 0052_mail_sender_and_send.sql
-- Player-linked mail sender + text-only send_mail RPC.

alter table public.mail
  add column if not exists sender_id uuid references public.profiles (id) on delete set null;

create index if not exists idx_mail_sender on public.mail (sender_id)
  where sender_id is not null;

create or replace function public.get_mail()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_mail jsonb;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'sender', m.sender,
    'sender_id', m.sender_id,
    'subject', m.subject,
    'body', m.body,
    'gold', m.gold,
    'item_id', m.item_id,
    'item_icon', i.icon,
    'item_name', i.name,
    'item_qty', m.item_qty,
    'claimed_at', m.claimed_at,
    'created_at', m.created_at
  ) order by m.created_at desc), '[]'::jsonb)
  into v_mail
  from public.mail m
  left join public.items i on i.item_id = m.item_id
  where m.recipient = v_char;

  return v_mail;
end;
$$;

create or replace function public.send_mail(
  p_recipient_name text,
  p_subject text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char uuid := auth.uid();
  v_name text := trim(p_recipient_name);
  v_subject text := trim(p_subject);
  v_body text := trim(coalesce(p_body, ''));
  v_recipient uuid;
  v_sender_name text;
  v_recent int;
  v_mail_id bigint;
begin
  if v_char is null then
    raise exception 'Not authenticated';
  end if;

  perform public.check_rate_limit();

  if v_name is null or length(v_name) = 0 then
    raise exception 'Recipient required';
  end if;
  if v_subject is null or length(v_subject) = 0 then
    raise exception 'Subject required';
  end if;
  if length(v_subject) > 80 then
    raise exception 'Subject too long (max 80 characters)';
  end if;
  if length(v_body) > 1000 then
    raise exception 'Message too long (max 1000 characters)';
  end if;

  select display_name into v_sender_name from public.profiles where id = v_char;
  if v_sender_name is null or length(trim(v_sender_name)) = 0 then
    raise exception 'Choose a display name before sending mail.';
  end if;

  select id into v_recipient
  from public.profiles
  where display_name is not null
    and lower(trim(display_name)) = lower(v_name)
  limit 1;

  if v_recipient is null then
    raise exception 'No tribesman by that name.';
  end if;
  if v_recipient = v_char then
    raise exception 'You cannot send mail to yourself.';
  end if;

  select count(*)::int into v_recent
  from public.mail
  where sender_id = v_char
    and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'You have sent too many letters this hour. Rest the ravens.';
  end if;

  insert into public.mail (recipient, sender, sender_id, subject, body, gold, item_qty)
  values (v_recipient, v_sender_name, v_char, v_subject, nullif(v_body, ''), 0, 0)
  returning id into v_mail_id;

  insert into public.transactions (character_id, type, amount, item_id, quantity, meta)
  values (
    v_char, 'mail_send', 0, null, 0,
    jsonb_build_object('mail_id', v_mail_id, 'recipient', v_recipient, 'subject', v_subject)
  );

  return jsonb_build_object('mail_id', v_mail_id, 'recipient', v_name);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'get_mail()',
    'send_mail(text, text, text)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
