import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

const GA_ID = 'G-XSMRR0WZ2R';

export const metadata: Metadata = {
  title: '青看板検索ツール',
  description: '日本全国の青看板を地名や道路種別（国道・県道）、形状、住所、交差路線、地図から検索できるツールです。',
  metadataBase: new URL('https://aokanban.com'),
  alternates: { canonical: 'https://aokanban.com' },
  referrer: 'no-referrer',
  verification: { google: 'Q55XdGfgCRa8f_CpTHVnWHHRnz0POVzW-UhfwbEUPR0' },
  openGraph: { siteName: '青看板検索ツール' },
  icons: { icon: '/img/favicon.ico', apple: '/img/favicon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111111',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: '青看板検索ツール',
  url: 'https://aokanban.com',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://cyberjapandata.gsi.go.jp" />
        <link rel="preconnect" href="https://sesso-richu.github.io" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        {children}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
