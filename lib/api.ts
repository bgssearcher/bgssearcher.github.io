// ブラウザから /api/signs を呼ぶ関数たち
import type { Bounds } from './geo';
import { buildQueryString } from './signs';
import type { AdvFilters, ClusterCell, Sign, SignDetail } from './types';

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

function toSign(raw: Record<string, unknown>): Sign {
  const imgCode = str(raw['img_code']);
  return {
    id: str(raw['code']),
    imgCode,
    hasImage: imgCode !== '',
    roadName: str(raw['road_name']),
    roadType: str(raw['road_type']),
    nickname: str(raw['nickname']),
    address: str(raw['address']),
    lat: Number(raw['lat']),
    lng: Number(raw['lng']),
  };
}

function toDetail(raw: Record<string, unknown>): SignDetail {
  return {
    formalName: str(raw['formal_name']),
    place: str(raw['place']),
    shotDate: str(raw['shot_date']),
  };
}

async function getJson(query: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch('/api/signs?' + query, { signal });
  if (!res.ok) {
    let msg = 'ネットワークエラーが発生しました: ' + res.status;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error + (j.detail ? '（' + j.detail + '）' : '');
    } catch {
      /* JSON でなければそのまま */
    }
    throw new Error(msg);
  }
  return res.json();
}

interface ListResult {
  signs: Sign[];
  truncated: boolean;
  hits: number; // 条件に合う件数（検索のときだけ。受け取った件数より多いことがある）
}

function toList(j: any): ListResult {
  const signs = (j.rows as Record<string, unknown>[]).map(toSign);
  return { signs, truncated: !!j.truncated, hits: typeof j.hits === 'number' ? j.hits : signs.length };
}

// 地図の表示範囲にある看板
export async function fetchArea(b: Bounds, signal?: AbortSignal): Promise<ListResult> {
  const p = new URLSearchParams({
    kind: 'area',
    s: String(b.south),
    w: String(b.west),
    n: String(b.north),
    e: String(b.east),
  });
  return toList(await getJson(p.toString(), signal));
}

// 地図を引いたときの「まとまり」（数字つきの丸）。範囲は、サーバー側で格子に合わせて広げられる
export async function fetchCluster(
  b: Bounds,
  zoom: number,
  signal?: AbortSignal,
): Promise<{ cells: ClusterCell[]; bbox: Bounds }> {
  const p = new URLSearchParams({
    kind: 'cluster',
    z: String(zoom),
    s: String(b.south),
    w: String(b.west),
    n: String(b.north),
    e: String(b.east),
  });
  const j = await getJson(p.toString(), signal);
  return {
    cells: (j.cells as Record<string, unknown>[]).map((c) => ({ lat: Number(c.lat), lng: Number(c.lng), cnt: Number(c.cnt) })),
    bbox: j.bbox as Bounds,
  };
}

// 全部で何件あるか
export async function fetchTotal(): Promise<number> {
  const j = await getJson('kind=meta');
  return Number(j.total) || 0;
}

// 条件に合う看板（全国から）
export async function fetchSearch(q: string, adv: AdvFilters, signal?: AbortSignal): Promise<ListResult> {
  return toList(await getJson('kind=search&' + buildQueryString(q, adv, null), signal));
}

// 1件だけ（詳細つき）。共有リンクの ?id=（IMGcode）や、カードを開いたときの詳細取得に使う
export async function fetchOne(by: { code?: string; img?: string }): Promise<{ sign: Sign; detail: SignDetail } | null> {
  const p = new URLSearchParams({ kind: 'one' });
  if (by.code) p.set('code', by.code);
  if (by.img) p.set('img', by.img);
  const j = await getJson(p.toString());
  return j.row ? { sign: toSign(j.row), detail: toDetail(j.row) } : null;
}

// ランダムな1件（全国から）
export async function fetchRandom(): Promise<{ sign: Sign; detail: SignDetail } | null> {
  const j = await getJson('kind=random');
  return j.row ? { sign: toSign(j.row), detail: toDetail(j.row) } : null;
}
