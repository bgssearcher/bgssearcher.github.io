-- ============================================================
-- PostGIS の追加（supabase_setup.sql のあとに、Supabase の SQL Editor に貼り付けて Run）
--
-- 何度実行しても、データは消えない。
-- lat / lng が、これまでどおり元のデータ。geog は、そこから自動で作られる列（GAS は何も変えなくてよい）
-- ============================================================

-- PostGIS を有効にする（部品は extensions という場所に入る）
create extension if not exists postgis with schema extensions;

-- 緯度・経度から、PostGIS の「点」を、自動で作る列（経度が先、緯度が後）
alter table public.signs
  add column if not exists geog extensions.geography(Point, 4326)
  generated always as (
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
  ) stored;

-- 空間用の索引
create index if not exists signs_geog_idx on public.signs using gist (geog);

-- ---------- 半径検索（PostGIS 版。引数と返す列は、これまでと同じ） ----------
create or replace function public.signs_nearby(
  p_lat double precision,   -- 中心の緯度
  p_lng double precision,   -- 中心の経度
  p_km double precision     -- 半径（km）
)
returns table (
  code text, img_code text, road_name text, road_type text, nickname text, address text,
  prefecture text, features text, lat double precision, lng double precision,
  place_n text, road_n text, address_n text, cross_n text, highway_n text,
  dist_km double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    s.code, s.img_code, s.road_name, s.road_type, s.nickname, s.address,
    s.prefecture, s.features, s.lat, s.lng,
    s.place_n, s.road_n, s.address_n, s.cross_n, s.highway_n,
    st_distance(s.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0 as dist_km
  from public.signs s
  where st_dwithin(s.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_km * 1000.0)
$$;

grant execute on function public.signs_nearby(double precision, double precision, double precision)
  to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- 動作確認用（実行しなくてよい。横浜駅の周り5km） ----------
-- select code, address, round(dist_km::numeric, 2) as km
-- from public.signs_nearby(35.4658, 139.6223, 5)
-- order by dist_km
-- limit 10;
