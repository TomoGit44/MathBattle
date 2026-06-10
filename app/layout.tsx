import type { Metadata, Viewport } from 'next'
import './globals.css'
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'
import { SentryInit } from '@/components/analytics/SentryInit'
import { AdSenseScript } from '@/components/ads/AdSenseScript'
import { env } from '@/lib/env'

const TITLE = 'Math Battle | 数字を弾として撃ち合うオンライン対戦ゲーム'
const DESCRIPTION =
  '数字と演算子を組み合わせて弾を作り、相手のHPを0にしろ! ブラウザだけで遊べる、デッキ構築型2Dターン制オンライン対戦ゲーム。'

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'Math Battle',
    '数学ゲーム',
    'オンライン対戦',
    '数字',
    '対戦ゲーム',
    'ブラウザゲーム',
    '無料',
    'リアルタイム対戦',
  ],
  authors: [{ name: 'Math Battle' }],
  // OGP (Open Graph)
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: env.siteUrl,
    siteName: 'Math Battle',
    type: 'website',
    locale: 'ja_JP',
    // app/opengraph-image.tsx が自動で /opengraph-image を生成・登録する
  },
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    // app/twitter-image.tsx を作ると上書き可能。今は opengraph-image を共用。
  },
  // 各種ロボット
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  // PWAアイコン (将来用)
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#050714',
}

const Layout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <html lang="ja">
      <body className="bg-bg-deep text-text min-h-screen">
        {children}
        <GoogleAnalytics />
        <AdSenseScript />
        <SentryInit />
      </body>
    </html>
  )
}

export default Layout
