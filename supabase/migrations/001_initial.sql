-- Run once in the Supabase SQL Editor. No service-role key is required by the app.
create table public.image_assets (
 path text primary key,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(path,user_id),
 check (path like user_id::text || '/%')
);
create table public.offers (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 180),
 description text not null default '' check(char_length(description)<=700),
 affiliate_url text not null check(char_length(affiliate_url)<=4096 and affiliate_url ~ '^https?://'),
 image_url text not null default '' check (image_url='' or image_url ~ '^https?://'),
 image_path text,
 price numeric(12,2) check(price>0), previous_price numeric(12,2) check(previous_price>0),
 brand text not null default '', category text not null default 'Informática',
 specs jsonb not null default '[]',keywords jsonb not null default '[]',store text not null default '',
 status text not null default 'review' check(status in ('review','ready','shared')),
 style text not null default 'promotional' check(style in ('simple','professional','promotional')),
 message text not null default '' check(char_length(message)<=6000),
 affiliate_disclosure boolean not null default true,
 uncertainties jsonb not null default '[]',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,affiliate_url),
 foreign key(image_path,user_id) references public.image_assets(path,user_id) on delete restrict
);
create index offers_user_date on public.offers(user_id,created_at desc);
create index offers_image on public.offers(image_path);
create index image_assets_owner on public.image_assets(user_id);
create table public.image_delete_queue(path text primary key,user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table public.offers enable row level security;
alter table public.image_assets enable row level security;
alter table public.image_delete_queue enable row level security;
create index image_delete_queue_owner on public.image_delete_queue(user_id);
revoke all on public.offers,public.image_assets,public.image_delete_queue from anon;
grant select,insert,update,delete on public.offers,public.image_assets,public.image_delete_queue to authenticated;
create policy offers_owned on public.offers for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy images_owned on public.image_assets for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy queue_owned on public.image_delete_queue for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.touch_offer() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=now();return new;end;$$;
create trigger update_offer_time before update on public.offers for each row execute function public.touch_offer();
create function public.delete_offers(offer_ids uuid[]) returns jsonb language plpgsql security invoker set search_path=public as $$
declare removed_ids uuid[]; paths text[]; orphan_paths text[];
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if cardinality(offer_ids) is null or cardinality(offer_ids)<1 or cardinality(offer_ids)>100 then raise exception 'Invalid selection';end if;
 if (select count(distinct id) from public.offers where id=any(offer_ids) and user_id=auth.uid()) <> (select count(distinct x) from unnest(offer_ids) x) then raise exception 'Selection contains unauthorized or missing records';end if;
 select array_agg(distinct image_path) filter(where image_path is not null) into paths from public.offers where id=any(offer_ids) and user_id=auth.uid();
 with deleted as (delete from public.offers where id=any(offer_ids) and user_id=auth.uid() returning id) select array_agg(id) into removed_ids from deleted;
 with deleted_assets as (delete from public.image_assets a where a.path=any(coalesce(paths,'{}')) and a.user_id=auth.uid() and not exists(select 1 from public.offers o where o.image_path=a.path) returning a.path) select array_agg(path) into orphan_paths from deleted_assets;
 insert into public.image_delete_queue(path,user_id) select p,auth.uid() from unnest(coalesce(orphan_paths,'{}')) p on conflict do nothing;
 return jsonb_build_object('ids',coalesce(to_jsonb(removed_ids),'[]'),'paths',coalesce(to_jsonb(orphan_paths),'[]'));
end;$$;
revoke all on function public.delete_offers(uuid[]) from public,anon;grant execute on function public.delete_offers(uuid[]) to authenticated;
create function public.release_image(asset_path text) returns boolean language plpgsql security invoker set search_path=public as $$
declare removed text;
begin
 delete from public.image_assets a where a.path=asset_path and a.user_id=auth.uid() and not exists(select 1 from public.offers o where o.image_path=a.path) returning a.path into removed;
 if removed is null then return false;end if;
 insert into public.image_delete_queue(path,user_id) values(removed,auth.uid()) on conflict do nothing;return true;
end;$$;
revoke all on function public.release_image(text) from public,anon;grant execute on function public.release_image(text) to authenticated;
create table public.usage_limits(user_id uuid not null references auth.users(id) on delete cascade,kind text not null,window_key text not null,count integer not null default 0,primary key(user_id,kind,window_key));
alter table public.usage_limits enable row level security;
-- Only the security-definer quota RPC can mutate this table. No direct client access.
revoke all on public.usage_limits from anon,authenticated;
create schema if not exists oferta_private;
revoke all on schema oferta_private from public,anon;
grant usage on schema oferta_private to authenticated;
create function oferta_private.consume_usage(usage_kind text) returns boolean language plpgsql security definer set search_path='' as $$
declare period text;max_calls integer;actual integer;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if usage_kind='ai' then period=to_char(now() at time zone 'UTC','YYYY-MM-DD');max_calls=20;
 elsif usage_kind='extract' then period=to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI');max_calls=30;
 else raise exception 'Invalid quota';end if;
 insert into public.usage_limits(user_id,kind,window_key,count) values(auth.uid(),usage_kind,period,1)
 on conflict(user_id,kind,window_key) do update set count=public.usage_limits.count+1 where public.usage_limits.count<max_calls returning count into actual;
 return actual is not null;
end;$$;
revoke all on function oferta_private.consume_usage(text) from public,anon;
grant execute on function oferta_private.consume_usage(text) to authenticated;
create function public.consume_usage(usage_kind text) returns boolean language sql security invoker set search_path='' as $$ select oferta_private.consume_usage(usage_kind); $$;
revoke all on function public.consume_usage(text) from public,anon;grant execute on function public.consume_usage(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('offer-images','offer-images',false,5000000,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy product_images_read on storage.objects for select to authenticated using(bucket_id='offer-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy product_images_insert on storage.objects for insert to authenticated with check(bucket_id='offer-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy product_images_delete on storage.objects for delete to authenticated using(bucket_id='offer-images' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.image_assets a where a.path=name));
