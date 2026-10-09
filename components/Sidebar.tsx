'use client';

import { useEffect, useRef } from 'react';
import type { Selection, Sign } from '../lib/types';
import { ClearableInput } from './small';
import DataCard from './DataCard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyword: string;
  onKeywordChange: (v: string) => void;
  onOpenAdvanced: () => void;
  loading: boolean;
  error: string;
  total: number;
  filtered: Sign[];
  visibleCount: number;
  onNeedMore: () => void;
  selection: Selection | null;
  onSelectCard: (id: string) => void;
  onOpenImage: (src: string) => void;
  onCopyLink: (id: string) => void;
}

export default function Sidebar(p: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<Selection | null>(null);
  const lockUntil = useRef(0); // 開閉の直後は、カードへの勝手なタップを無視するための時刻
  const drag = useRef({ startX: 0, startY: 0, startW: 0, startH: 0, startTx: 0, closedStart: false, dragging: false });

  // 選ばれたカードまでリストを自動スクロール（同じ選択では1回だけ）
  useEffect(() => {
    const sel = p.selection;
    if (!sel || scrolledFor.current === sel) return;
    if (!document.getElementById('card-' + sel.id)) return; // まだ描画されていない → visibleCount 増加後にもう一度
    scrolledFor.current = sel;
    const delay = sel.source === 'card' ? 0 : 350;
    const t = setTimeout(() => {
      document
        .getElementById('card-' + sel.id)
        ?.scrollIntoView({ behavior: 'smooth', block: sel.source === 'url' ? 'center' : 'nearest' });
    }, delay);
    return () => clearTimeout(t);
  }, [p.selection, p.visibleCount]);

  // ---- 開閉ボタン（クリックで開閉 / ドラッグで幅・高さ調整） ----
  const toggle = () => {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.transform = '';
    el.style.height = '';
    el.style.width = '';
    p.onOpenChange(!p.open);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = wrapperRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const d = drag.current;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.dragging = false;
    d.closedStart = !p.open;
    d.startW = el.offsetWidth;
    d.startH = el.offsetHeight;
    const m = el.style.transform.match(/translateX\(([-0-9.]+)px\)/);
    d.startTx = m ? parseFloat(m[1]) : d.closedStart ? -d.startW : 0;
    el.style.transition = 'none';
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const el = wrapperRef.current;
    if (!el) return;
    const d = drag.current;
    const dx = e.clientX - d.startX;
    const dy = d.startY - e.clientY;
    if (Math.hypot(dx, dy) <= 5) return;
    d.dragging = true;
    if (!p.open) p.onOpenChange(true);
    if (window.innerWidth <= 768) {
      const base = d.closedStart ? 0 : d.startH;
      const h = Math.min(Math.max(base + dy, 0), window.innerHeight * 0.85);
      el.style.height = `${h}px`;
    } else {
      const x = Math.min(Math.max(d.startTx + dx, -d.startW), 0);
      el.style.transform = `translateX(${x}px)`;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    lockUntil.current = Date.now() + 500;
    const el = wrapperRef.current;
    if (!el) return;
    el.style.transition = '';
    const d = drag.current;
    if (!d.dragging) {
      toggle();
      return;
    }
    d.dragging = false;
    // 離した位置で開く/閉じるを決める（元コードより少し親切にした部分）
    if (window.innerWidth <= 768) {
      if (el.offsetHeight < 60) {
        el.style.height = '';
        p.onOpenChange(false);
      }
    } else {
      const m = el.style.transform.match(/translateX\(([-0-9.]+)px\)/);
      const x = m ? parseFloat(m[1]) : 0;
      el.style.transform = '';
      p.onOpenChange(x > -d.startW * 0.5);
    }
  };

  const onListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget;
    if (t.scrollTop + t.clientHeight >= t.scrollHeight - 100) p.onNeedMore();
  };

  const visible = p.filtered.slice(0, p.visibleCount);

  return (
    <div ref={wrapperRef} id="sidebarWrapper" className={'sidebar-wrapper' + (p.open ? '' : ' closed')}>
      <div
        className="sidebar-main"
        onClickCapture={(e) => {
          if (Date.now() < lockUntil.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <div className="search-container">
          <div style={{ flex: 1 }}>
            <ClearableInput
              id="searchInput"
              value={p.keyword}
              onChange={p.onKeywordChange}
              placeholder="地名を入力…(複数入力可)"
            />
          </div>
          <button id="advancedSearchBtn" onClick={p.onOpenAdvanced}>
            <span style={{ fontSize: 15, fontWeight: 'bold' }}>詳細検索</span>
          </button>
        </div>

        <div className="result-count">
          {p.loading ? '読み込み中…' : (
            <>
              <b>{p.filtered.length}</b> / {p.total}件
            </>
          )}
        </div>

        <div className="list-container" id="listContainer" onScroll={onListScroll}>
          {p.loading && <div className="no-data">読み込み中…</div>}
          {p.error && (
            <div className="no-data" style={{ color: 'red' }}>
              エラー: {p.error}
            </div>
          )}
          {!p.loading && !p.error && p.filtered.length === 0 && (
            <div className="no-data">該当するデータがありません</div>
          )}
          {visible.map((sign) => (
            <DataCard
              key={sign.id}
              sign={sign}
              active={p.selection?.id === sign.id}
              onClick={() => p.onSelectCard(sign.id)}
              onOpenImage={p.onOpenImage}
              onCopyLink={p.onCopyLink}
            />
          ))}
        </div>
      </div>

      <div
        className="sidebar-toggle"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span id="toggleIcon">{p.open ? '◀' : '▶'}</span>
      </div>
    </div>
  );
}
