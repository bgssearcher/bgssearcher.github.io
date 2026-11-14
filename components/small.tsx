'use client';

import { useEffect, useRef, useState } from 'react';

// 小さな部品をまとめたファイルです。大きくなったら1ファイル1部品に分けてもOKです。

export function Header({ onRandom }: { onRandom: () => void }) {
  return (
    <header className="custom-header">
      <div className="header-container">
        <h1 className="header-title">青看板検索ツール</h1>
        <nav className="header-nav">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onRandom();
            }}
          >
            ランダム表示
          </a>
          {/* about.html は public/ に置いたままなので普通のリンクにしています */}
          <a href="/about.html">about</a>
        </nav>
      </div>
    </header>
  );
}

// ×ボタン付きの入力欄。日本語入力の変換中の文字は、確定するまで外に伝えない
export function ClearableInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [text, setText] = useState(value);   // 入力欄に見せる文字（変換中の文字も含む）
  const composing = useRef(false);            // いま変換中か

  // 外から値が変わったとき（×で消す、URLから復元するなど）は、入力欄にも反映する
  useEffect(() => {
    if (!composing.current) setText(value);
  }, [value]);

  return (
    <div className="input-with-clear">
      <input
        type="text"
        id={id}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          if (!composing.current) onChange(e.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          onChange(e.currentTarget.value);
        }}
      />
      {text.length > 0 && (
        <span
          className="clear-input"
          style={{ display: 'block' }}
          onClick={() => {
            setText('');
            onChange('');
          }}
        >
          ×
        </span>
      )}
    </div>
  );
}

export function ImageViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  return (
    <div id="imageViewer" className={src ? 'show' : ''} onClick={onClose}>
      {src && <img id="viewerImage" src={src} alt="拡大画像" />}
    </div>
  );
}

export function Toast({ message, show }: { message: string; show: boolean }) {
  return <div className={'toast-notification' + (show ? ' show' : '')}>{message}</div>;
}
