'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useEffectStore } from '@/hooks/useEffectStore'

/**
 * 子要素を effectStore.shakeIntensity に応じて transform: translate で揺らすラッパー。
 * GPU レイヤを離脱しないよう、書き換えるのは transform のみ。
 *
 * 設計判断:
 *   ラッパー要素は absolute/relative にしない。子要素のレイアウトに干渉しないよう
 *   `display: contents` ではなく `transform-only` の wrapper を内側に置く。
 */
interface ScreenShakeProps {
  children: ReactNode
  className?: string
}

export const ScreenShake = ({ children, className }: ScreenShakeProps) => {
  const intensity = useEffectStore((s) => s.shakeIntensity)
  const ref = useRef<HTMLDivElement>(null)

  // ref + rAF でランダム揺れを書き込む。React 再レンダーは intensity 変化のみ。
  useEffect(() => {
    if (!ref.current) return
    if (intensity <= 0) {
      ref.current.style.transform = 'translate3d(0,0,0)'
      return
    }
    let raf = 0
    const tick = () => {
      const el = ref.current
      if (!el) return
      const dx = (Math.random() - 0.5) * 2 * intensity
      const dy = (Math.random() - 0.5) * 2 * intensity
      el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (ref.current) ref.current.style.transform = 'translate3d(0,0,0)'
    }
  }, [intensity])

  return (
    <div
      ref={ref}
      className={className}
      style={{ willChange: intensity > 0 ? 'transform' : undefined }}
    >
      {children}
    </div>
  )
}
