// 詳細検索のマーク（info）で表示する説明。
// imgs には、public/img/help/ に置いた画像のファイル名を書く
export const HELP: Record<string, { text: string; imgs?: string[] }> = {
  cross: {
    text: '看板に記載された、交差点で交わる道路の名前で探します。記載がある場合は通称でも入力できます。',
    imgs: ['tips2.webp'],
  },
  hwy: {
    text: '看板の緑色の部分に書かれた、高速道路に関する文字で探します。路線名、IC/JCT/入口名、トンネル名などを入力してください。',
    imgs: ['tips1.webp'],
  },
};
