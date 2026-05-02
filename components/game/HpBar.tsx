'use client'

import { useEffect, useRef, useState } from 'react'
import { INITIAL_HP } from '@/lib/constants'

interface HpBarProps {
  name: string
  hp: number
  isMe: boolean
}

/**
 * HP バー (格ゲー風ゴーストバー対応)。
 *
 * 構造:
 *   ┌── トラック ──────────────────┐
 *   │ [本体バー] [ゴーストバー残光]   │
 *   └────────────────────────────┘
 *
 * 本体バー: 即座に新しい値へ追従 (var(--dur-base))
 * ゴーストバー: 旧値の位置にしばらく残ってから追従 (var(--dur-slow) 遅延)。
 *   被弾の重みが視覚的に伝わる。
 *
 * 低 HP (< 25%) は本体バーを opacity 脈動で警告表示。
 */
export const HpBar = ({ name, hp, isMe }: HpBarProps) => {
  const percent = Math.max(0, (hp / INITIAL_HP) * 100)
  const color =
    percent > 50 ? 'bg-hp-full' : percent > 25 ? 'bg-hp-warn' : 'bg-hp-low'
  const isLow = percent <= 25 && percent > 0

  // ゴーストバー: 過去の percent をしばらく残す。
  // hp が減ったとき、ghostPercent は古い値を保ち、本体バーが追いついた後に
  // 短い遅延でゴーストも縮める。
  const [ghostPercent, setGhostPercent] = useState(percent)
  const prevRef = useRef(percent)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    if (percent < prev) {
      // 被弾: ghost は旧値を保持、少し遅れて新値へ
      setGhostPercent(prev)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setGhostPercent(percent)
      }, 480)
    } else {
      // 増加 / 同値: ghost を即座に同期
      setGhostPercent(percent)
    }
    prevRef.current = percent
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [percent])

  return (
    <div
      className={`flex items-center gap-1 sm:gap-2 min-w-0 ${
        isMe ? '' : 'flex-row-reverse'
      }`}
    >
      <span
        className={`text-xs sm:text-sm font-bold truncate max-w-[60px] sm:max-w-none ${
          isMe ? 'text-p1' : 'text-p2'
        }`}
      >
        {name}
      </span>

      <div
        className="relative w-20 sm:w-40 h-3 sm:h-4 bg-hp-track rounded-full overflow-hidden border border-line-soft"
        style={
          isLow
            ? { animation: 'mb-low-hp 0.85s var(--ease-in-out) infinite' }
            : undefined
        }
      >
        {/* ゴーストバー (残光): 本体より遅れて追従、半透明 */}
        <div
          className="absolute inset-y-0 left-0 bg-hp-ghost rounded-full transition-[width] duration-[var(--dur-slow)] [transition-timing-function:var(--ease-out-quart)]"
          style={{ width: `${ghostPercent}%` }}
        />
        {/* 本体バー: 即座に新値へ */}
        <div
          className={`absolute inset-y-0 left-0 ${color} rounded-full transition-[width] duration-[var(--dur-base)] [transition-timing-function:var(--ease-out-quart)]`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <span className="text-[10px] sm:text-xs text-text-dim w-6 sm:w-8 text-center mb-tabular">
        {hp}
      </span>
    </div>
  )
}
