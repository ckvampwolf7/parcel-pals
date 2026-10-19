-- Applied to project parcel-pals (wbevtynfofwyhwjzhwpz) on 2026-10-19.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
alter table public.push_subscriptions add column if not exists region text not null default 'KR';

-- v2 of subscribe with the user's region (KR/US): drives notification wording on the server.
create or replace function public.pp_push_subscribe2(p_key text, p_endpoint text, p_p256dh text, p_auth text, p_locale text, p_region text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_acc uuid;
begin
  v_acc := public.pp_account(p_key);
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'invalid subscription' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (endpoint, account_id, p256dh, auth, locale, region)
  values (p_endpoint, v_acc, p_p256dh, p_auth, case when p_locale = 'en' then 'en' else 'ko' end, case when p_region = 'US' then 'US' else 'KR' end)
  on conflict (endpoint) do update set account_id = excluded.account_id, p256dh = excluded.p256dh, auth = excluded.auth,
    locale = excluded.locale, region = excluded.region, fail_count = 0;
end $$;
revoke execute on function public.pp_push_subscribe2(text, text, text, text, text, text) from public;
grant execute on function public.pp_push_subscribe2(text, text, text, text, text, text) to anon, authenticated;
revoke execute on function public.pp_push_subscribe(text, text, text, text, text) from anon, authenticated;

-- Every 30 minutes: ask the poll function to look up synced parcels and push news.
select cron.schedule('parcel-pals-poll', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://wbevtynfofwyhwjzhwpz.supabase.co/functions/v1/poll',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select value from public.app_secrets where name = 'cron')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
