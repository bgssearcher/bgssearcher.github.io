// 詳細検索のマーク（info）で表示する説明。
// imgs には、public/img/help/ に置いた画像のファイル名を書く
export const HELP: Record<string, { text: string; imgs?: string[] }> = {
  cross: {
    text: '看板のある交差点で交わる道路の名前で探します。国道・県道・通り名のどれでも入力できます。',
    imgs: ['tips2.webp'],
  },
  hwy: {
    text: '看板の緑色の部分に書かれた、高速道路に関する文字で探します。路線名・インターチェンジ名・トンネル名などを入れてください。',
    imgs: ['tips1.webp'],
  },
};
