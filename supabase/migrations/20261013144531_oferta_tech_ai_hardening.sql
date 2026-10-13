-- Align existing deployments with the hardened initial schema.
create schema if not exists oferta_private;
revoke all on schema oferta_private from public,anon;
grant usage on schema oferta_private to authenticated;
DO $$ begin if to_regclass('public.usage_limits') is not null then alter table public.usage_limits set schema oferta_private;end if;end;$$;
drop policy if exists quota_direct_access_denied on oferta_private.usage_limits;
create policy quota_direct_access_denied on oferta_private.usage_limits for all to authenticated using(false) with check(false);
drop index if exists public.offers_image;
create index offers_image on public.offers(image_path,user_id);
create or replace function oferta_private.consume_usage(usage_kind text) returns boolean language plpgsql security definer set search_path='' as $$
declare period text;max_calls integer;actual integer;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if usage_kind='ai' then period=to_char(now() at time zone 'UTC','YYYY-MM-DD');max_calls=20;
 elsif usage_kind='extract' then period=to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI');max_calls=30;
 else raise exception 'Invalid quota';end if;
 insert into oferta_private.usage_limits(user_id,kind,window_key,count) values(auth.uid(),usage_kind,period,1)
 on conflict(user_id,kind,window_key) do update set count=oferta_private.usage_limits.count+1 where oferta_private.usage_limits.count<max_calls returning count into actual;
 return actual is not null;
end;$$;
revoke all on function oferta_private.consume_usage(text) from public,anon;
grant execute on function oferta_private.consume_usage(text) to authenticated;
create or replace function public.consume_usage(usage_kind text) returns boolean language sql security invoker set search_path='' as $$ select oferta_private.consume_usage(usage_kind); $$;
revoke all on function public.consume_usage(text) from public,anon;grant execute on function public.consume_usage(text) to authenticated;
