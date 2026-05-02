'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TurnResult as TurnResultType } from '@/lib/types'
import { hitstop, shake } from '@/lib/effects'

interface TurnResultProps {
  turnResult: TurnResultType
  /** 被弾アニメ用: 自分のID (省略可)。指定すると被弾時にスクリーンシェイク強度を変える */
  meId?: string
  /** ターン番号 (cinematic intro 用) */
  turn?: number
}

/**
 * ターン結果パネルと素数演出 + シネマ的 3 段階構成。
 *
 * Phase A (0–500ms / intro):
 *   "TURN N" の見出しが画面中央にフラッシュ (mb-cinema-intro 600ms)。
 *   結果パネルは表示しない (静粛)。
 * Phase B (500–2500ms / main):
 *   フィールド側で物理リプレイが進む。結果パネルの行を順次フェードイン (stagger)。
 * Phase C (2500–3000ms / outro):
 *   全行表示済み。次ターン待ちの落ち着いた状態。
 *
 * 素数合成・被弾シェイク・ヒットストップは Phase A の冒頭で一気に発火 (シネマ感)。
 */
export const TurnResult = ({ turnResult, meId, turn }: TurnResultProps) => {
  const primeEntries = Object.entries(turnResult.primeSynthesis ?? {})

  // ターン結果の同一性キー (二重発火防止)
  const firedKeyRef = useRef<string | null>(null)

  // フェーズ tracking (intro → main → outro)
  const [stage, setStage] = useState<'intro' | 'main' | 'outro'>('intro')

  useEffect(() => {
    const key = JSON.stringify({
      t: turn,
      d: turnResult.damages,
      p: turnResult.primeSynthesis ?? {},
    })
    if (firedKeyRef.current === key) return
    firedKeyRef.current = key

    // 演出を発火
    if (Object.keys(turnResult.primeSynthesis ?? {}).length > 0) {
      hitstop(120)
      shake(6, 260)
    }

    if (meId && turnResult.damages[meId]) {
      const dmg = turnResult.damages[meId]
      const intensity = dmg >= 20 ? 12 : dmg >= 10 ? 8 : 4
      shake(intensity, 380)
    } else if (Object.keys(turnResult.damages).length > 0) {
      shake(3, 200)
    }

    // シネマ進行: intro → main → outro
    setStage('intro')
    const t1 = setTimeout(() => setStage('main'), 500)
    const t2 = setTimeout(() => setStage('outro'), 2500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [turnResult, meId, turn])

  const itemKills = turnResult.itemKills ?? []

  // 結果行を並べる (順番固定: action → damages → curveDamages → bulletEvents → itemKills)
  const rows = useMemo(() => {
    const list: { key: string; node: React.ReactNode }[] = []
    Object.values(turnResult.actions).forEach((action, i) => {
      list.push({
        key: `a-${i}`,
        node: <div className="text-text-mid">{action.description}</div>,
      })
    })
    Object.entries(turnResult.damages).forEach(([id, dmg]) => {
      list.push({
        key: `d-${id}`,
        node: <div className="text-p2 mb-tabular">{dmg} ダメージ!</div>,
      })
    })
    Object.entries(turnResult.curveDamages).forEach(([id, dmg]) => {
      list.push({
        key: `c-${id}`,
        node: (
          <div className="text-success mb-tabular">📐 曲線ダメージ: {dmg}</div>
        ),
      })
    })
    turnResult.bulletEvents.forEach((event, i) => {
      list.push({
        key: `b-${i}`,
        node: <div className="text-warn">{event}</div>,
      })
    })
    itemKills.forEach((k) => {
      list.push({
        key: `k-${k.itemId}`,
        node: (
          <div className="text-op-sub">
            🎁 アイテム [{k.kind}] を撃破!{' '}
            {k.awarded ? '→ 獲得 (手札に追加)' : '→ 手札満杯のためドロップ'}
          </div>
        ),
      })
    })
    return list
  }, [turnResult, itemKills])

  const hasContent = rows.length > 0
  const showPanel = hasContent && stage !== 'intro'

  return (
    <>
      {/* 結果パネル: intro 中は非表示 (静粛)。main から stagger fade-in */}
      {showPanel && (
        <div className="relative bg-bg-mid/80 rounded-lg p-3 text-sm space-y-1 border border-line-soft">
          {rows.map((row, i) => (
            <div
              key={row.key}
              style={{
                animation:
                  'mb-result-row var(--dur-base) var(--ease-out-quart) both',
                animationDelay: `${i * 80}ms`,
              }}
            >
              {row.node}
            </div>
          ))}
        </div>
      )}

      {/* シネマ導入: "TURN N" の登場フラッシュ (intro 段階のみ) */}
      {stage === 'intro' && hasContent && typeof turn === 'number' && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
        >
          <div
            className="absolute top-1/2 left-1/2 mb-tabular tracking-[0.4em] text-text font-black"
            style={{
              fontSize: 'clamp(2rem, 6vw, 3.5rem)',
              animation:
                'mb-cinema-intro 500ms var(--ease-out-quart) forwards',
              textShadow:
                '0 0 12px var(--color-axis-origin), 0 0 28px var(--color-axis-origin)',
            }}
          >
            TURN {turn}
          </div>
        </div>
      )}

      {/* 素数合成演出: violet + ガラス白の "PRIME!" (AI-slop fuchsia グラデを廃止) */}
      {primeEntries.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          {primeEntries.map(([id, value]) => (
            <div
              key={id}
              className="flex flex-col items-center"
              style={{
                animation:
                  'mb-prime-flash 2.5s var(--ease-out-quart) forwards',
              }}
            >
              <div
                className="text-7xl font-black tracking-widest mb-tabular"
                style={{
                  color: 'var(--color-prime)',
                  textShadow:
                    '0 0 18px var(--color-prime-edge), 0 0 38px var(--color-prime-edge), 0 0 80px rgba(196,181,253,0.4)',
                }}
              >
                PRIME!
              </div>
              <div
                className="mt-2 text-3xl font-bold mb-tabular"
                style={{
                  color: 'var(--color-prime)',
                  textShadow:
                    '0 0 12px var(--color-prime-edge), 0 0 24px var(--color-prime-edge)',
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
