'use client'

import { env, isEnabled } from '@/lib/env'
import { trackEvent } from '@/components/analytics/track'

/**
 * Buy Me a Coffee 支援ボタン。
 * NEXT_PUBLIC_BMC_URL 未設定なら何も表示しない。
 *
 * フッターやトップページ下部に置く前提。
 */
export const SupportButton = ({ className = '' }: { className?: string }) => {
  if (!isEnabled.bmc()) return null

  return (
    <a
      href={env.bmcUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent.supportClick('bmc')}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white text-sm font-bold shadow-lg transition-all hover:scale-105 ${className}`}
    >
      <span aria-hidden="true">☕</span>
      <span>開発を応援する</span>
    </a>
  )
}
