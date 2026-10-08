// 青看板1件ぶんのデータ。
// 元のJSONは日本語キー（'道路名' など）ですが、プログラム内では扱いやすい英語名に変換して使います。
export interface Sign {
  id: string;          // IMGcode（無い場合は row-番号）
  hasImage: boolean;   // IMGcode があるか
  roadName: string;    // 道路名
  place: string;       // 地名
  roadType: string;    // 道路種別（国道 / 県道 / その他）
  formalName: string;  // 正式名称
  nickname: string;    // 通称
  prefecture: string;  // 都道府県
  address: string;     // 住所
  cross: string;       // 交差路線
  highway: string;     // 高速
  features: string;    // 特徴
  shotDate: string;    // 撮影日
  lat: number;
  lng: number;
}

// 「詳細検索」ダイアログで設定する条件
export interface AdvFilters {
  prefs: string[];     // 空 = すべて
  roadType: string;    // '' = すべて
  road: string;
  addr: string;
  cross: string;
  hwy: string;
  feats: string[];
  mode: 'AND' | 'OR';
}

// 地図/リストで「選ばれている看板」とそのきっかけ
export interface Selection {
  id: string;
  source: 'card' | 'marker' | 'url' | 'random';
}
