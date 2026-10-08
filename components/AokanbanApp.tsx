'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHUNK_SIZE } from '../lib/constants';
import { EMPTY_ADV, buildQueryString, filterSigns, loadSigns, parseUrl } from '../lib/signs';
import type { AdvFilters, Selection, Sign } from '../lib/types';
import AdvancedSearchModal from './AdvancedSearchModal';
import MapView from './MapView';
import Sidebar from './Sidebar';
import { Header, ImageViewer, Toast } from './small';

export default function AokanbanApp() {
  // ---------- 状態（stateの一覧。元コードのグローバル変数に相当） ----------
  const [allData, setAllData] = useState<Sign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [keywordInput, setKeywordInput] = useState(''); // 入力欄の文字（即時）
  const [q, setQ] = useState('');                      // 検索に使う文字（300ms遅らせて反映）
  const [adv, setAdv] = useState<AdvFilters>(EMPTY_ADV);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [toast, setToast] = useState({ message: '', show: false });

  const urlReady = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialId = useRef<string | null>(null);

  // ---------- 絞り込み結果（q / adv / allData が変わったときだけ再計算） ----------
  const filtered = useMemo(() => filterSigns(allData, q, adv), [allData, q, adv]);

  // ---------- 1. 最初にデータを読み込み、URLの条件を復元 ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const signs = await loadSigns();
        if (cancelled) return;
        const url = parseUrl(window.location.search);
        initialId.current = url.id;
        setKeywordInput(url.q);
        setQ(url.q);
        setAdv(url.adv);
        setAllData(signs);
        if (url.id) setSelection({ id: url.id, source: 'url' });
        urlReady.current = true;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- 2. 入力欄の文字を 300ms 待ってから検索に反映 ----------
  useEffect(() => {
    const t = setTimeout(() => setQ(keywordInput), 300);
    return () => clearTimeout(t);
  }, [keywordInput]);

  // ---------- 3. 条件が変わったらURLを更新（ページ遷移なし） ----------
  useEffect(() => {
    if (!urlReady.current) return;
    const qs = buildQueryString(q, adv, initialId.current);
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }, [q, adv]);

  // ---------- 4. 条件が変わったらリストを先頭30件に戻す ----------
  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [q, adv, allData]);

  // ---------- 5. 選ばれた看板がリストの何番目でも、そこまで描画しておく ----------
  useEffect(() => {
    if (!selection) return;
    const index = filtered.findIndex((s) => s.id === selection.id);
    if (index >= 0) {
      setVisibleCount((c) => (index < c ? c : Math.ceil((index + 1) / CHUNK_SIZE) * CHUNK_SIZE));
    }
  }, [selection, filtered]);

  // ---------- 操作用の関数 ----------
  const selectCard = useCallback((id: string) => {
    setSelection((cur) => (cur?.id === id ? null : { id, source: 'card' }));
  }, []);

  const selectMarker = useCallback((id: string) => {
    setSidebarOpen(true);
    setSelection({ id, source: 'marker' });
  }, []);

  const showRandom = useCallback(() => {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    setSidebarOpen(true);
    setSelection({ id: pick.id, source: 'random' });
  }, [filtered]);

  const showToast = useCallback((message: string) => {
    setToast({ message, show: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 2000);
  }, []);

  const copyPermalink = useCallback(
    (id: string) => {
      const url = window.location.origin + window.location.pathname + '?id=' + id;
      navigator.clipboard
        .writeText(url)
        .then(() => showToast('リンクをコピーしました'))
        .catch((err) => console.error('コピーに失敗しました:', err));
    },
    [showToast],
  );

  const loadMore = useCallback(() => {
    setVisibleCount((c) => (c < filtered.length ? c + CHUNK_SIZE : c));
  }, [filtered.length]);

  return (
    <>
      <Header onRandom={showRandom} />

      <div className="main-content">
        <div className="content-wrapper">
          <MapView data={filtered} selection={selection} sidebarOpen={sidebarOpen} onMarkerClick={selectMarker} />
          <Sidebar
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            keyword={keywordInput}
            onKeywordChange={(v) => {
              setKeywordInput(v);
              if (v === '') setQ(''); // ×ボタンで消したときは待たずに即反映
            }}
            onOpenAdvanced={() => setModalOpen(true)}
            loading={loading}
            error={error}
            total={allData.length}
            filtered={filtered}
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
