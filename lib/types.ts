// 一覧・地図に使う「軽い」データ。範囲取得のときは、これだけを受け取る。
export interface Sign {
  id: string;          // code（スプレッドシートの code/across。1件ごとに必ず異なる）
  imgCode: string;     // IMGcode（画像ファイル名・共有リンク ?id= 用。無い場合は空）
  hasImage: boolean;   // IMGcode があるか
  roadName: string;    // 道路名
  roadType: string;    // 道路種別（国道 / 県道 / その他）
  nickname: string;    // 通称
  address: string;     // 住所
  lat: number;
  lng: number;
}

// カードを開いたときに、あとから取りに行く詳細データ
export interface SignDetail {
  formalName: string;  // 正式名称
  place: string;       // 地名
  shotDate: string;    // 撮影日
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

// 地図を引いたときに表示する「まとまり」（数字つきの丸）1つぶん
export interface ClusterCell {
  lat: number; // まとまりの中心
  lng: number;
  cnt: number; // 看板の数
}

// 「この場所へ地図を動かして」という依頼（nonce が変わるたびに動く）
export interface MapTarget {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
}
