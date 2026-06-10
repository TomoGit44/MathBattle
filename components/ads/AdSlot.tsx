'use client'

import { useEffect, useRef } from 'react'
import { env, isEnabled } from '@/lib/env'

type SlotName = 'lobby' | 'waiting' | 'result'

interface AdSlotProps {
  slot: SlotName
  /** 表示形式。"auto"でレスポンシブ、"horizontal"で横長バナー */
  format?: 'auto' | 'horizontal' | 'rectangle'
  className?: string
  /** デバッグ用: AdSense未設定時にプレースホルダーを出すか */
  showPlaceholder?: boolean
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

/**
 * AdSense 広告枠。
 *
 * 配置箇所:
 *   - "lobby": ロビー画面 (トップページ下部)
 *   - "waiting": 対戦相手待機中
 *   - "result": 試合終了画面
 *
 * 環境変数 NEXT_PUBLIC_ADSENSE_SLOT_<NAME> が空ならレンダリングしない。
 */
export const AdSlot = ({
  slot,
  format = 'auto',
  className = '',
  showPlaceholder = false,
}: AdSlotProps) => {
  const slotId = env.adsense.slots[slot]
  const insRef = useRef<HTMLModElement>(null)

  useEffect(() => {
    if (!isEnabled.adsense() || !slotId) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {
      console.warn('[AdSense] push失敗:', e)
    }
  }, [slotId])

  // 未設定時: 開発中はプレースホルダーを出して位置確認できるようにする
  if (!isEnabled.adsense() || !slotId) {
    if (!showPlaceholder) return null
    return (
      <div
        className={`flex items-center justify-center bg-bg-mid/40 border border-dashed border-line rounded-lg text-text-faint text-xs p-4 ${className}`}
        style={{ minHeight: 90 }}
      >
        広告枠 [{slot}] (本番では表示されます)
      </div>
    )
  }

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`}
      style={{ display: 'block' }}
      data-ad-client={env.adsense.clientId}
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  )
}
