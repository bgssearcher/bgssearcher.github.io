// 地方 → 都道府県
export const REGION_MAP: Record<string, string[]> = {
  北海道東北: ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  関東: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
  中部: ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  近畿: ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  中国: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
  四国: ['徳島県', '香川県', '愛媛県', '高知県'],
  九州沖縄: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
};

// 詳細検索に表示する都道府県（データが増えたらここに足すだけ）
export const AVAILABLE_PREFS = [
  '埼玉県', '千葉県', '東京都', '神奈川県', '石川県', '山梨県', '岐阜県', '静岡県', '京都府',
];

// 詳細検索に表示する地方ボタン
export const AVAILABLE_REGIONS = ['関東', '中部', '近畿'];

export interface FeatureDef {
  value: string; // データの「特徴」列に含まれる文字
  label: string; // 画面表示
  img: string;   // public/img 内のファイル名
}

// 特徴チェックボックス（元のHTMLで1個ずつ書いていたものをデータ化）
export const FEATURE_GROUPS: { title: string; items: FeatureDef[] }[] = [
  {
    title: '《方向》',
    items: [
      { value: '1', label: '1方向', img: 'direction1.svg' },
      { value: '2', label: '2方向', img: 'direction2.svg' },
      { value: '3', label: '3方向', img: 'direction3.svg' },
      { value: '4', label: '4方向', img: 'direction4.svg' },
      { value: '5', label: '5方向以上', img: 'direction5.svg' },
      { value: '十字路', label: '十字路', img: 'crossimg_2.svg' },
      { value: '丁字路', label: '丁字路', img: 'crossimg_stp.svg' },
      { value: 'カーブ', label: 'カーブ', img: 'curve.svg' },
      { value: 'ランプ', label: 'ランプ', img: 'ramp.svg' },
      { value: '線路', label: '線路', img: 'rail.svg' },
      { value: '橋梁', label: '橋梁', img: 'bridge.svg' },
      { value: '連名', label: '連名', img: 'consecutive.svg' },
      { value: '立体', label: '立体交差', img: 'gsi.svg' },
      { value: '変形', label: '変形交差点', img: 'special.svg' },
      { value: '矢印なし', label: '矢印なし', img: 'crossimg_x.svg' },
    ],
  },
  {
    title: '《形状》',
    items: [
      { value: '距離', label: '距離', img: 'distance.jpg' },
      { value: '分割', label: '車線別', img: 'lane.svg' },
      { value: 'シンボル', label: 'シンボル', img: 'symbol.jpg' },
      { value: '電光', label: '電光', img: 'shape3.jpg' },
      { value: '車高', label: '車高制限', img: 'height.svg' },
      { value: '車種', label: '車種制限', img: 'type.svg' },
      { value: '禁止', label: '進入禁止', img: 'keepout.svg' },
      { value: '標識', label: '他標識', img: 'elsemark.svg' },
      { value: '信号', label: '信号', img: 'signal.svg' },
      { value: '駅', label: '駅', img: 'station.svg' },
      { value: '修正', label: '修正跡', img: 'revision.svg' },
      { value: 'ツートン', label: 'ツートン', img: 'two-tone.svg' },
      { value: '角丸', label: '角丸', img: 'rounded_corners.svg' },
      { value: '矢印外', label: '矢印外標識', img: 'outsign.jpg' },
    ],
  },
  {
    title: '《字体》',
    items: [
      { value: '旧式', label: 'レトロ', img: 'retro.jpg' },
      { value: '公団', label: '公団ｺﾞｼｯｸ', img: 'HighwayGothic.jpg' },
      { value: '無英', label: '英語表記無', img: 'noEN.jpg' },
    ],
  },
];

export const DATA_URL =
  'https://gist.githubusercontent.com/Sesso-richu/b4103ef817678288cd1950fea60a8a01/raw/bgs.json';
export const IMAGE_BASE = 'https://sesso-richu.github.io/bgs_images';
export const CHUNK_SIZE = 30;
