import { DATA_URL } from './constants';
import type { AdvFilters, Sign } from './types';

export const EMPTY_ADV: AdvFilters = {
  prefs: [],
  roadType: '',
  road: '',
  addr: '',
  cross: '',
  hwy: '',
  feats: [],
  mode: 'AND',
};

// ---------- 文字の正規化 ----------
export function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str.normalize('NFKC').toLowerCase().replace(/[ー－―‐-]/g, '-');
}

function splitWords(raw: string): string[] {
  const t = raw.trim();
  return t ? normalizeText(t).split(/[\s,、]+/).filter(Boolean) : [];
}

// ---------- データ読み込み ----------
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export async function loadSigns(): Promise<Sign[]> {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('ネットワークエラーが発生しました: ' + res.status);
  const raw: Record<string, unknown>[] = await res.json();

  const signs: Sign[] = [];
  raw.forEach((item, i) => {
    if (!item) return;
    const lat = parseFloat(str(item['lat']));
    const lng = parseFloat(str(item['lng']));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const code = str(item['IMGcode']);
    signs.push({
      id: code || `row-${i}`,
      hasImage: code !== '',
      roadName: str(item['道路名']),
      place: str(item['地名']),
      roadType: str(item['道路種別']),
      formalName: str(item['正式名称']),
      nickname: str(item['通称']),
      prefecture: str(item['都道府県']),
      address: str(item['住所']),
      cross: str(item['交差路線']),
      highway: str(item['高速']),
      features: str(item['特徴']),
      shotDate: str(item['撮影日']),
      lat,
      lng,
    });
  });
  if (signs.length === 0) throw new Error('表示できるデータが0件です');
  return signs;
}

// ---------- 絞り込み ----------
export function filterSigns(all: Sign[], q: string, adv: AdvFilters): Sign[] {
  const qWords = splitWords(q);
  const roadWords = splitWords(adv.road);
  const addrWords = splitWords(adv.addr);
  const crossWords = splitWords(adv.cross);
  const hwyWords = splitWords(adv.hwy);
  const mode = adv.mode;

  return all.filter((row) => {
    const conditions: boolean[] = [];

    if (qWords.length > 0) {
      const t = normalizeText(row.place);
      conditions.push(qWords.every((w) => t.includes(w)));
    }
    if (adv.prefs.length > 0) {
      conditions.push(adv.prefs.includes(row.prefecture));
    }
    if (adv.roadType) {
      conditions.push(row.roadType === adv.roadType);
    }
    if (roadWords.length > 0) {
      const t = normalizeText(`${row.roadName} ${row.formalName} ${row.nickname}`);
      conditions.push(roadWords.every((w) => t.includes(w)));
    }
    if (addrWords.length > 0) {
      const t = normalizeText(row.address);
      conditions.push(addrWords.every((w) => t.includes(w)));
    }
    if (crossWords.length > 0) {
      const t = normalizeText(row.cross);
      conditions.push(crossWords.every((w) => t.includes(w)));
    }
    if (hwyWords.length > 0) {
      const t = normalizeText(row.highway);
      conditions.push(hwyWords.every((w) => t.includes(w)));
    }
    if (adv.feats.length > 0) {
      conditions.push(
        mode === 'AND'
          ? adv.feats.every((f) => row.features.includes(f))
          : adv.feats.some((f) => row.features.includes(f)),
      );
    }

    if (conditions.length === 0) return true;
    return mode === 'AND' ? conditions.every(Boolean) : conditions.some(Boolean);
  });
}

// ---------- URLパラメータ（?q=…&pref=…&id=…） ----------
export interface UrlState {
  q: string;
  adv: AdvFilters;
  id: string | null;
}

export function parseUrl(search: string): UrlState {
  const p = new URLSearchParams(search);
  const list = (key: string) => (p.get(key) ? p.get(key)!.split(',') : []);
  return {
    q: p.get('q') ?? '',
    id: p.get('id'),
    adv: {
      prefs: list('pref'),
      roadType: p.get('type') ?? '',
      road: p.get('road') ?? '',
      addr: p.get('addr') ?? '',
      cross: p.get('cross') ?? '',
      hwy: p.get('hwy') ?? '',
      feats: list('feat'),
      mode: p.get('mode') === 'OR' ? 'OR' : 'AND',
    },
  };
}

export function buildQueryString(q: string, adv: AdvFilters, keepId: string | null): string {
  const p = new URLSearchParams();
  if (keepId) p.set('id', keepId);
  if (q.trim()) p.set('q', q.trim());
  if (adv.prefs.length > 0) p.set('pref', adv.prefs.join(','));
  if (adv.roadType) p.set('type', adv.roadType);
  if (adv.road.trim()) p.set('road', adv.road.trim());
  if (adv.addr.trim()) p.set('addr', adv.addr.trim());
  if (adv.cross.trim()) p.set('cross', adv.cross.trim());
  if (adv.hwy.trim()) p.set('hwy', adv.hwy.trim());
  if (adv.feats.length > 0) p.set('feat', adv.feats.join(','));
  if (adv.mode === 'OR') p.set('mode', 'OR');
  return p.toString();
}
