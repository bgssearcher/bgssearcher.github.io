'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHUNK_SIZE, MIN_FETCH_ZOOM, SEARCH_LIMIT } from '../lib/constants';
import { fetchArea, fetchCluster, fetchNear, fetchOne, fetchRandom, fetchSearch, fetchTotal } from '../lib/api';
import { contains, gridSize, padBounds, roundCoord, snapOutward } from '../lib/geo';
import type { Bounds, ViewInfo } from '../lib/geo';
import { EMPTY_ADV, buildQueryString, hasFilter, parseUrl } from '../lib/signs';
import type { AdvFilters, ClusterCell, MapTarget, NearSpec, Selection, Sign, SignDetail } from '../lib/types';
import AdvancedSearchModal from './AdvancedSearchModal';
import MapView from './MapView';
import NearPanel from './NearPanel';
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
  const [near, setNear] = useState<NearSpec | null>(null);   // 半径検索の条件（中心と半径）
  const [nearNonce, setNearNonce] = useState(0);              // 変わるたびに、円が見えるよう地図を動かす
  const [toolOpen, setToolOpen] = useState(false);            // 半径パネルを開いているか
  const [pickMode, setPickMode] = useState(false);            // 地図をタップして、中心を決めているか
  const [nearBusy, setNearBusy] = useState(false);            // 現在地を取得しているところか
  const [nearMessage, setNearMessage] = useState('');         // パネルに出す案内（位置情報のエラーなど）
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
  // 結果が固定されるモード（キーワード・詳細検索、または半径検索）。地図を動かしても、範囲の取り直しはしない
  const listMode = searchMode || near !== null;

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialId = useRef<string | null>(null);
  const viewRef = useRef<ViewInfo | null>(null);
  const searchModeRef = useRef(false);
  searchModeRef.current = listMode;
  const pendingKm = useRef(5);                                   // 地図をタップで中心を決めるときの半径（km）
  const requestId = useRef(0);                                   // 古い応答を無視するための番号
  const lastFetch = useRef<{ kind: 'points' | 'clusters'; bbox: Bounds; zoom: number } | null>(null);

  // まとまり表示のあいだは、一覧に看板を出さない。共有リンク・ランダムの1件は、受け取った範囲に入っていなくても先頭に足す
  const displaySigns = useMemo(() => {
    if (!listMode && mode === 'clusters') return [];
    if (pinned) return [pinned, ...signs.filter((s) => s.id !== pinned.id)];
    return signs;
  }, [signs, pinned, listMode, mode]);

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
    if (url.near) {
      setNear(url.near);
      setNearNonce((n) => n + 1);
    }

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
    const qs = buildQueryString(q, adv, initialId.current, near);
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }, [q, adv, near, urlApplied]);

  // ---------- 4. 検索モード：条件に合う看板を、全国から取得 ----------
  useEffect(() => {
    if (!listMode) return;
    const id = ++requestId.current;
    lastFetch.current = null;
    setPhase('loading');
    (near ? fetchNear(near, q, adv) : fetchSearch(q, adv))
      .then((r) => {
        if (id !== requestId.current) return;
        setSigns(r.signs);
        setCells([]);
        setTruncated(r.truncated);
        setHits(r.hits);
        setError('');
        setPhase('ready');
        if (!near) setFitNonce((n) => n + 1); // 結果が見えるように、地図を動かす
      })
      .catch((e) => {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      });
  }, [listMode, near, q, adv]);

  // ---------- 5. 検索を解除したら、いま見ている範囲を取り直す ----------
  useEffect(() => {
    if (listMode) return;
    if (viewRef.current) loadArea(viewRef.current, true);
  }, [listMode, loadArea]);

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

  // When the search conditions change, release the pinned sign
  const condReady = useRef(false);
  useEffect(() => {
    if (!condReady.current) {
      condReady.current = true;
      return;
    }
    setPinned(null);
  }, [q, adv, near]);

  // ---------- 操作用の関数 ----------
  const selectCard = useCallback((id: string) => {
    setSelection((cur) => (cur?.id === id ? null : { id, source: 'card' }));
  }, []);

  const selectMarker = useCallback((id: string) => {
    setSidebarOpen(true);
    setSelection({ id, source: 'marker' });
  }, []);

  const showToast = useCallback((message: string, ms = 2000) => {
    setToast({ message, show: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), ms);
  }, []);

  const showRandom = useCallback(async () => {
    try {
      if (listMode) {
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
  }, [listMode, signs, showToast]);

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

  // ---------- 半径検索 ----------
  const startNear = useCallback((spec: NearSpec) => {
    setNear(spec);
    setNearNonce((n) => n + 1);
    setPickMode(false);
    setToolOpen(false);
    setNearMessage('');
    setSidebarOpen(true);
  }, []);

  const applyNear = useCallback(
    (mode: 'gps' | 'map' | 'tap', km: number) => {
      setNearMessage('');
      pendingKm.current = km;
      if (mode === 'tap') {
        setPickMode(true);
        setToolOpen(false);
        return;
      }
      setPickMode(false);
      if (mode === 'map') {
        const v = viewRef.current;
        if (!v) {
          setNearMessage('地図の準備ができていません。少し待ってもう一度お試しください');
          return;
        }
        startNear({
          lat: roundCoord((v.south + v.north) / 2),
          lng: roundCoord((v.west + v.east) / 2),
          km,
          source: 'map',
        });
        return;
      }
      if (!navigator.geolocation) {
        setNearMessage('この端末では位置情報を使えません');
        return;
      }
      setNearBusy(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setNearBusy(false);
          startNear({ lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude), km, source: 'gps' });
        },
        () => {
          setNearBusy(false);
          setNearMessage('位置情報を取得できませんでした。端末の設定とブラウザの許可を確認してください');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    },
    [startNear],
  );

  const pickCenter = useCallback(
    (lat: number, lng: number) => {
      startNear({ lat: roundCoord(lat), lng: roundCoord(lng), km: pendingKm.current, source: 'tap' });
    },
    [startNear],
  );

  const clearNear = useCallback(() => {
    setNear(null);
    setPickMode(false);
    setNearMessage('');
  }, []);

  const toggleTool = useCallback(() => {
    setPickMode(false);
    setToolOpen((o) => !o);
  }, []);

  // 今の検索条件（キーワード・詳細検索・半径検索）を、リンクにしてコピーする
  const copyConditionLink = useCallback(() => {
    if (!listMode) {
      showToast('検索条件を指定すると、そのリンクをコピーできます');
      return;
    }
    const qs = buildQueryString(q, adv, null, near);
    const url = window.location.origin + window.location.pathname + '?' + qs;
    // 現在地を中心にした半径検索のリンクには、おおよその居場所が含まれるので、コピーしたときに知らせる
    const gps = near?.source === 'gps';
    navigator.clipboard
      .writeText(url)
      .then(() =>
        showToast(
          gps
            ? 'リンクをコピーしました。現在地を中心にしているため、リンクにはおおよその居場所（約100m単位）が含まれます'
            : 'リンクをコピーしました',
          gps ? 5000 : 2000,
        ),
      )
      .catch((err) => {
        console.error('コピーに失敗しました:', err);
        showToast('コピーできませんでした');
      });
  }, [listMode, q, adv, near, showToast]);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => (c < displaySigns.length ? c + CHUNK_SIZE : c));
  }, [displaySigns.length]);

  // ---------- リストの上に出す文言 ----------
  const clusterView = !listMode && mode === 'clusters';

  let listMessage: { text: string; error?: boolean } | null = null;
  if (phase === 'error') listMessage = { text: 'エラー: ' + error, error: true };
  else if (clusterView && cells.length > 0)
    listMessage = {
      text: zoomOk
        ? 'この付近は件数が多いため、地図を拡大すると一覧に表示されます'
        : '数字をタップするか地図を拡大すると、その範囲の看板が一覧に表示されます',
    };
  else if (phase === 'loading' && displaySigns.length === 0) listMessage = { text: '読み込み中…' };
  else if (phase === 'ready' && displaySigns.length === 0)
    listMessage = { text: near ? '指定した範囲に該当する看板はありません' : searchMode ? '該当するデータがありません' : 'この範囲に看板はありません' };

  // 件数: 「いま表示している件数（検索のときは、ヒットした件数） / 全部の件数」
  const totalText = total !== null ? `件表示中 / 全${total}件` : '件表示中';
  const countLabel =
    clusterView && cells.length > 0 ? (
      'ズームして表示' + (total !== null ? ` / 全${total}件` : '')
    ) : phase === 'loading' && displaySigns.length === 0 ? (
      '読み込み中…'
    ) : (
      <>
        <b>{listMode ? hits : displaySigns.length}</b>
        {totalText}
      </>
    );

  const notice =
    listMode && truncated
      ? near
        ? `件数が多いため、近い順に先頭の${SEARCH_LIMIT}件のみ表示しています。半径を小さくするか、条件を絞ってください。`
        : `件数が多いため、先頭の${SEARCH_LIMIT}件のみ表示しています。条件を絞ってください。`
      : null;

  return (
    <>
      <Header onRandom={showRandom} />

      <div className="main-content">
        <div className="content-wrapper">
          <MapView
            data={displaySigns}
            cells={listMode ? [] : cells}
            selection={selection}
            sidebarOpen={sidebarOpen}
            onMarkerClick={selectMarker}
            onViewChange={handleViewChange}
            fitNonce={fitNonce}
            target={target}
            near={near}
            nearNonce={nearNonce}
            pickMode={pickMode}
            onPick={pickCenter}
            onToggleTool={toggleTool}
            toolActive={toolOpen}
            onCopyLink={copyConditionLink}
            linkReady={listMode}
          />
          <NearPanel
            open={toolOpen}
            near={near}
            busy={nearBusy}
            message={nearMessage}
            onApply={applyNear}
            onClear={clearNear}
            onClose={() => setToolOpen(false)}
          />
          {pickMode && <div className="zoom-hint">地図をタップして中心を指定してください</div>}
          {clusterView && !pickMode && cells.length > 0 && (
            <div className="zoom-hint">数字をタップするか拡大すると、看板が1件ずつ表示されます</div>
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
            adv={adv}
            onAdvChange={setAdv}
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
