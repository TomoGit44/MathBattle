'use client'

import { useEffect, useRef, useState } from 'react'
import type { Position } from '@/lib/types'

/**
 * プレイヤー位置から「-N」を上方フロートさせるダメージ数値ポップアップ。
 *
 * 親 (GameField) からターン結果のダメージ数を渡してもらい、
 * 値が変化したタイミングで一度だけ短命なポップを生成する。
 */
interface DamagePopProps {
  /** 累計ダメージ。これが増えたタイミングで pop を生成 */
  totalDamage: number
  /** プレイヤー位置 (フィールド内ピクセル) */
  position: Position
  fieldSize: { width: number; height: number }
  /** 自分なら p2 風 (赤系)、相手なら p1 風 (シアン)。被弾側=自分の色味で読みやすく */
  isMe: boolean
}

interface Pop {
  id: number
  amount: number
  bornAt: number
  leftPct: number
  topPct: number
}

const POP_LIFE_MS = 900

export const DamagePop = ({ totalDamage, position, fieldSize, isMe }: DamagePopProps) => {
  const [pops, setPops] = useState<Pop[]>([])
  const prevRef = useRef(totalDamage)
  const idRef = useRef(0)

  // ダメージ量が増えた瞬間に pop を発火
  useEffect(() => {
    const prev = prevRef.current
    if (totalDamage > prev) {
      const delta = totalDamage - prev
      const leftPct = (position.x / fieldSize.width) * 100
      const topPct = (position.y / fieldSize.height) * 100
      idRef.current += 1
      setPops((curr) => [
        ...curr,
        {
          id: idRef.current,
          amount: delta,
          bornAt: performance.now(),
          leftPct,
          topPct,
        },
      ])
    }
    prevRef.current = totalDamage
  }, [totalDamage, position.x, position.y, fieldSize.width, fieldSize.height])

  // 寿命切れの掃除
  useEffect(() => {
    if (pops.length === 0) return
    const timer = setTimeout(() => {
      const now = performance.now()
      setPops((curr) => curr.filter((p) => now - p.bornAt < POP_LIFE_MS))
    }, POP_LIFE_MS + 50)
    return () => clearTimeout(timer)
  }, [pops])

  if (pops.length === 0) return null

  // 自分が被弾 = ダメージ表示は p2 (敵色) で「危険」感
  // 相手被弾 = p1 (自分の色) で「ヒット」感
  const colorVar = isMe ? 'var(--color-p2)' : 'var(--color-p1)'
  const glow = isMe
    ? '0 0 14px var(--color-p2-glow)'
    : '0 0 14px var(--color-p1-glow)'

  return (
    <>
      {pops.map((p) => (
        <span
          key={p.id}
          aria-hidden
          className="pointer-events-none absolute font-black text-2xl sm:text-3xl mb-tabular select-none"
          style={{
            left: `${p.leftPct}%`,
            top: `${p.topPct}%`,
            color: colorVar,
            textShadow: glow,
            animation: `mb-damage-pop ${POP_LIFE_MS}ms var(--ease-out-quart) forwards`,
            willChange: 'transform, opacity',
          }}
        >
          -{p.amount}
        </span>
      ))}
    </>
  )
}
