'use client'

import { useEffectStore } from '@/hooks/useEffectStore'

/**
 * 全画面の被弾フラッシュ。
 * effectStore.flashColor が立っている間、半透明レイヤーをフェード。
 * 親要素は `relative` または最上位 (fixed) で配置すること。
 */
interface DamageFlashProps {
  /** 重ねる対象。省略時は fixed inset-0 (全画面) */
  fullscreen?: boolean
}

export const DamageFlash = ({ fullscreen = false }: DamageFlashProps) => {
  const color = useEffectStore((s) => s.flashColor)
  if (!color) return null
  return (
    <div
      aria-hidden
      className={
        fullscreen
          ? 'pointer-events-none fixed inset-0 z-40'
          : 'pointer-events-none absolute inset-0 z-30'
      }
      style={{
        background: color,
        animation: `mb-damage-flash var(--dur-slow) var(--ease-out-quart) forwards`,
        mixBlendMode: 'screen',
      }}
    />
  )
}
