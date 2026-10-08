'use client';

import { useEffect, useRef, useState } from 'react';
import { AVAILABLE_PREFS, AVAILABLE_REGIONS, FEATURE_GROUPS, REGION_MAP } from '../lib/constants';
import { EMPTY_ADV } from '../lib/signs';
import type { AdvFilters } from '../lib/types';
import { ClearableInput } from './small';

interface Props {
  open: boolean;
  applied: AdvFilters;                 // いま適用されている条件
  onApply: (adv: AdvFilters) => void;  // 「適用」ボタン
  onClear: () => void;                 // 「条件をクリア」ボタン
  onClose: () => void;
}

export default function AdvancedSearchModal({ open, applied, onApply, onClear, onClose }: Props) {
  // ダイアログの中で編集中の値（「適用」を押すまで検索には反映されない）
  const [draft, setDraft] = useState<AdvFilters>(applied);
  const [prefOpen, setPrefOpen] = useState(false);
  const prefRef = useRef<HTMLDivElement>(null);

  // 開くたびに、適用中の条件で編集欄を初期化
  useEffect(() => {
    if (open) setDraft(applied);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 都道府県パネルの外をクリックしたら閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (prefRef.current && !prefRef.current.contains(e.target as Node)) setPrefOpen(false);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  const set = <K extends keyof AdvFilters>(key: K, value: AdvFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const togglePref = (pref: string) =>
    set('prefs', draft.prefs.includes(pref) ? draft.prefs.filter((p) => p !== pref) : [...draft.prefs, pref]);

  const regionPrefs = (region: string) => (REGION_MAP[region] ?? []).filter((p) => AVAILABLE_PREFS.includes(p));
  const isRegionChecked = (region: string) => {
    const ps = regionPrefs(region);
    return ps.length > 0 && ps.every((p) => draft.prefs.includes(p));
  };
  const toggleRegion = (region: string) => {
    const ps = regionPrefs(region);
    if (isRegionChecked(region)) set('prefs', draft.prefs.filter((p) => !ps.includes(p)));
    else set('prefs', Array.from(new Set([...draft.prefs, ...ps])));
  };

  const toggleFeat = (value: string) =>
    set('feats', draft.feats.includes(value) ? draft.feats.filter((f) => f !== value) : [...draft.feats, value]);

  const prefLabel =
    draft.prefs.length === 0 ? 'すべて' : draft.prefs.length === 1 ? draft.prefs[0] : `${draft.prefs.length}都道府県を選択中`;

  return (
    <div
      className={'modal-overlay' + (open ? ' show' : '')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 20, color: '#2c3e50' }}>詳細検索</h2>
          <span className="modal-close" onClick={onClose}>
            ×
          </span>
        </div>

        <div className="modal-body">
          <div className="modal-body-container">
            {/* ---------- 左列 ---------- */}
            <div className="modal-col-left">
              <div className="form-row-2col">
                <div className="form-group" style={{ position: 'relative' }} ref={prefRef}>
                  <label>都道府県</label>
                  <div className="pref-dropdown-trigger" onClick={() => setPrefOpen((v) => !v)}>
                    <span>{prefLabel}</span>
                    <span className="dropdown-icon">▼</span>
                  </div>
                  <div className={'pref-dropdown-panel' + (prefOpen ? ' show' : '')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div className="feature-section-title" style={{ margin: 0 }}>
                        《一括選択》
                      </div>
                      <button type="button" className="local-reset-btn" onClick={() => set('prefs', [])}>
                        リセット
                      </button>
                    </div>
                    <div className="pref-checkbox-grid">
                      {AVAILABLE_REGIONS.map((r) => (
                        <label key={r} className="pref-checkbox-label">
                          <input type="checkbox" checked={isRegionChecked(r)} onChange={() => toggleRegion(r)} /> {r}
                        </label>
                      ))}
                    </div>
                    <hr style={{ border: 0, borderTop: '1px solid #ddd', margin: '10px 0' }} />
                    <label className="pref-checkbox-label" style={{ color: '#3498db' }}>
                      <input
                        type="checkbox"
                        checked={draft.prefs.length === 0}
                        onChange={() => set('prefs', [])}
                      />{' '}
                      すべて
                    </label>
                    <div className="pref-checkbox-grid">
                      {AVAILABLE_PREFS.map((pref) => (
                        <label key={pref} className="pref-checkbox-label">
                          <input type="checkbox" checked={draft.prefs.includes(pref)} onChange={() => togglePref(pref)} /> {pref}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>道路種別</label>
                  <select value={draft.roadType} onChange={(e) => set('roadType', e.target.value)}>
                    <option value="">すべて</option>
                    <option value="国道">国道</option>
                    <option value="県道">都道府県道</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>路線名</label>
                <ClearableInput value={draft.road} onChange={(v) => set('road', v)} placeholder="例：1 / 神奈川県道2号 / 綱島街道" />
              </div>
              <div className="form-group">
                <label>所在地</label>
                <ClearableInput value={draft.addr} onChange={(v) => set('addr', v)} placeholder="住所の一部か全部を入力" />
              </div>
              <div className="form-group">
                <label>交差路線</label>
                <ClearableInput value={draft.cross} onChange={(v) => set('cross', v)} placeholder="例：国道1号 / 日比谷通り / 環状七号線" />
              </div>
              <div className="form-group">
                <label>高速道路案内</label>
                <ClearableInput value={draft.hwy} onChange={(v) => set('hwy', v)} placeholder="例：E1 / 東名 / 稲荷山トンネル / ETC" />
              </div>
            </div>

            {/* ---------- 右列：特徴 ---------- */}
            <div className="modal-col-right">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ marginBottom: 5 }}>特徴</label>
                {FEATURE_GROUPS.map((group) => (
                  <div key={group.title}>
                    <div className="feature-section-title">{group.title}</div>
                    <div className="checkbox-grid">
                      {group.items.map((f) => {
                        const checked = draft.feats.includes(f.value);
                        return (
                          <div className="feature-card" key={f.value}>
                            <input type="checkbox" checked={checked} onChange={() => toggleFeat(f.value)} />
                            <div className={'card-content' + (checked ? ' is-active' : '')}>
                              <img
                                src={`/img/${f.img}`}
                                alt=""
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <span>{f.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
            {(['AND', 'OR'] as const).map((m) => (
              <label
                key={m}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 'bold', color: '#2c3e50' }}
              >
                <input
                  type="radio"
                  name="searchMode"
                  checked={draft.mode === m}
                  onChange={() => set('mode', m)}
                  style={{ width: 16, height: 16 }}
                />
                {m === 'AND' ? 'すべて含む (AND)' : 'いずれかを含む (OR)'}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="clear-btn"
              onClick={() => {
                setDraft(EMPTY_ADV);
                onClear();
              }}
            >
              条件をクリア
            </button>
            <button className="apply-btn" onClick={() => onApply(draft)}>
              適用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
