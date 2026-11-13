import { FEATURE_GROUPS } from './constants';
import type { AdvFilters } from './types';

// 絞り込み中の条件を、画面に出す「札（チップ）」にするための部品
export interface AdvChip {
  key: string;                                // 札の識別用
  label: string;                              // 札に書く文字
  remove: (adv: AdvFilters) => AdvFilters;    // この札を外したあとの条件
}

const FEAT_LABEL: Record<string, string> = {};
for (const g of FEATURE_GROUPS) for (const f of g.items) FEAT_LABEL[f.value] = f.label;

const ROAD_TYPE_LABEL: Record<string, string> = { 国道: '国道', 県道: '都道府県道', その他: 'その他' };

type TextKey = 'road' | 'addr' | 'cross' | 'hwy';
const TEXT_FIELDS: [TextKey, string][] = [
  ['road', '路線'],
  ['addr', '所在地'],
  ['cross', '交差'],
  ['hwy', '高速'],
];

export function advChips(adv: AdvFilters): AdvChip[] {
  const chips: AdvChip[] = [];
  for (const p of adv.prefs) {
    chips.push({ key: 'pref:' + p, label: p, remove: (a) => ({ ...a, prefs: a.prefs.filter((x) => x !== p) }) });
  }
  if (adv.roadType) {
    chips.push({
      key: 'type',
      label: '種別：' + (ROAD_TYPE_LABEL[adv.roadType] ?? adv.roadType),
      remove: (a) => ({ ...a, roadType: '' }),
    });
  }
  for (const [k, name] of TEXT_FIELDS) {
    const v = adv[k].trim();
    if (v) {
      chips.push({
        key: k,
        label: `${name}：${v}`,
        remove: (a) => {
          const next = { ...a };
          next[k] = '';
          return next;
        },
      });
    }
  }
  for (const f of adv.feats) {
    chips.push({ key: 'feat:' + f, label: FEAT_LABEL[f] ?? f, remove: (a) => ({ ...a, feats: a.feats.filter((x) => x !== f) }) });
  }
  // ORは結果が大きく変わるので、条件が2つ以上あるときは札で知らせる
  if (adv.mode === 'OR' && chips.length >= 2) {
    chips.push({ key: 'mode', label: 'いずれかを含む', remove: (a) => ({ ...a, mode: 'AND' }) });
  }
  return chips;
}

// 条件の種類がいくつ入っているか（詳細検索ボタンのバッジに使う）
export function advKinds(adv: AdvFilters): number {
  return (
    (adv.prefs.length > 0 ? 1 : 0) +
    (adv.roadType ? 1 : 0) +
    TEXT_FIELDS.filter(([k]) => adv[k].trim() !== '').length +
    (adv.feats.length > 0 ? 1 : 0)
  );
}
