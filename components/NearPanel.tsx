'use client';

import { useEffect, useState } from 'react';
import { NEAR_MAX_KM, NEAR_MIN_KM } from '../lib/constants';
import type { NearSpec } from '../lib/types';
import '../app/near.css';

type CenterMode = 'gps' | 'map' | 'tap';

interface Props {
  open: boolean;
  near: NearSpec | null;                            // いま有効な半径検索
  busy: boolean;                                    // 現在地を取得しているところか
  message: string;                                  // 位置情報のエラーなどの案内
  onApply: (mode: CenterMode, km: number) => void;  // この条件で表示
  onClear: () => void;                              // 半径検索を解除
  onCopyLink: () => void;                           // 半径つきのリンクをコピー
  onClose: () => void;
}

// 入力された半径（km）を数にする。全角の数字や、末尾の「km」も受け付ける。正しくなければ null
export function parseKm(text: string): number | null {
  const t = text.normalize('NFKC').toLowerCase().replace(/km$/, '').replace(/,/g, '.').trim();
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const v = parseFloat(t);
  if (!isFinite(v) || v < NEAR_MIN_KM || v > NEAR_MAX_KM) return null;
  return Math.round(v * 100) / 100;
}

export default function NearPanel({ open, near, busy, message, onApply, onClear, onCopyLink, onClose }: Props) {
  const [mode, setMode] = useState<CenterMode>('gps');
  const [kmText, setKmText] = useState('5');
  const [localError, setLocalError] = useState('');

  // 半径検索が始まったら（共有リンクで開いたときなども）、入力欄を、その半径に合わせる
  useEffect(() => {
    if (near) setKmText(String(near.km));
  }, [near]);

  if (!open) return null;

  const apply = () => {
    const km = parseKm(kmText);
    if (km === null) {
      setLocalError(`半径は${NEAR_MIN_KM}〜${NEAR_MAX_KM}の数字（km）で入力してください`);
      return;
    }
    setLocalError('');
    onApply(mode, km);
  };

  return (
    <div className="near-panel" onClick={(e) => e.stopPropagation()}>
      <div className="near-title">
        <span>半径を指定して探す</span>
        <button className="near-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      <div className="near-row">
        <span className="near-label">中心</span>
        <label>
          <input type="radio" name="near-mode" checked={mode === 'gps'} onChange={() => setMode('gps')} />
          現在地
        </label>
        <label>
          <input type="radio" name="near-mode" checked={mode === 'map'} onChange={() => setMode('map')} />
          地図の中心
        </label>
        <label>
          <input type="radio" name="near-mode" checked={mode === 'tap'} onChange={() => setMode('tap')} />
          地図をタップ
        </label>
      </div>

      <div className="near-row">
        <span className="near-label">半径</span>
        <input
          className="near-km"
          type="text"
          inputMode="decimal"
          value={kmText}
          onChange={(e) => setKmText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
          }}
          aria-label="半径（km）"
        />
        <span>km</span>
      </div>

      {(localError || message) && <div className="near-error">{localError || message}</div>}

      <div className="near-buttons">
        <button className="near-btn near-btn-primary" onClick={apply} disabled={busy}>
          {busy ? '現在地を取得中…' : near ? 'この条件で更新' : 'この条件で表示'}
        </button>
        {near && (
          <button className="near-btn near-btn-secondary" onClick={onClear}>
            解除
          </button>
        )}
      </div>

      {near && (
        <div className="near-share">
          <button className="local-reset-btn" onClick={onCopyLink}>
            リンクをコピー
          </button>
          {near.source === 'gps' && (
            <p className="near-warn">
              このリンクには、中心の座標（約100m単位）が含まれます。現在地を中心にしたまま共有すると、おおよその居場所が相手に伝わります。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
