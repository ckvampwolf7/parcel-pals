-- Applied to project parcel-pals (wbevtynfofwyhwjzhwpz) on 2026-10-19.
alter table public.push_subscriptions add column if not exists tz text not null default 'Asia/Seoul';
alter table public.push_subscriptions add column if not exists quiet boolean not null default true;

-- Register/update this device's push subscription. p_sub: { endpoint, p256dh, auth, locale, region, tz, quiet }
create or replace function public.pp_push_register(p_key text, p_sub jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_acc uuid; v_tz text;
begin
  v_acc := public.pp_account(p_key);
  if coalesce(p_sub->>'endpoint', '') !~ '^https://' or length(p_sub->>'endpoint') > 1000
     or length(coalesce(p_sub->>'p256dh', '')) not between 20 and 200 or length(coalesce(p_sub->>'auth', '')) not between 8 and 100 then
    raise exception 'invalid subscription' using errcode = '22023';
  end if;
  v_tz := case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_sub->>'tz') then p_sub->>'tz' else 'Asia/Seoul' end;
  insert into public.push_subscriptions (endpoint, account_id, p256dh, auth, locale, region, tz, quiet)
  values (p_sub->>'endpoint', v_acc, p_sub->>'p256dh', p_sub->>'auth',
          case when p_sub->>'locale' = 'en' then 'en' else 'ko' end,
          case when p_sub->>'region' = 'US' then 'US' else 'KR' end,
          v_tz, coalesce((p_sub->>'quiet')::boolean, true))
  on conflict (endpoint) do update set account_id = excluded.account_id, p256dh = excluded.p256dh, auth = excluded.auth,
    locale = excluded.locale, region = excluded.region, tz = excluded.tz, quiet = excluded.quiet, fail_count = 0;
end $$;
revoke execute on function public.pp_push_register(text, jsonb) from public;
grant execute on function public.pp_push_register(text, jsonb) to anon, authenticated;
revoke execute on function public.pp_push_subscribe2(text, text, text, text, text, text) from anon, authenticated;
