'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHUNK_SIZE, MIN_FETCH_ZOOM, SEARCH_LIMIT } from '../lib/constants';
import { fetchArea, fetchCluster, fetchOne, fetchRandom, fetchSearch, fetchTotal } from '../lib/api';
import { contains, gridSize, padBounds, snapOutward } from '../lib/geo';
import type { Bounds, ViewInfo } from '../lib/geo';
import { EMPTY_ADV, buildQueryString, hasFilter, parseUrl } from '../lib/signs';
import type { AdvFilters, ClusterCell, MapTarget, Selection, Sign, SignDetail } from '../lib/types';
import AdvancedSearchModal from './AdvancedSearchModal';
import MapView from './MapView';
import Sidebar from './Sidebar';
import { Header, ImageViewer, Toast } from './small';

type Phase = 'loading' | 'ready' | 'error';

export default function AokanbanApp() {
  // ---------- 状態（stateの一覧） ----------
  const [signs, setSigns] = useState<Sign[]>([]);          // いま地図とリストに出している看板
  const [truncated, setTruncated] = useState(false);       // （検索）件数が多くて、一部しか受け取れていないか
  const [hits, setHits] = useState(0);                    // （検索）条件に合う件数
  const [total, setTotal] = useState<number | null>(null); // 全部で何件あるか
  const [cells, setCells] = useState<ClusterCell[]>([]);   // 引いた地図に出す「まとまり」
  const [mode, setMode] = useState<'points' | 'clusters'>('points'); // 看板を1件ずつ出すか、まとまりで出すか
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [zoomOk, setZoomOk] = useState(true);              // 取得できるズームか（初期位置はちょうど境目）
  const [pinned, setPinned] = useState<Sign | null>(null); // 共有リンク・ランダムで指定された1件（必ず表示する）
  const [details, setDetails] = useState<Record<string, SignDetail>>({}); // 開いたカードの詳細
  const [target, setTarget] = useState<MapTarget | null>(null);           // 地図を動かす依頼
  const [fitNonce, setFitNonce] = useState(0);             // 検索結果に合わせて地図を動かす合図

  const [keywordInput, setKeywordInput] = useState(''); // 入力欄の文字（即時）
  const [q, setQ] = useState('');                      // 検索に使う文字（300ms遅らせて反映）
  const [adv, setAdv] = useState<AdvFilters>(EMPTY_ADV);
  const [urlApplied, setUrlApplied] = useState(false);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [toast, setToast] = useState({ message: '', show: false });

  const searchMode = useMemo(() => hasFilter(q, adv), [q, adv]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialId = useRef<string | null>(null);
  const viewRef = useRef<ViewInfo | null>(null);
  const searchModeRef = useRef(false);
  searchModeRef.current = searchMode;
  const requestId = useRef(0);                                   // 古い応答を無視するための番号
  const lastFetch = useRef<{ kind: 'points' | 'clusters'; bbox: Bounds; zoom: number } | null>(null);

  // まとまり表示のあいだは、一覧に看板を出さない。共有リンク・ランダムの1件は、受け取った範囲に入っていなくても先頭に足す
  const displaySigns = useMemo(() => {
    if (!searchMode && mode === 'clusters') return [];
    if (pinned && !signs.some((s) => s.id === pinned.id)) return [pinned, ...signs];
    return signs;
  }, [signs, pinned, searchMode, mode]);

  // ---------- 地図の範囲で取得 ----------
  // ・ズームが境目以上 … 看板を1件ずつ取得。件数が多すぎるときは、まとまり（数字つきの丸）に切り替える
  // ・ズームが境目より小さい … まとまり（数字つきの丸）を取得
  const loadArea = useCallback(async (view: ViewInfo, force = false) => {
    const lowZoom = view.zoom < MIN_FETCH_ZOOM;
    const need: Bounds = { south: view.south, west: view.west, north: view.north, east: view.east };
    const last = lastFetch.current;

    // すでに取得した範囲の中を見ているだけなら、取り直さない
    if (!force && last && contains(last.bbox, need)) {
      if (last.kind === 'clusters' && last.zoom === view.zoom) return;
      if (last.kind === 'points' && !lowZoom) return;
    }

    const id = ++requestId.current;
    setPhase('loading');
    try {
      if (!lowZoom) {
        const bbox = snapOutward(padBounds(need), gridSize(view.zoom));
        const r = await fetchArea(bbox);
        if (id !== requestId.current) return;
        if (!r.truncated) {
          setSigns(r.signs);
          setCells([]);
          setMode('points');
          lastFetch.current = { kind: 'points', bbox, zoom: view.zoom };
          setError('');
          setPhase('ready');
          return;
        }
        // 件数が多すぎる → まとまり表示へ
      }
      const c = await fetchCluster(padBounds(need), view.zoom);
      if (id !== requestId.current) return;
      setSigns([]);
      setCells(c.cells);
      setMode('clusters');
      lastFetch.current = { kind: 'clusters', bbox: c.bbox, zoom: view.zoom };
      setError('');
      setPhase('ready');
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }, []);

  // 地図が動き終わるたびに呼ばれる
  const handleViewChange = useCallback(
    (v: ViewInfo) => {
      viewRef.current = v;
      setZoomOk(v.zoom >= MIN_FETCH_ZOOM);
      if (searchModeRef.current) return; // 検索中は、地図の動きでは取得しない
      if (viewTimer.current) clearTimeout(viewTimer.current);
      viewTimer.current = setTimeout(() => loadArea(v), 250);
    },
    [loadArea],
  );

  // ---------- 1. 最初に、URLの条件と共有リンクの看板を復元 ----------
  useEffect(() => {
    const url = parseUrl(window.location.search);
    initialId.current = url.id;
    setKeywordInput(url.q);
    setQ(url.q);
    setAdv(url.adv);
    setUrlApplied(true);

    fetchTotal()
      .then(setTotal)
      .catch(() => {
        /* 全体の件数が取れなくても、表示には影響しない */
      });

    if (url.id) {
      fetchOne({ img: url.id })
        .then((r) => {
          if (!r) return;
          setDetails((m) => ({ ...m, [r.sign.id]: r.detail }));
          setPinned(r.sign);
          setTarget({ lat: r.sign.lat, lng: r.sign.lng, zoom: 16, nonce: Date.now() });
          setSelection({ id: r.sign.id, source: 'url' });
        })
        .catch(() => {
          /* 共有リンクの看板が見つからなくても、通常どおり使えるようにする */
        });
    }
    return () => {
      if (viewTimer.current) clearTimeout(viewTimer.current);
    };
  }, []);

  // ---------- 2. 入力欄の文字を 300ms 待ってから検索に反映 ----------
  useEffect(() => {
    const t = setTimeout(() => setQ(keywordInput), 300);
    return () => clearTimeout(t);
  }, [keywordInput]);

  // ---------- 3. 条件が変わったらURLを更新（ページ遷移なし） ----------
  useEffect(() => {
    if (!urlApplied) return;
    const qs = buildQueryString(q, adv, initialId.current);
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }, [q, adv, urlApplied]);

  // ---------- 4. 検索モード：条件に合う看板を、全国から取得 ----------
  useEffect(() => {
    if (!searchMode) return;
    const id = ++requestId.current;
    lastFetch.current = null;
    setPhase('loading');
    fetchSearch(q, adv)
      .then((r) => {
        if (id !== requestId.current) return;
        setSigns(r.signs);
        setCells([]);
        setTruncated(r.truncated);
        setHits(r.hits);
        setError('');
        setPhase('ready');
        setFitNonce((n) => n + 1); // 結果が見えるように、地図を動かす
      })
      .catch((e) => {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      });
  }, [searchMode, q, adv]);

  // ---------- 5. 検索を解除したら、いま見ている範囲を取り直す ----------
  useEffect(() => {
    if (searchMode) return;
    if (viewRef.current) loadArea(viewRef.current, true);
  }, [searchMode, loadArea]);

  // ---------- 6. リストを先頭30件に戻す ----------
  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [displaySigns]);

  // ---------- 7. 選ばれた看板がリストの何番目でも、そこまで描画しておく ----------
  useEffect(() => {
    if (!selection) return;
    const index = displaySigns.findIndex((s) => s.id === selection.id);
    if (index >= 0) {
      setVisibleCount((c) => (index < c ? c : Math.ceil((index + 1) / CHUNK_SIZE) * CHUNK_SIZE));
    }
  }, [selection, displaySigns]);

  // ---------- 8. 選ばれた看板の詳細を、まだ持っていなければ取りに行く ----------
  useEffect(() => {
    const id = selection?.id;
    if (!id || details[id]) return;
    let cancelled = false;
    fetchOne({ code: id })
      .then((r) => {
        if (!cancelled && r) setDetails((m) => ({ ...m, [id]: r.detail }));
      })
      .catch(() => {
        /* 詳細が取れなくても、カードの基本表示は使える */
      });
    return () => {
      cancelled = true;
    };
  }, [selection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- 9. 別の看板を選んだら、共有リンク・ランダムの特別扱いをやめる ----------
  useEffect(() => {
    if (pinned && selection?.id !== pinned.id) setPinned(null);
  }, [selection, pinned]);

  // ---------- 操作用の関数 ----------
  const selectCard = useCallback((id: string) => {
    setSelection((cur) => (cur?.id === id ? null : { id, source: 'card' }));
  }, []);

  const selectMarker = useCallback((id: string) => {
    setSidebarOpen(true);
    setSelection({ id, source: 'marker' });
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ message, show: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 2000);
  }, []);

  const showRandom = useCallback(async () => {
    try {
      if (searchMode) {
        // 検索中は、いま出ている結果の中から選ぶ
        if (signs.length === 0) return;
        const pick = signs[Math.floor(Math.random() * signs.length)];
        setSidebarOpen(true);
        setTarget({ lat: pick.lat, lng: pick.lng, zoom: 16, nonce: Date.now() });
        setSelection({ id: pick.id, source: 'random' });
        return;
      }
      const r = await fetchRandom();
      if (!r) return;
      setDetails((m) => ({ ...m, [r.sign.id]: r.detail }));
      setPinned(r.sign);
      setSidebarOpen(true);
      setTarget({ lat: r.sign.lat, lng: r.sign.lng, zoom: 16, nonce: Date.now() });
      setSelection({ id: r.sign.id, source: 'random' });
    } catch {
      showToast('取得に失敗しました。時間をおいて、もう一度お試しください');
    }
  }, [searchMode, signs, showToast]);

  const copyPermalink = useCallback(
    (imgCode: string) => {
      const url = window.location.origin + window.location.pathname + '?id=' + imgCode;
      navigator.clipboard
        .writeText(url)
        .then(() => showToast('リンクをコピーしました'))
        .catch((err) => console.error('コピーに失敗しました:', err));
    },
    [showToast],
  );

  const loadMore = useCallback(() => {
    setVisibleCount((c) => (c < displaySigns.length ? c + CHUNK_SIZE : c));
  }, [displaySigns.length]);

  // ---------- リストの上に出す文言 ----------
  const clusterView = !searchMode && mode === 'clusters';

  let listMessage: { text: string; error?: boolean } | null = null;
  if (phase === 'error') listMessage = { text: 'エラー: ' + error, error: true };
  else if (clusterView && cells.length > 0)
    listMessage = {
      text: zoomOk
        ? 'この付近は件数が多いため、地図を拡大すると、一覧に表示されます'
        : '数字をタップするか、地図を拡大すると、その範囲の看板が一覧に表示されます',
    };
  else if (phase === 'loading' && displaySigns.length === 0) listMessage = { text: '読み込み中…' };
  else if (phase === 'ready' && displaySigns.length === 0)
    listMessage = { text: searchMode ? '該当するデータがありません' : 'この範囲に看板はありません' };

  // 件数: 「いま表示している件数（検索のときは、ヒットした件数） / 全部の件数」
  const totalText = total !== null ? ` / ${total}件` : '件';
  const countLabel =
    clusterView && cells.length > 0 ? (
      'ズームして表示' + (total !== null ? ` / 全${total}件` : '')
    ) : phase === 'loading' && displaySigns.length === 0 ? (
      '読み込み中…'
    ) : (
      <>
        <b>{searchMode ? hits : displaySigns.length}</b>
        {totalText}
      </>
    );

  const notice =
    searchMode && truncated ? `件数が多いため、先頭の${SEARCH_LIMIT}件のみ表示しています。条件を絞ってください。` : null;

  return (
    <>
      <Header onRandom={showRandom} />

      <div className="main-content">
        <div className="content-wrapper">
          <MapView
            data={displaySigns}
            cells={searchMode ? [] : cells}
            selection={selection}
            sidebarOpen={sidebarOpen}
            onMarkerClick={selectMarker}
            onViewChange={handleViewChange}
            fitNonce={fitNonce}
            target={target}
          />
          {clusterView && cells.length > 0 && (
            <div className="zoom-hint">数字をタップするか、拡大すると、看板が1件ずつ表示されます</div>
          )}
          <Sidebar
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            keyword={keywordInput}
            onKeywordChange={(v) => {
              setKeywordInput(v);
              if (v === '') setQ(''); // ×ボタンで消したときは待たずに即反映
            }}
            onOpenAdvanced={() => setModalOpen(true)}
            signs={displaySigns}
            details={details}
            countLabel={countLabel}
            listMessage={listMessage}
            notice={notice}
            visibleCount={visibleCount}
            onNeedMore={loadMore}
            selection={selection}
            onSelectCard={selectCard}
            onOpenImage={setViewerSrc}
            onCopyLink={copyPermalink}
          />
        </div>
      </div>

      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />

      <AdvancedSearchModal
        open={modalOpen}
        applied={adv}
        onApply={(next) => {
          setAdv(next);
          setModalOpen(false);
        }}
        onClear={() => setAdv(EMPTY_ADV)}
        onClose={() => setModalOpen(false)}
      />

      <Toast message={toast.message} show={toast.show} />
    </>
  );
}
