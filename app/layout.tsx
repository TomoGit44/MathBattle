import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Math Battle Online',
  description: '数字を弾として撃ち合う、デッキ構築型2Dターン制対戦ゲーム',
}

const Layout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <html lang="ja">
      <body className="bg-gray-900 text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}

export default Layout
