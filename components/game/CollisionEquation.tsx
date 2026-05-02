'use client'

import { useEffect, useRef, useState } from 'react'
import type { Bullet, BulletSnapshot } from '@/lib/types'

/**
 * 弾の物理スナップショットの差分から衝突を検出し、
 * 「a − b = c」 (大きい弾 − 小さい弾 = 残る弾の値) を衝突地点に空中表示する。
 *
 * 仕組み:
 *   親 (GameField) から bulletSnapshots と再生中の step index を渡してもらう。
 *   step が進むごとに直前 snapshot との差分を取り、衝突 (= 一方が消えて
 *   他方の値が変化) を検出してエフェクトを発火する。
 *
 * 単独で消える弾 (壁反射・プレイヤー命中・素数貫通) は表示しない。
 * (それらは TurnResult / DamagePop 側でカバー)
 */
interface CollisionEquationProps {
  snapshots: BulletSnapshot[]
  /** 現在表示中の snapshot index (GameField から伝搬) */
  step: number
  fieldSize: { width: number; height: number }
}

interface Equation {
  id: number
  big: number
  small: number
  result: number
  leftPct: number
  topPct: number
  bornAt: number
}

const LIFE_MS = 950
const POSITION_TOL = 60 // 同位置とみなす距離 (px)

export const CollisionEquation = ({
  snapshots,
  step,
  fieldSize,
}: CollisionEquationProps) => {
  const [equations, setEquations] = useState<Equation[]>([])
  const lastStepRef = useRef(-1)
  const idRef = useRef(0)

  useEffect(() => {
    if (step <= 0 || step >= snapshots.length) return
    if (step === lastStepRef.current) return
    lastStepRef.current = step

    const prev = snapshots[step - 1]?.bullets ?? []
    const curr = snapshots[step]?.bullets ?? []
    if (prev.length === 0) return

    const prevById = new Map(prev.map((b) => [b.id, b]))
    const currById = new Map(curr.map((b) => [b.id, b]))

    // 消えた弾 (= 衝突で敗者になった可能性)
    const vanished: Bullet[] = []
    prevById.forEach((b, id) => {
      if (!currById.has(id)) vanished.push(b)
    })
    if (vanished.length === 0) return

    // 値が変わった弾 (= 衝突の生存者)
    const changed: { prev: Bullet; curr: Bullet }[] = []
    prevById.forEach((p, id) => {
      const c = currById.get(id)
      if (c && c.value !== p.value) changed.push({ prev: p, curr: c })
    })

    const fresh: Equation[] = []

    for (const lost of vanished) {
      // 同 tick に値が変わった弾の中で、消えた弾の最終位置に最も近いものを探す
      let best: { prev: Bullet; curr: Bullet; dist: number } | null = null
      for (const ch of changed) {
        const dx = ch.prev.position.x - lost.position.x
        const dy = ch.prev.position.y - lost.position.y
        const d = Math.hypot(dx, dy)
        if (d <= POSITION_TOL && (!best || d < best.dist)) {
          best = { prev: ch.prev, curr: ch.curr, dist: d }
        }
      }

      if (!best) continue // 単独消滅 (壁反射・命中・貫通) はここでは扱わない

      const big = Math.max(lost.value, best.prev.value)
      const small = Math.min(lost.value, best.prev.value)
      const result = best.curr.value
      const cx = (lost.position.x + best.prev.position.x) / 2
      const cy = (lost.position.y + best.prev.position.y) / 2

      idRef.current += 1
      fresh.push({
        id: idRef.current,
        big,
        small,
        result,
        leftPct: (cx / fieldSize.width) * 100,
        topPct: (cy / fieldSize.height) * 100,
        bornAt: performance.now(),
      })
    }

    if (fresh.length > 0) {
      setEquations((curr) => [...curr, ...fresh])
    }
  }, [step, snapshots, fieldSize.width, fieldSize.height])

  // 寿命切れ掃除
  useEffect(() => {
    if (equations.length === 0) return
    const t = setTimeout(() => {
      const now = performance.now()
      setEquations((curr) => curr.filter((e) => now - e.bornAt < LIFE_MS))
    }, LIFE_MS + 50)
    return () => clearTimeout(t)
  }, [equations])

  if (equations.length === 0) return null

  return (
    <>
      {equations.map((e) => (
        <span
          key={e.id}
          aria-hidden
          className="pointer-events-none absolute font-bold text-sm sm:text-base mb-tabular select-none"
          style={{
            left: `${e.leftPct}%`,
            top: `${e.topPct}%`,
            color: 'var(--color-text)',
            textShadow:
              '0 0 8px var(--color-axis-origin), 0 0 16px var(--color-axis-origin)',
            background: 'var(--color-bg-overlay)',
            border: '1px solid var(--color-line-strong)',
            padding: '2px 8px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            animation: `mb-collision-equation ${LIFE_MS}ms var(--ease-out-quart) forwards`,
            willChange: 'transform, opacity',
          }}
        >
          <span style={{ color: 'var(--color-warn)' }}>{e.big}</span>
          <span style={{ color: 'var(--color-text-dim)' }}> − </span>
          <span style={{ color: 'var(--color-text-dim)' }}>{e.small}</span>
          <span style={{ color: 'var(--color-text-dim)' }}> = </span>
          <span style={{ color: 'var(--color-axis-origin)' }}>{e.result}</span>
        </span>
      ))}
    </>
  )
}
