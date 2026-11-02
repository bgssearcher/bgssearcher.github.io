import { NEAR_MAX_KM, NEAR_MIN_KM } from './constants';
import { roundCoord } from './geo';
import type { AdvFilters, NearSpec } from './types';

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

// 検索条件が1つでも入っているか（入っていれば「検索モード」、なければ「地図の範囲モード」）
export function hasFilter(q: string, adv: AdvFilters): boolean {
  return (
    q.trim() !== '' ||
    adv.prefs.length > 0 ||
    adv.roadType !== '' ||
    adv.road.trim() !== '' ||
    adv.addr.trim() !== '' ||
    adv.cross.trim() !== '' ||
    adv.hwy.trim() !== '' ||
    adv.feats.length > 0
  );
}

// ---------- URLパラメータ（?q=…&pref=…&id=…） ----------
export interface UrlState {
  q: string;
  adv: AdvFilters;
  id: string | null;
  near: NearSpec | null;
}

// ?near=lat,lng,km  ->  radius search conditions (null if it is not valid)
function parseNear(v: string | null): NearSpec | null {
  if (!v) return null;
  const [lat, lng, km] = v.split(',').map(Number);
  if (![lat, lng, km].every(Number.isFinite)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (km < NEAR_MIN_KM || km > NEAR_MAX_KM) return null;
  return { lat: roundCoord(lat), lng: roundCoord(lng), km, source: 'link' };
}

export function parseUrl(search: string): UrlState {
  const p = new URLSearchParams(search);
  const list = (key: string) => (p.get(key) ? p.get(key)!.split(',') : []);
  return {
    q: p.get('q') ?? '',
    id: p.get('id'),
    near: parseNear(p.get('near')),
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

export function buildQueryString(q: string, adv: AdvFilters, keepId: string | null, near: NearSpec | null = null): string {
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
  if (near) p.set('near', [roundCoord(near.lat), roundCoord(near.lng), near.km].join(','));
  return p.toString();
}
