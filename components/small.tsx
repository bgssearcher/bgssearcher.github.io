'use client';

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

// ×ボタン付きの入力欄（元の toggleClearButton / clearInput の代わり）
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
  return (
    <div className="input-with-clear">
      <input
        type="text"
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.length > 0 && (
        <span className="clear-input" style={{ display: 'block' }} onClick={() => onChange('')}>
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
