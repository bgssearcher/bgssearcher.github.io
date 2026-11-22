import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'about - 青看板検索ツール',
  alternates: { canonical: 'https://aokanban.com/about' },
};

export default function AboutPage() {
  return (
    <div className="about-page">
      <header className="custom-header">
        <div className="header-container">
          <h1 className="header-title">青看板検索ツール</h1>
          <nav className="header-nav">
            <a href="/">マップ検索</a>
            <a href="/about">about</a>
          </nav>
        </div>
      </header>

      <div className="about-main">
        <div className="about-container">
          <section className="about-section">
            <h2 className="section-title">サイトについて</h2>
            <p className="about-text">
              道路上にあるすべての青看板を網羅することを目指した個人サイトです。写真の撮影、記録等すべて作成者が行っています。
              <br />
              一部遮蔽物や画質不良等により視認性の低い画像があります。順次再撮影する予定ですのでご了承ください。
            </p>
            <p className="about-text">
              弊サイトのデータは良識の範囲内で、商用利用を除きご自由にご利用いただけます。画像含むデータを他サイト等でご利用・転載の場合は出典を併記するようお願いします😁
            </p>
            <details className="toggle-container">
              <summary className="toggle-title">当サイトにおける『青看板』の定義</summary>
              <div className="toggle-content">
                <p className="about-text">
                  当サイトで収録している『青看板』とは、一般に青地に白字であり、方面、方向及び距離のいずれか2つ以上が記載された一般道路上の案内標識を指します。国土交通省『道路標識一覧』（
                  <a
                    href="https://www.mlit.go.jp/road/sign/sign/douro/ichiran.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ wordBreak: 'break-all' }}
                  >
                    https://www.mlit.go.jp/road/sign/sign/douro/ichiran.pdf
                  </a>
                  、2026年8月28日最終閲覧）に記載のある道路標識のうち以下の通りです。
                  <br />
                  案内標識 (105-A)、(105-B)、(105-C)、(106-A)、(108-A)、(108-B)、(108の2-A)、(108の2-B)、(108の3)、(108の4) （以上、&lt;補足&gt;を含む）
                </p>
                <p className="about-text">
                  なお当サイトでは、(108-B)及び(108の2-B)に該当する青看板を『分割』と総称しています。また上記PDFにおける『警戒標識』『規制標識』の一部について、当サイトでの呼称は以下の通りです。これら呼称は今後予告なく変更する場合があります。
                  <br />
                  (303)：『侵入禁止』
                  <br />
                  (305)、(305の2)：『車種制限』
                  <br />
                  (207-B)、(311-A)：『他標識』
                  <br />
                  (321)：『車高制限』
                </p>
              </div>
            </details>
          </section>

          <section className="about-section">
            <h2 className="section-title">情報提供のお願い</h2>
            <p className="about-text">
              現在、国道及び都道府県道以外の道路上に存在する青看板について情報を募集しています。宜しければ以下のリンクより情報提供にご協力お願いします！（メールアドレス含め、個人情報は収集致しません）
            </p>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfbQGpQLgNM_qjYigVgRLOzeOp_y3UXZN7cTVc8cQpEMz4Rcg/viewform?usp=header"
              target="_blank"
              rel="noopener noreferrer"
            >
              青看板 情報提供フォーム
            </a>
          </section>

          <section className="about-section">
            <h2 className="section-title">作成者</h2>
            <h3 className="small-title">セッソー</h3>
            <p className="about-text">
              武蔵国出身。好きな駅は新横浜
              <br />
              現在Twitterはログアウトしています（27年3月頃復帰予定）
            </p>
            <a href="https://x.com/csjaQ248N" target="_blank" rel="noopener noreferrer">
              Twitter
            </a>
          </section>

          <section className="about-section">
            <h2 className="section-title">更新情報</h2>
            <div className="update-date">2026年08月26日</div>
            <p className="about-text">
              国道16号 金沢八景駅前-金沢文庫駅前、国道134号（一部）、国道467号 市役所前-片瀬東浜、横浜市主要地方道83号（一部）、横浜市道平潟第3号線
              <br />
              URLを変更
            </p>
            <div className="update-date">2026年08月24日</div>
            <p className="about-text">
              詳細検索&gt; 特徴に「修正跡」「ツートン」「角丸」「カーブ」「連名」「旧式」を追加
              <br />
              AND検索とOR検索を切り替えられるようにしました
              <br />
              路線の正式名称及び通称で検索できるようにしました
              <br />
              カードの詳細から該当する青看板の位置をGoogleマップで開けるようにしました
              <br />
              現在地をリアルタイムに表示できるようにしました
            </p>
            <div className="update-date">2026年08月18日</div>
            <p className="about-text">神奈川県道2号 大倉山-浦島丘</p>
            <div className="update-date">2026年07月12日</div>
            <p className="about-text">
              「詳細検索（β版）」機能を実装
            </p>
            <div className="update-date">2026年07月09日</div>
            <p className="about-text">
              神奈川県道2号 綱島-大倉山
              <br />
              ページ「about」を追加
            </p>
            <div className="update-date">2026年07月05日</div>
            <p className="about-text">GitHubに移行</p>
            <div className="update-date">2026年06月28日</div>
            <p className="about-text">Google Looker StudioからApps Scriptに移行</p>
            <div className="update-date">2026年06月21日</div>
            <p className="about-text">神奈川県道602号（全）</p>
            <div className="update-date">2026年06月19日</div>
            <p className="about-text">
              国道409号（一部）、東京都道・神奈川県道2号　中原口-日吉駅前、都道317号　大崎広小路-西五反田1丁目、大崎広小路-中原口、409号　西新橋第二-芝五丁目
            </p>
            <div className="update-date">2026年05月09日</div>
            <p className="about-text">国道1号　五反田駅西口周辺-千鳥一丁目、東京都道2号（一部）、318号（一部）、421号（一部）</p>
            <div className="update-date">2026年05月02日</div>
            <p className="about-text">神奈川県道12号　岸根-六角橋、13号（一部）、横浜市道環状2号　新横浜駅入口-岸根</p>
            <div className="update-date">2026年04月24日</div>
            <p className="about-text">国道1号　日本橋-五反田駅西口周辺、東京都道301号（一部）、304号（一部）、415号（一部）</p>
            <div className="update-date">2026年04月14日</div>
            <p className="about-text">神奈川県道2号　日吉駅前-綱島、102号（一部）</p>
            <div className="update-date">2026年04月06日</div>
            <p className="about-text">神奈川県道208号（一部）、209号　浦賀駅前-走水２丁目周辺、川崎市温泉通り（一部）</p>
          </section>

          <section className="about-section">
            <h2 className="section-title">収録</h2>
            <p className="about-text">
              全325枚
              <br />
              （）内の数字は収録数 未完了は薄字
            </p>

            <h3 className="small-title">国道</h3>
            <p className="about-text">国道133号（10）</p>
            <p className="unfinished-text">
              1号 3本橋-千鳥一丁目、浦島丘-青木橋（86）/15号 鶴見駅入口-神奈川二丁目（29）/16号 金沢八景駅前-金沢文庫駅前、桜木町一丁目-高島町 他（16）/24号（1）
              134号（3）/159号（1）/246号（1）/296号（1）/299号（2）/409号（1）/411号（2）/467号 市役所前-片瀬東浜（6）
            </p>
            <p className="unfinished-text">横浜新道（2）</p>

            <h3 className="small-title">埼玉県道</h3>
            <p className="unfinished-text">11号（1）</p>

            <h3 className="small-title">東京都道</h3>
            <p className="about-text">2号（22）</p>
            <p className="unfinished-text">
              5号（1）/11号 鵜の木駅前交番前-丸子橋（3）/301号（1）/304号（1）/317号 大崎広小路-西五反田1丁目、大崎広小路-中原口（6）/318号（1）/409号 西新橋第二-芝五丁目（10）/415号（1）/421号（1）
            </p>

            <h3 className="small-title">神奈川県道</h3>
            <p className="about-text">2号（40）/104号（1）/602号（2）</p>
            <p className="unfinished-text">
              6号（1）/12号 東神奈川駅前-岸根（14）/13号（2）/102号（3）/109号 青砥-110号交点（3）/139号（1）/140号 田奈駅前付近-堀の内（恩田地区）（4）/204号（1）/208号（1）/209号 横須賀市走水２丁目周辺-浦賀駅前（7）
            </p>

            <h3 className="small-title">山梨県道</h3>
            <p className="unfinished-text">31号（2）</p>

            <h3 className="small-title">岐阜県道</h3>
            <p className="unfinished-text">287号（1）</p>

            <h3 className="small-title">静岡県道</h3>
            <p className="unfinished-text">54号（1）</p>

            <h3 className="small-title">その他</h3>
            <p className="about-text">埼玉県吉見町（1）</p>
            <p className="about-text">東京都千代田区（1）/港区（1）/大田区（2）/渋谷区（1）</p>
            <p className="about-text">神奈川県横浜市（24）/川崎市（2）</p>
          </section>
        </div>
      </div>
    </div>
  );
}