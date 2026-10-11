// 青看板データを Supabase から取り出して返す「窓口」。
// ブラウザは Supabase に直接つながず、ここを経由します（キーを隠せる・Cloudflare にキャッシュできる）。

const COLUMNS = [
  'code', 'img_code', 'road_name', 'formal_name', 'nickname', 'road_type', 'prefecture',
  'place', 'address', 'cross_road', 'highway', 'features', 'shot_date', 'lat', 'lng',
].join(',');

const CACHE_SECONDS = 3600; // 1時間

export async function GET(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Supabase の設定（SUPABASE_URL / SUPABASE_ANON_KEY）がありません' }, { status: 500 });
  }

  // Cloudflare のキャッシュ。独自ドメイン（aokanban.com）でだけ効き、
  // ローカルや workers.dev の試験版では使われず、毎回 Supabase に取りに行きます。
  const cache: Cache | undefined = typeof caches !== 'undefined' ? (caches as any).default : undefined;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set('X-Cache', 'HIT');
      return new Response(hit.body, { status: hit.status, headers });
    }
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/signs?select=${COLUMNS}&order=sort_order.asc&limit=1000`,
    { headers: { apikey: supabaseKey } },
  );
  if (!res.ok) {
    return Response.json({ error: 'データを取得できませんでした' }, { status: 502 });
  }

  const body = await res.text();
  const baseHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
  };
  if (cache) await cache.put(cacheKey, new Response(body, { headers: baseHeaders }));

  return new Response(body, { headers: { ...baseHeaders, 'X-Cache': 'MISS' } });
}
