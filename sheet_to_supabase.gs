/**
 * スプレッドシート → Supabase 同期スクリプト（主キーは code）
 *
 * 使い方
 *  1. スプレッドシートの「拡張機能」→「Apps Script」を開き、このコードを貼り付ける
 *  2. 「プロジェクトの設定」→「スクリプト プロパティ」に次の2つを登録する
 *       SUPABASE_URL          例: https://xxxxxxxx.supabase.co
 *       SUPABASE_SERVICE_KEY  Supabase の service_role キー（絶対に他へ漏らさない）
 *  3. 下の SHEET_NAME を、実際のシート名に直す
 *  4. スプレッドシートを開き直すと、メニューに「Supabase」が出る → 「今すぐ同期」
 */

const SHEET_NAME = 'シート1';   // ← 実際のシート名に変更してください
const TABLE = 'signs';
const BATCH_SIZE = 500;         // 1回の送信件数
const SORT_BY_CODE = true;      // true: code の自然順（2 < 10）で並べる / false: シートの並びのまま

// 「データベースの列名」: [今の見出し（日本語など）]
// 見出しは、左の列名（英語）でも、右の今の見出しでも、どちらでも読み取ります。
// → スプレッドシートの見出しを英語に直しても、直す前でも動きます。
// ここに書いた列「だけ」が送られます。編集用の列は、書かなければ自動で除外されます。
const COLUMNS = {
  code:        ['code/across'],
  img_code:    ['IMGcode'],
  road_name:   ['道路名'],
  formal_name: ['正式名称'],
  nickname:    ['通称'],
  road_type:   ['道路種別'],
  prefecture:  ['都道府県'],
  place:       ['地名'],
  address:     ['住所'],
  cross_road:  ['交差路線'],
  highway:     ['高速'],
  features:    ['特徴'],
  shot_date:   ['撮影日'],
  lat:         [],
  lng:         [],
};

// ---------- メニュー ----------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Supabase')
    .addItem('今すぐ同期', 'syncToSupabase')
    .addToUi();
}

// ---------- メイン処理 ----------
function syncToSupabase() {
  const runStart = new Date().toISOString();
  const { rows, skipped } = readRows_();

  if (rows.length === 0) {
    throw new Error('送るデータが0件でした。シート名・見出しを確認してください（安全のため、何も変更していません）。');
  }

  // 1. 追加・更新（同じ code は上書き）
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((r) => Object.assign({}, r, { synced_at: runStart }));
    request_('post', TABLE + '?on_conflict=code', batch, 'resolution=merge-duplicates,return=minimal');
  }

  // 2. シートから消えた行を、データベースからも消す（上の送信が全部成功したときだけ）
  request_('delete', TABLE + '?synced_at=lt.' + encodeURIComponent(runStart), null, 'return=minimal');

  const msg = '同期しました: ' + rows.length + '件' + (skipped.length ? '（スキップ ' + skipped.length + '件）' : '');
  console.log(msg);
  if (skipped.length) console.log('スキップした行: ' + skipped.join(' / '));
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Supabase', 8); } catch (e) { /* 定期実行では画面がないので無視 */ }
}

// ---------- シートの読み取り ----------
function readRows_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('シート「' + SHEET_NAME + '」が見つかりません。SHEET_NAME を直してください。');

  const values = sheet.getDataRange().getValues();         // 数値は数値のまま（緯度・経度用）
  const display = sheet.getDataRange().getDisplayValues(); // 画面表示のまま（先頭の0を守るため）
  const header = display[0].map((h) => String(h).trim());

  // 各列が、シートの何列目にあるかを調べる
  const colIndex = {};
  const missing = [];
  Object.keys(COLUMNS).forEach((col) => {
    const names = [col].concat(COLUMNS[col]);
    const idx = header.findIndex((h) => names.indexOf(h) !== -1);
    if (idx === -1) missing.push(col + '（' + names.join(' または ') + '）');
    else colIndex[col] = idx;
  });
  if (missing.length) throw new Error('次の見出しがシートにありません: ' + missing.join(', '));

  const rows = [];
  const skipped = [];
  const problems = [];
  const seenCode = {};
  const seenImg = {};

  for (let r = 1; r < display.length; r++) {
    const code = display[r][colIndex.code].trim();
    const lat = parseFloat(values[r][colIndex.lat]);
    const lng = parseFloat(values[r][colIndex.lng]);
    if (!code || !isFinite(lat) || !isFinite(lng)) {
      if (display[r].join('').trim() !== '') skipped.push((r + 1) + '行目');
      continue;
    }

    if (seenCode[code]) problems.push('code「' + code + '」が重複: ' + seenCode[code] + '行目と' + (r + 1) + '行目');
    seenCode[code] = r + 1;

    const row = { code: code, lat: lat, lng: lng };
    Object.keys(colIndex).forEach((col) => {
      if (col === 'code' || col === 'lat' || col === 'lng') return;
      const v = String(display[r][colIndex[col]]).trim();
      row[col] = v === '' ? null : v;
    });

    if (row.img_code) {
      if (seenImg[row.img_code]) problems.push('IMGcode「' + row.img_code + '」が重複: ' + seenImg[row.img_code] + '行目と' + (r + 1) + '行目');
      seenImg[row.img_code] = r + 1;
    }
    addSearchColumns_(row);
    rows.push(row);
  }

  // 重複があると、黙って片方を捨てずに、止めて知らせる
  if (problems.length) {
    throw new Error('重複があります（先頭10件）: ' + problems.slice(0, 10).join(' / '));
  }

  if (SORT_BY_CODE) rows.sort((a, b) => naturalCompare_(a.code, b.code));
  rows.forEach((row, i) => { row.sort_order = i + 1; });

  return { rows: rows, skipped: skipped };
}

// ---------- 検索用の列 ----------
// サイト側の検索（lib/query.ts の normalizeText）と、まったく同じ処理にしてください。
function normalizeText_(str) {
  if (!str) return '';
  return String(str).normalize('NFKC').toLowerCase().replace(/[ー－―‐-]/g, '-');
}

// 全角・半角、大文字・小文字の違いを気にせず検索できるように、そろえた文字の列を足す
function addSearchColumns_(row) {
  row.place_n = normalizeText_(row.place);
  row.road_n = normalizeText_([row.road_name || '', row.formal_name || '', row.nickname || ''].join(' '));
  row.address_n = normalizeText_(row.address);
  row.cross_n = normalizeText_(row.cross_road);
  row.highway_n = normalizeText_(row.highway);
}

// 数字の部分を数として比べる並べ替え（"2" が "10" より前になる）
function naturalCompare_(a, b) {
  const ax = String(a).match(/\d+|\D+/g) || [];
  const bx = String(b).match(/\d+|\D+/g) || [];
  const n = Math.min(ax.length, bx.length);
  for (let i = 0; i < n; i++) {
    const x = ax[i];
    const y = bx[i];
    if (/^\d/.test(x) && /^\d/.test(y)) {
      const d = parseInt(x, 10) - parseInt(y, 10);
      if (d !== 0) return d;
      if (x.length !== y.length) return x.length - y.length;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return ax.length - bx.length;
}

// ---------- Supabase への送信 ----------
function request_(method, path, body, prefer) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('SUPABASE_URL');
  const key = props.getProperty('SUPABASE_SERVICE_KEY');
  if (!url || !key) throw new Error('スクリプト プロパティ SUPABASE_URL / SUPABASE_SERVICE_KEY を登録してください。');

  const res = UrlFetchApp.fetch(url + '/rest/v1/' + path, {
    method: method,
    contentType: 'application/json',
    headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: prefer },
    payload: body ? JSON.stringify(body) : null,
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Supabase エラー ' + code + ': ' + res.getContentText().slice(0, 300));
  }
  return res;
}

// ---------- 無料プランの一時停止を防ぐ（任意） ----------
// 「トリガー」で、週に1回この関数を実行するように設定すると、7日間アクセスがなくて止まるのを防げます。
function keepAlive() {
  request_('get', TABLE + '?select=code&limit=1', null, 'return=representation');
}
