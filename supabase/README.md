# Supabase の設定

| ファイル | 内容 |
|---|---|
| `setup.sql` | テーブル・索引・読み取り専用の設定・「まとまり」を数える関数。**何度実行してもデータは消えません** |

## いつ使うか
- Supabase のプロジェクトを**作り直したとき**に、SQL Editor へ貼り付けて、1回だけ Run する
- **データを更新するときには、使いません。** 更新は、スプレッドシートの「Supabase → 今すぐ同期」（`gas/sheet_to_supabase.gs`）だけです

## 作り直すときの順番
1. Supabase で新しいプロジェクトを作る（地域は東京）
2. SQL Editor に `setup.sql` を貼り付けて Run
3. GAS のスクリプト プロパティ `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` を新しい値に変える
4. スプレッドシートで「今すぐ同期」
5. `wrangler.json` の `vars`（`SUPABASE_URL` / `SUPABASE_ANON_KEY`）を新しい値に変えて、GitHub に送る

## 列を足したくなったら
`setup.sql` の `create table if not exists` は、すでにテーブルがあると、何もしません。列を足すときは、SQL Editor で `alter table public.signs add column ...` を実行し、そのあと `setup.sql` の定義にも同じ列を書き足してください。

## 注意
- `service_role` キーは、このリポジトリに書かない（GAS のスクリプト プロパティにだけ置く）
- `drop table` を実行すると、全データが消えます（消えても、同期し直せば戻ります）
