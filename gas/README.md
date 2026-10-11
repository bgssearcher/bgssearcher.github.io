# GAS（スプレッドシート → Supabase 同期）

`sheet_to_supabase.gs` は、スプレッドシートの Apps Script に貼り付けて使うスクリプトの控えです。
実際に動いているのは、Google 側の Apps Script です。**どちらかを直したら、もう一方も同じ内容にしてください。**

- 使い方は、ファイルの先頭のコメントを参照
- スクリプト プロパティ（`SUPABASE_URL` / `SUPABASE_SERVICE_KEY`）は、Google 側にだけ登録する。**このリポジトリには、書かない**
- `keepAlive` は、週1回のトリガーで動かす（無料プランの一時停止を防ぐ）
