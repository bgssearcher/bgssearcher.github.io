'use client';

import { IMAGE_BASE } from '../lib/constants';
import type { Sign } from '../lib/types';

const PLACEHOLDER = 'https://placehold.co/120x120?text=No+Image';

interface Props {
  sign: Sign;
  active: boolean;
  onClick: () => void;
  onOpenImage: (src: string) => void;
  onCopyLink: (id: string) => void;
}

export default function DataCard({ sign, active, onClick, onOpenImage, onCopyLink }: Props) {
  const thumb = sign.hasImage ? `${IMAGE_BASE}/view/${sign.id}_view.jpg` : PLACEHOLDER;
  const full = sign.hasImage ? `${IMAGE_BASE}/folder/${sign.id}.jpg` : PLACEHOLDER;

  let title = sign.roadName || '名称未設定';
  if (sign.roadType !== '国道' && sign.nickname) title += `（${sign.nickname}）`;

  const formalName = sign.formalName ? sign.roadName + sign.formalName : sign.roadName || '-';

  return (
    <div
      id={'card-' + sign.id}
      className={'data-card' + (active ? ' active highlight' : '')}
      onClick={onClick}
    >
      <img
        className="card-img"
        src={thumb}
        alt=""
        onError={(e) => {
          e.currentTarget.src = 'https://placehold.co/120x120?text=Error';
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (sign.hasImage) onOpenImage(full);
        }}
      />
      <div className="card-info">
        <h3 className="card-name">{title}</h3>
        <p className="card-address">{sign.address || '住所未設定'}</p>

        {/* 詳細部分は active のときだけ CSS で表示される（元のまま） */}
        <div className="card-detail">
          <b>正式名称:</b> {formalName}
          <br />
          {sign.nickname && (
            <>
              <b>通称:</b> {sign.nickname}
              <br />
            </>
          )}
          <b>座標:</b> {sign.lat}, {sign.lng}
          <br />
          <b>地名:</b> {sign.place || '-'}
          <br />
          <b>撮影日:</b> {sign.shotDate || '-'}
          <br />
          <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
            <a
              href={`https://www.google.com/maps?q=${sign.lat},${sign.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#3498db', fontWeight: 'bold', textDecoration: 'underline' }}
            >
              Googleマップで開く
            </a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (sign.hasImage) onCopyLink(sign.id);
              }}
              style={{ color: '#3498db', fontWeight: 'bold', textDecoration: 'underline' }}
            >
              リンクをコピー
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
