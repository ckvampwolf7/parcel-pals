-- Applied to project parcel-pals (wbevtynfofwyhwjzhwpz) on 2026-10-19.
create extension if not exists pgcrypto with schema extensions;

-- An account is just the SHA-256 of a long random sync key that lives on the user's devices.
create table public.sync_accounts (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- One row per parcel. data = null is a tombstone (deleted). Version = (modified_at, snap_at, snap_n), compared as a tuple.
create table public.sync_parcels (
  account_id uuid not null references public.sync_accounts(id) on delete cascade,
  parcel_id text not null,
  data jsonb,
  modified_at timestamptz not null,
  snap_at timestamptz not null default 'epoch',
  snap_n int not null default 0,
  server_updated_at timestamptz not null default now(),
  primary key (account_id, parcel_id)
);
create index sync_parcels_pull on public.sync_parcels (account_id, server_updated_at);

create table public.push_subscriptions (
  endpoint text primary key,
  account_id uuid not null references public.sync_accounts(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  locale text not null default 'ko',
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fail_count int not null default 0
);
create index push_subscriptions_account on public.push_subscriptions (account_id);

-- What the server poller last told this account about each parcel.
create table public.push_state (
  account_id uuid not null references public.sync_accounts(id) on delete cascade,
  parcel_id text not null,
  last_id text,
  last_time timestamptz,
  checked_at timestamptz not null default now(),
  primary key (account_id, parcel_id)
);

-- Server-only secrets (VAPID keys, cron secret). Never exposed: RLS on, no policies, no grants.
create table public.app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

alter table public.sync_accounts enable row level security;
alter table public.sync_parcels enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_state enable row level security;
alter table public.app_secrets enable row level security;
revoke all on public.sync_accounts, public.sync_parcels, public.push_subscriptions, public.push_state, public.app_secrets from anon, authenticated;

insert into public.app_secrets (name, value) values ('cron', encode(extensions.gen_random_bytes(32), 'hex'));

-- key → account id (creates the account on first use). Keys must be long random strings.
create or replace function public.pp_account(p_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_hash text;
begin
  if p_key is null or length(p_key) < 32 or length(p_key) > 128 or p_key !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid sync key' using errcode = '22023';
  end if;
  v_hash := encode(extensions.digest(p_key, 'sha256'), 'hex');
  insert into public.sync_accounts (key_hash) values (v_hash)
    on conflict (key_hash) do update set last_seen_at = now()
    returning id into v_id;
  return v_id;
end $$;

-- Push local changes and pull everything changed on the server since p_since, in one round trip.
-- p_changes: [{ "id": text, "data": jsonb|null, "modifiedAt": iso, "snapAt": iso|null, "snapN": int }]
create or replace function public.pp_sync(p_key text, p_since timestamptz, p_changes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_acc uuid; c jsonb; v_rows jsonb; v_count int;
begin
  v_acc := public.pp_account(p_key);
  if p_changes is not null and jsonb_typeof(p_changes) = 'array' then
    if jsonb_array_length(p_changes) > 300 then raise exception 'too many changes' using errcode = '22023'; end if;
    for c in select * from jsonb_array_elements(p_changes) loop
      if length(c->>'id') between 1 and 100 and (c->'data' is null or jsonb_typeof(c->'data') in ('object','null'))
         and pg_column_size(c->'data') < 200000 then
        insert into public.sync_parcels as sp (account_id, parcel_id, data, modified_at, snap_at, snap_n, server_updated_at)
        values (v_acc, c->>'id', case when jsonb_typeof(c->'data') = 'object' then c->'data' end,
                (c->>'modifiedAt')::timestamptz, coalesce((c->>'snapAt')::timestamptz, 'epoch'), coalesce((c->>'snapN')::int, 0), clock_timestamp())
        on conflict (account_id, parcel_id) do update
          set data = excluded.data, modified_at = excluded.modified_at, snap_at = excluded.snap_at, snap_n = excluded.snap_n,
              server_updated_at = clock_timestamp()
          where (excluded.modified_at, excluded.snap_at, excluded.snap_n) > (sp.modified_at, sp.snap_at, sp.snap_n);
      end if;
    end loop;
    select count(*) into v_count from public.sync_parcels where account_id = v_acc;
    if v_count > 1000 then raise exception 'too many parcels' using errcode = '22023'; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', parcel_id, 'data', data, 'modifiedAt', modified_at, 'snapAt', snap_at, 'snapN', snap_n)), '[]'::jsonb)
    into v_rows
    from public.sync_parcels
   where account_id = v_acc and (p_since is null or server_updated_at > p_since);
  -- The cursor trails "now" a little so rows committed by concurrent calls are never skipped (re-reading is harmless).
  return jsonb_build_object('cursor', now() - interval '2 minutes', 'rows', v_rows);
end $$;

create or replace function public.pp_push_subscribe(p_key text, p_endpoint text, p_p256dh text, p_auth text, p_locale text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_acc uuid;
begin
  v_acc := public.pp_account(p_key);
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'invalid subscription' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (endpoint, account_id, p256dh, auth, locale)
  values (p_endpoint, v_acc, p_p256dh, p_auth, case when p_locale = 'en' then 'en' else 'ko' end)
  on conflict (endpoint) do update set account_id = excluded.account_id, p256dh = excluded.p256dh, auth = excluded.auth,
    locale = excluded.locale, fail_count = 0;
end $$;

create or replace function public.pp_push_unsubscribe(p_key text, p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and account_id = public.pp_account(p_key);
end $$;

-- VAPID public key for the browser (null until the poller has generated the key pair).
create or replace function public.pp_push_public_key() returns text
language sql security definer set search_path = '' stable as $$
  select value from public.app_secrets where name = 'vapid_public'
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.pp_sync(text, timestamptz, jsonb) to anon, authenticated;
grant execute on function public.pp_push_subscribe(text, text, text, text, text) to anon, authenticated;
grant execute on function public.pp_push_unsubscribe(text, text) to anon, authenticated;
grant execute on function public.pp_push_public_key() to anon, authenticated;
