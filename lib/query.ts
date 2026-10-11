// サーバー側（/api/signs）で、検索条件を Supabase（PostgREST）の書き方に変える。
import type { AdvFilters } from './types';

// 文字をそろえる（全角→半角、大文字→小文字など）。GAS が検索用の列を作るときと、まったく同じ処理にすること。
export function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str.normalize('NFKC').toLowerCase().replace(/[ー－―‐-]/g, '-');
}

// 検索の記号として意味を持ってしまう文字を取り除く
const clean = (w: string) => w.replace(/[%_\\"*(),]/g, '');

function words(raw: string): string[] {
  const t = (raw || '').trim();
  return t
    ? normalizeText(t)
        .split(/[\s,、]+/)
        .map(clean)
        .filter(Boolean)
    : [];
}

const quote = (v: string) => `"${v.replace(/["\\]/g, '')}"`;

// 戻り値: { key: 'and' | 'or', value: '(…)' }。条件が1つもなければ null。
export function buildFilter(q: string, adv: AdvFilters): { key: 'and' | 'or'; value: string } | null {
  const conds: string[] = [];

  const likeWords = (col: string, raw: string) => {
    const ws = words(raw);
    if (ws.length === 0) return;
    const parts = ws.map((w) => `${col}.like.${quote('*' + w + '*')}`);
    conds.push(parts.length === 1 ? parts[0] : `and(${parts.join(',')})`);
  };

  likeWords('place_n', q);
  if (adv.prefs.length > 0) conds.push(`prefecture.in.(${adv.prefs.map(quote).join(',')})`);
  if (adv.roadType) conds.push(`road_type.eq.${quote(adv.roadType)}`);
  likeWords('road_n', adv.road);
  likeWords('address_n', adv.addr);
  likeWords('cross_n', adv.cross);
  likeWords('highway_n', adv.hwy);

  const feats = adv.feats.map(clean).filter(Boolean);
  if (feats.length > 0) {
    const parts = feats.map((f) => `features.like.${quote('*' + f + '*')}`);
    if (parts.length === 1) conds.push(parts[0]);
    else conds.push(`${adv.mode === 'AND' ? 'and' : 'or'}(${parts.join(',')})`);
  }

  if (conds.length === 0) return null;
  return { key: adv.mode === 'OR' ? 'or' : 'and', value: `(${conds.join(',')})` };
}
