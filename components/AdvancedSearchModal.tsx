'use client';

import { useEffect, useRef, useState } from 'react';
import { AVAILABLE_PREFS, AVAILABLE_REGIONS, FEATURE_GROUPS, REGION_MAP } from '../lib/constants';
import { EMPTY_ADV } from '../lib/signs';
import type { AdvFilters } from '../lib/types';
import { ClearableInput } from './small';
import { HELP } from '../lib/help';

interface Props {
  open: boolean;
  applied: AdvFilters;                 // いま適用されている条件
  onApply: (adv: AdvFilters) => void;  // 「適用」ボタン
  onClear: () => void;                 // 「条件をクリア」ボタン
  onClose: () => void;
}

function HelpLabel({ id, label, open, onToggle }: { id: string; label: string; open: boolean; onToggle: (id: string) => void }) {
  return (
    <div className="label-row">
      <label>{label}</label>
      <button
        type="button"
        className="help-btn"
        aria-label={`${label}の説明`}
        aria-expanded={open}
        aria-controls={`help-${id}`}
        onClick={() => onToggle(id)}
      >
        <svg viewBox="0 -960 960 960" width="24" height="24" fill="currentColor" aria-hidden="true">
          <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
        </svg>
      </button>
    </div>
  );
}

function HelpBox({ id, open }: { id: string; open: boolean }) {
  const h = HELP[id];
  if (!open || !h) return null;
  return (
    <div className="help-box" id={`help-${id}`}>
      <div>{h.text}</div>
      {(h.imgs ?? []).map((src) => (
        <img
          key={src}
          src={`/img/help/${src}`}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ))}
    </div>
  );
}

export default function AdvancedSearchModal({ open, applied, onApply, onClear, onClose }: Props) {
  // ダイアログの中で編集中の値（「適用」を押すまで検索には反映されない）
  const [draft, setDraft] = useState<AdvFilters>(applied);
  const [prefOpen, setPrefOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState<Record<string, boolean>>({});
  const toggleHelp = (id: string) => setHelpOpen((o) => ({ ...o, [id]: !o[id] }));
  const prefRef = useRef<HTMLDivElement>(null);

  // 開くたびに、適用中の条件で編集欄を初期化
  useEffect(() => {
    if (open) {
      setDraft(applied);
      setHelpOpen({});
    }
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
                <HelpLabel id="cross" label="交差路線" open={!!helpOpen.cross} onToggle={toggleHelp} />
                <HelpBox id="cross" open={!!helpOpen.cross} />
                <ClearableInput value={draft.cross} onChange={(v) => set('cross', v)} placeholder="例：国道1号 / 日比谷通り / 環状七号線" />
              </div>
              <div className="form-group">
                <HelpLabel id="hwy" label="高速道路案内" open={!!helpOpen.hwy} onToggle={toggleHelp} />
                <HelpBox id="hwy" open={!!helpOpen.hwy} />
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
