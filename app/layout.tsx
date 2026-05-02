import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Math Battle Online',
  description: '数字を弾として撃ち合う、デッキ構築型2Dターン制対戦ゲーム',
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
      </body>
    </html>
  )
}

export default Layout
