// 青看板データを Supabase から取り出して返す「窓口」。
// ブラウザは Supabase に直接つながず、ここを経由します（キーを隠せる・Cloudflare にキャッシュできる）。
//
//   /api/signs?kind=area&s=南&w=西&n=北&e=東   … 地図の範囲にある看板（軽い項目だけ）
//   /api/signs?kind=search&q=…&pref=…           … 条件に合う看板（全国から・軽い項目だけ）
//   /api/signs?kind=one&code=… または &img=…    … 1件（詳細つき）
//   /api/signs?kind=random                      … ランダムな1件（詳細つき）
//   /api/signs?kind=cluster&z=ズーム&s&w&n&e    … 地図を引いたときの「まとまり」（数字つきの丸）
//   /api/signs?kind=meta                        … 全部で何件あるか

import { AREA_LIMIT, SEARCH_LIMIT } from '../../../lib/constants';
import { clusterCell } from '../../../lib/geo';
import { buildFilter } from '../../../lib/query';
import { buildQueryString, hasFilter, parseUrl } from '../../../lib/signs';

const LIGHT = 'code,img_code,road_name,road_type,nickname,address,lat,lng';
const FULL = LIGHT + ',formal_name,place,shot_date';
const CACHE_SECONDS = 3600; // 1時間

class HttpError extends Error {
  constructor(public status: number, message: string, public detail?: string) {
    super(message);
  }
}

// ---------- Supabase への問い合わせ ----------
function sbEnv() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key) throw new HttpError(500, 'Supabase の設定（SUPABASE_URL / SUPABASE_ANON_KEY）がありません');
  return { base, key };
}

async function sbCheck(res: Response) {
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    throw new HttpError(502, 'データを取得できませんでした', `Supabase ${res.status}: ${text}`);
  }
}

// 表を読む。count を true にすると、条件に合う件数（上限なし）も一緒に受け取る
async function sbGet(
  params: URLSearchParams,
  opts: { count?: boolean } = {},
): Promise<{ rows: Record<string, unknown>[]; count: number | null }> {
  const { base, key } = sbEnv();
  const headers: Record<string, string> = { apikey: key };
  if (opts.count) headers['Prefer'] = 'count=exact';
  const res = await fetch(`${base}/rest/v1/signs?${params.toString()}`, { headers });
  await sbCheck(res);
  let count: number | null = null;
  if (opts.count) {
    const m = /\/(\d+)$/.exec(res.headers.get('content-range') ?? '');
    if (m) count = Number(m[1]);
  }
  return { rows: await res.json(), count };
}

// データベース側の関数（signs_clusters）を呼ぶ
async function sbRpc(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const { base, key } = sbEnv();
  const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  await sbCheck(res);
  return res.json();
}

// ---------- Cloudflare のキャッシュ ----------
// 独自ドメイン（aokanban.com）でだけ効きます。ローカルや workers.dev の試験版では毎回 Supabase に取りに行きます。
async function cachedJson(origin: string, key: string, produce: () => Promise<unknown>) {
  const cache: Cache | undefined = typeof caches !== 'undefined' ? (caches as any).default : undefined;
  const cacheReq = new Request(`${origin}/__cache/${encodeURIComponent(key)}`);

  if (cache) {
    const hit = await cache.match(cacheReq);
    if (hit) return { data: await hit.json(), hit: true };
  }
  const data = await produce();
  if (cache) {
    await cache.put(
      cacheReq,
      new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
      }),
    );
  }
  return { data, hit: false };
}

function json(data: unknown, opts: { hit?: boolean; cache?: boolean; status?: number } = {}): Response {
  return new Response(JSON.stringify(data), {
    status: opts.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': opts.cache === false ? 'no-store' : `public, max-age=${CACHE_SECONDS}`,
      'X-Cache': opts.hit ? 'HIT' : 'MISS',
    },
  });
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

// ---------- 入り口 ----------
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = url.searchParams;
  try {
    switch (sp.get('kind')) {
      case 'area':
        return await handleArea(url);
      case 'search':
        return await handleSearch(url);
      case 'one':
        return await handleOne(url);
      case 'random':
        return await handleRandom(url);
      case 'cluster':
        return await handleCluster(url);
      case 'meta':
        return json({ total: await getTotal(url.origin) });
      default:
        throw new HttpError(400, 'kind が正しくありません');
    }
  } catch (e) {
    if (e instanceof HttpError) {
      return json({ error: e.message, detail: e.detail }, { status: e.status, cache: false });
    }
    return json({ error: '予期しないエラーが起きました' }, { status: 500, cache: false });
  }
}

// ---------- 地図の範囲 ----------
async function handleArea(url: URL) {
  const sp = url.searchParams;
  const s = r4(parseFloat(sp.get('s') ?? ''));
  const w = r4(parseFloat(sp.get('w') ?? ''));
  const n = r4(parseFloat(sp.get('n') ?? ''));
  const e = r4(parseFloat(sp.get('e') ?? ''));
  if (![s, w, n, e].every(Number.isFinite) || s > n || w > e) throw new HttpError(400, '範囲の指定が正しくありません');
  if (s < -90 || n > 90 || w < -180 || e > 180) throw new HttpError(400, '範囲の指定が正しくありません');
  if (n - s > 3 || e - w > 3) throw new HttpError(400, '範囲が広すぎます');

  const { data, hit } = await cachedJson(url.origin, `area|${s}|${w}|${n}|${e}`, async () => {
    const p = new URLSearchParams();
    p.set('select', LIGHT);
    p.append('lat', `gte.${s}`);
    p.append('lat', `lte.${n}`);
    p.append('lng', `gte.${w}`);
    p.append('lng', `lte.${e}`);
    p.set('order', 'sort_order.asc');
    p.set('limit', String(AREA_LIMIT + 1));
    const { rows } = await sbGet(p);
    // 多すぎるときは、中途半端な一部を返さず、「多い」とだけ知らせる（画面側が、まとまり表示に切り替える）
    return rows.length > AREA_LIMIT ? { rows: [], truncated: true } : { rows, truncated: false };
  });
  return json(data, { hit });
}

// ---------- 検索 ----------
async function handleSearch(url: URL) {
  const sp = new URLSearchParams(url.searchParams);
  sp.delete('kind');
  const { q, adv } = parseUrl(sp.toString());
  if (!hasFilter(q, adv)) throw new HttpError(400, '検索条件がありません');
  const filter = buildFilter(q, adv);
  if (!filter) throw new HttpError(400, '検索条件がありません');

  const { data, hit } = await cachedJson(url.origin, `search|${buildQueryString(q, adv, null)}`, async () => {
    const p = new URLSearchParams();
    p.set('select', LIGHT);
    p.set(filter.key, filter.value);
    p.set('order', 'sort_order.asc');
    p.set('limit', String(SEARCH_LIMIT + 1));
    const { rows, count } = await sbGet(p, { count: true });
    return {
      rows: rows.slice(0, SEARCH_LIMIT),
      truncated: rows.length > SEARCH_LIMIT,
      hits: count ?? Math.min(rows.length, SEARCH_LIMIT),
    };
  });
  return json(data, { hit });
}

// ---------- 1件 ----------
async function handleOne(url: URL) {
  const code = url.searchParams.get('code');
  const img = url.searchParams.get('img');
  if (!code && !img) throw new HttpError(400, 'code か img が必要です');
  if ((code ?? img ?? '').length > 100) throw new HttpError(400, '値が長すぎます');

  const { data, hit } = await cachedJson(url.origin, `one|${code ? 'code' : 'img'}|${code ?? img}`, async () => {
    const p = new URLSearchParams();
    p.set('select', FULL);
    p.set(code ? 'code' : 'img_code', `eq.${code ?? img}`);
    p.set('limit', '1');
    const { rows } = await sbGet(p);
    return { row: rows[0] ?? null };
  });
  return json(data, { hit });
}

// ---------- 全部で何件か ----------
// sort_order は 1〜件数 の連番なので、最大値が件数。1時間キャッシュする
async function getTotal(origin: string): Promise<number> {
  const { data } = await cachedJson(origin, 'meta|total', async () => {
    const p = new URLSearchParams();
    p.set('select', 'sort_order');
    p.set('order', 'sort_order.desc');
    p.set('limit', '1');
    const { rows } = await sbGet(p);
    return { total: rows[0] ? Number(rows[0]['sort_order']) : 0 };
  });
  return (data as { total: number }).total;
}

// ---------- ランダム ----------
async function handleRandom(url: URL) {
  const total = await getTotal(url.origin);
  if (!total) return json({ row: null }, { cache: false });

  const pick = 1 + Math.floor(Math.random() * total);
  const p = new URLSearchParams();
  p.set('select', FULL);
  p.set('sort_order', `eq.${pick}`);
  p.set('limit', '1');
  const { rows } = await sbGet(p);
  return json({ row: rows[0] ?? null }, { cache: false });
}

// ---------- 地図を引いたときの「まとまり」 ----------
async function handleCluster(url: URL) {
  const sp = url.searchParams;
  const z = parseInt(sp.get('z') ?? '', 10);
  const s = parseFloat(sp.get('s') ?? '');
  const w = parseFloat(sp.get('w') ?? '');
  const n = parseFloat(sp.get('n') ?? '');
  const e = parseFloat(sp.get('e') ?? '');
  if (!Number.isInteger(z) || z < 0 || z > 20) throw new HttpError(400, 'ズームの指定が正しくありません');
  if (![s, w, n, e].every(Number.isFinite) || s > n || w > e) throw new HttpError(400, '範囲の指定が正しくありません');
  if (s < -90 || n > 90 || w < -180 || e > 180) throw new HttpError(400, '範囲の指定が正しくありません');

  // 範囲を格子（まとまり1つぶん）に合わせて広げる。同じ場所なら、誰が見ても同じ範囲になり、キャッシュが効く
  const cell = clusterCell(z);
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  const S = r6(Math.floor(s / cell) * cell);
  const W = r6(Math.floor(w / cell) * cell);
  const N = r6(Math.ceil(n / cell) * cell);
  const E = r6(Math.ceil(e / cell) * cell);
  if (((N - S) / cell) * ((E - W) / cell) > 3000) throw new HttpError(400, '範囲が広すぎます');

  const { data, hit } = await cachedJson(url.origin, `cluster|${z}|${S}|${W}|${N}|${E}`, async () => {
    const rows = await sbRpc('signs_clusters', { p_grid: cell, p_s: S, p_w: W, p_n: N, p_e: E });
    return { cells: rows, bbox: { south: S, west: W, north: N, east: E } };
  });
  return json(data, { hit });
}
