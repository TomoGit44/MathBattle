'use client'

/**
 * CardOrbOverlay: 新規カードの「光の玉が発信元から手札に飛んでくる」演出を司るレイヤー。
 *
 * - GameScreen から渡される NewCardEvent[] を受け取り、各 targetIndex ごとに玉を1つ生成
 * - 発信元: kind='pool' なら data-draw-anchor の DOM 中心 (次ターンプレビューの位置)、
 *   kind='item' ならフィールド DOM 上のピクセル座標
 * - 着地点: data-hand-card-index="N" の DOM 中心
 * - 飛行: 絶対配置の div を transform で移動 (CSS transition で GPU レイヤー維持)
 * - 着地時 onTransitionEnd で onArrived(index) を呼んで、HandDisplay 側の入場演出を発火
 *
 * 同一 events 配列を二重に処理しないため useRef で参照同一性をトラックする。
 */

import { useEffect, useRef, useState } from 'react'
import type { NewCardEvent, ItemKind } from '@/lib/types'
import { FIELD_WIDTH, FIELD_HEIGHT } from '@/lib/constants'

interface OrbState {
  id: string
  source: 'pool' | 'item'
  itemKind?: ItemKind
  targetIndex: number
  startX: number
  startY: number
  endX: number
  endY: number
  delay: number
}

interface CardOrbOverlayProps {
  events: NewCardEvent[] | undefined
  /** 自プレイヤーの ownerId — data-draw-anchor=ownerId で識別する */
  meId: string
  /** フィールド DOM (アイテム発信元の座標基準) */
  fieldRef: React.RefObject<HTMLElement | null>
  /** 玉が着地して対応カードを「現れさせる」コールバック */
  onArrived: (cardIndex: number) => void
  /** 演出開始時に「玉が飛行中」のインデックスを通知 (HandDisplay で opacity:0 にする) */
  onPending: (cardIndices: number[]) => void
}

const ORB_SIZE = 22

export const CardOrbOverlay = ({
  events,
  meId,
  fieldRef,
  onArrived,
  onPending,
}: CardOrbOverlayProps) => {
  const [orbs, setOrbs] = useState<OrbState[]>([])
  const [armed, setArmed] = useState<Set<string>>(new Set())
  const lastEventsRef = useRef<NewCardEvent[] | undefined>(undefined)

  useEffect(() => {
    if (!events || events.length === 0) return
    if (events === lastEventsRef.current) return
    lastEventsRef.current = events

    const id = requestAnimationFrame(() => {
      const created: OrbState[] = []
      const pendingIdx: number[] = []
      let stagger = 0

      for (const evt of events) {
        let originX = 0
        let originY = 0
        if (evt.kind === 'pool') {
          const anchorEl = document.querySelector<HTMLElement>(`[data-draw-anchor="${meId}"]`)
          if (!anchorEl) continue
          const r = anchorEl.getBoundingClientRect()
          originX = r.left + r.width / 2
          originY = r.top + r.height / 2
        } else {
          const fieldEl = fieldRef.current
          if (!fieldEl) continue
          const r = fieldEl.getBoundingClientRect()
          originX = r.left + (evt.originPosition.x / FIELD_WIDTH) * r.width
          originY = r.top + (evt.originPosition.y / FIELD_HEIGHT) * r.height
        }

        for (const targetIndex of evt.targetIndices) {
          const cardEl = document.querySelector<HTMLElement>(
            `[data-hand-card-index="${targetIndex}"]`
          )
          if (!cardEl) continue
          const r = cardEl.getBoundingClientRect()
          const endX = r.left + r.width / 2
          const endY = r.top + r.height / 2
          const orbId = `${Date.now()}-${targetIndex}-${stagger}`
          created.push({
            id: orbId,
            source: evt.kind,
            itemKind: evt.kind === 'item' ? evt.itemKind : undefined,
            targetIndex,
            startX: originX,
            startY: originY,
            endX,
            endY,
            delay: stagger * 60,
          })
          pendingIdx.push(targetIndex)
          stagger++
        }
      }

      if (pendingIdx.length === 0) return

      onPending(pendingIdx)
      setOrbs((prev) => [...prev, ...created])

      requestAnimationFrame(() => {
        setArmed((prev) => {
          const next = new Set(prev)
          for (const o of created) next.add(o.id)
          return next
        })
      })
    })

    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  const handleTransitionEnd = (orb: OrbState) => () => {
    onArrived(orb.targetIndex)
    setOrbs((prev) => prev.filter((o) => o.id !== orb.id))
    setArmed((prev) => {
      const next = new Set(prev)
      next.delete(orb.id)
      return next
    })
  }

  if (orbs.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {orbs.map((orb) => {
        const isArmed = armed.has(orb.id)
        const x = isArmed ? orb.endX : orb.startX
        const y = isArmed ? orb.endY : orb.startY
        const bg = orb.source === 'pool' ? 'var(--orb-deck)' : 'var(--orb-item)'
        return (
          <div
            key={orb.id}
            onTransitionEnd={(e) => {
              if (e.propertyName === 'transform') handleTransitionEnd(orb)()
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: ORB_SIZE,
              height: ORB_SIZE,
              marginLeft: -ORB_SIZE / 2,
              marginTop: -ORB_SIZE / 2,
              borderRadius: '9999px',
              background: bg,
              transform: `translate3d(${x}px, ${y}px, 0)`,
              transition: `transform var(--dur-cinema) var(--ease-glide) ${orb.delay}ms, opacity var(--dur-fast) linear`,
              opacity: 1,
              willChange: 'transform, opacity',
              animation: 'mb-orb-pulse 0.6s var(--ease-in-out) infinite',
              filter: 'drop-shadow(0 0 8px currentColor)',
            }}
          />
        )
      })}
    </div>
  )
}
