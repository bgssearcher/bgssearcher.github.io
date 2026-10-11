-- ============================================================
-- 青看板データベースの初期設定（Supabase の SQL Editor に貼り付けて Run）
--
-- 何度実行しても、データは消えません（「なければ作る」「あれば置き換える」だけです）。
-- ・プロジェクトを作り直したとき、最初に1回だけ実行する
-- ・データの更新（同期）のたびに実行する必要は、ありません。更新は GAS の「今すぐ同期」だけです
--
-- ⚠ このファイルに drop table を足さないでください（足して実行すると、全データが消えます）
-- ============================================================

-- ---------- テーブル ----------
create table if not exists public.signs (
  code        text primary key,            -- スプレッドシートの code/across（1行ごとに必ず異なる値）
  sort_order  integer not null,            -- 並び順（code の自然順に GAS が番号を振る）
  img_code    text unique,                 -- IMGcode（画像ファイル名・共有リンク ?id= 用。空の行は NULL）
  road_name   text,                        -- 道路名
  formal_name text,                        -- 正式名称
  nickname    text,                        -- 通称
  road_type   text,                        -- 道路種別（国道 / 県道 / その他）
  prefecture  text,                        -- 都道府県
  place       text,                        -- 地名
  address     text,                        -- 住所
  cross_road  text,                        -- 交差路線
  highway     text,                        -- 高速
  features    text,                        -- 特徴（元データと同じ文字列のまま保存）
  shot_date   text,                        -- 撮影日（表示用なので文字列のまま）
  lat         double precision not null,   -- 緯度
  lng         double precision not null,   -- 経度
  -- 検索用に、全角→半角・小文字などにそろえた文字（GAS が自動で作る。サイトには送られない）
  place_n     text,
  road_n      text,                        -- 道路名 + 正式名称 + 通称
  address_n   text,
  cross_n     text,
  highway_n   text,
  synced_at   timestamptz not null default now()  -- 同期した時刻（消えた行の掃除に使う）
);

-- ---------- 索引 ----------
create index if not exists signs_sort_idx on public.signs (sort_order);        -- 並び順で取り出す
create index if not exists signs_lat_lng_idx on public.signs (lat, lng);       -- 地図の範囲で探す

-- ---------- 誰でも「読む」ことだけできるようにする（書き込みは GAS の強いキーだけ） ----------
alter table public.signs enable row level security;

drop policy if exists "public read" on public.signs;
create policy "public read" on public.signs
  for select to anon, authenticated
  using (true);

-- ---------- 地図を引いたときの「まとまり（数字つきの丸）」を数える関数 ----------
create or replace function public.signs_clusters(
  p_grid double precision,   -- まとまり1つぶんの大きさ（度）
  p_s double precision,      -- 南
  p_w double precision,      -- 西
  p_n double precision,      -- 北
  p_e double precision       -- 東
)
returns table (lat double precision, lng double precision, cnt bigint)
language sql
stable
as $$
  select avg(s.lat), avg(s.lng), count(*)
  from public.signs s
  where s.lat between p_s and p_n
    and s.lng between p_w and p_e
  group by floor(s.lat / p_grid), floor(s.lng / p_grid)
  limit 2000
$$;

-- サイトから（誰でも）呼べるようにする
grant execute on function public.signs_clusters(double precision, double precision, double precision, double precision, double precision)
  to anon, authenticated;

-- 反映を促す
notify pgrst, 'reload schema';
