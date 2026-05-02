'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { MouseEvent } from 'react'
import type { ClientGameState, Bullet, FunctionCurve, FieldItem } from '@/lib/types'
import { ANIMATION_DURATION_MS, GRID_SPACING_X, GRID_SPACING_Y } from '@/lib/constants'
import { predictTrajectories } from '@/lib/trajectory'
import { Player } from './Player'
import { BulletDisplay } from './BulletDisplay'
import { TrajectoryTrail } from './TrajectoryTrail'
import { CurveDisplay } from './CurveDisplay'
import { ItemDisplay } from './ItemDisplay'
import { DetailTooltip, type DetailTarget } from './DetailTooltip'
import { ScreenShake } from './ScreenShake'
import { DamagePop } from './DamagePop'
import { CollisionEquation } from './CollisionEquation'
import { DamageFlash } from './DamageFlash'
import { isHitStopped, flash } from '@/lib/effects'

interface GameFieldProps {
  gameState: ClientGameState
}

export const GameField = ({ gameState }: GameFieldProps) => {
  const { me, opponent, bullets, curves, items, turnResult, fieldSize } = gameState
  const phase = gameState.phase

  // アニメーション用: 現在表示中の弾一覧と再生中の step index
  const [displayBullets, setDisplayBullets] = useState<Bullet[]>(bullets)
  const [playbackStep, setPlaybackStep] = useState<number>(-1)
  const [isAnimating, setIsAnimating] = useState(false)
  const animFrameRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevTurnRef = useRef<number>(0)

  // スナップショットアニメーション再生 (ヒットストップ対応)
  useEffect(() => {
    const snapshots = turnResult?.bulletSnapshots
    if (!snapshots || snapshots.length === 0) {
      setDisplayBullets(bullets)
      setPlaybackStep(-1)
      return
    }

    if (phase !== 'result' && phase !== 'resolving' && phase !== 'gameover') {
      setDisplayBullets(bullets)
      setPlaybackStep(-1)
      return
    }

    if (gameState.turn === prevTurnRef.current) {
      return
    }
    prevTurnRef.current = gameState.turn

    setIsAnimating(true)
    const totalSteps = snapshots.length
    const stepDuration = ANIMATION_DURATION_MS / totalSteps
    let currentStep = 0

    const playStep = () => {
      // ヒットストップ中は次のフレームに繰り越す (短時間の凍結)
      if (isHitStopped()) {
        animFrameRef.current = setTimeout(playStep, 30)
        return
      }
      if (currentStep < totalSteps) {
        setDisplayBullets(snapshots[currentStep].bullets)
        setPlaybackStep(currentStep)
        currentStep++
        animFrameRef.current = setTimeout(playStep, stepDuration)
      } else {
        setDisplayBullets(bullets)
        setIsAnimating(false)
      }
    }

    playStep()

    return () => {
      if (animFrameRef.current !== null) {
        clearTimeout(animFrameRef.current)
      }
    }
  }, [turnResult, bullets, phase, gameState.turn])

  // 自分が被弾したら短く赤フラッシュ (TurnResult 側のシェイクと連動)
  const myDamageThisTurn = turnResult?.damages?.[me.id] ?? 0
  const lastFlashTurnRef = useRef<number>(0)
  useEffect(() => {
    if (
      myDamageThisTurn > 0 &&
      gameState.turn !== lastFlashTurnRef.current &&
      (phase === 'result' || phase === 'resolving')
    ) {
      lastFlashTurnRef.current = gameState.turn
      // mix-blend-mode: screen を想定した淡めの色
      flash('rgba(248, 113, 113, 0.35)', 380)
    }
  }, [myDamageThisTurn, gameState.turn, phase])

  // 曲線ダメージパルス: 直近ターンで被害を受けたプレイヤーの「敵が所有するカーブ」だけ
  // 一定時間 pulse=true を立てる。
  const [pulseTurn, setPulseTurn] = useState<number>(-1)
  useEffect(() => {
    if (
      turnResult &&
      Object.keys(turnResult.curveDamages ?? {}).length > 0 &&
      (phase === 'result' || phase === 'resolving') &&
      gameState.turn !== pulseTurn
    ) {
      setPulseTurn(gameState.turn)
      const t = setTimeout(() => setPulseTurn(-1), 620)
      return () => clearTimeout(t)
    }
  }, [turnResult, phase, gameState.turn, pulseTurn])

  const damagedIds = new Set(
    Object.entries(turnResult?.curveDamages ?? {})
      .filter(([, dmg]) => dmg > 0)
      .map(([id]) => id),
  )
  const isPulseActive = pulseTurn === gameState.turn && damagedIds.size > 0

  // actionフェーズに戻った時に弾をリセット
  useEffect(() => {
    if (phase === 'action' || phase === 'draw') {
      setDisplayBullets(bullets)
      setIsAnimating(false)
    }
  }, [phase, bullets])

  // アクションフェーズ中に全tick軌跡を予測
  const settings = gameState.settings
  const trajectories = useMemo(() => {
    if (phase !== 'action' || isAnimating || displayBullets.length === 0) return []
    return predictTrajectories(displayBullets, fieldSize, settings)
  }, [phase, isAnimating, displayBullets, fieldSize, settings])

  // --- 詳細ツールチップ (アクションフェーズのみ) ---
  const fieldRootRef = useRef<HTMLDivElement>(null)
  const [detail, setDetail] = useState<
    | { id: string; target: DetailTarget; anchor: { leftPct: number; topPct: number } }
    | null
  >(null)

  // フェーズが action 以外になったら自動で閉じる
  useEffect(() => {
    if (phase !== 'action') setDetail(null)
  }, [phase])

  // フィールド外座標 → % 変換
  const eventToPct = (e: MouseEvent): { leftPct: number; topPct: number } => {
    const rect = fieldRootRef.current?.getBoundingClientRect()
    if (!rect) return { leftPct: 50, topPct: 50 }
    return {
      leftPct: ((e.clientX - rect.left) / rect.width) * 100,
      topPct: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  const isAction = phase === 'action' && !isAnimating

  const handleBulletClick = (bullet: Bullet, e: MouseEvent) => {
    e.stopPropagation()
    if (detail?.id === bullet.id) return setDetail(null)
    const leftPct = (bullet.position.x / fieldSize.width) * 100
    const topPct = (bullet.position.y / fieldSize.height) * 100
    setDetail({
      id: bullet.id,
      target: { kind: 'bullet', data: bullet, isOwn: bullet.owner === me.id },
      anchor: { leftPct, topPct },
    })
  }

  const handleCurveClick = (curve: FunctionCurve, e: MouseEvent) => {
    e.stopPropagation()
    if (detail?.id === curve.id) return setDetail(null)
    setDetail({
      id: curve.id,
      target: { kind: 'curve', data: curve, isOwn: curve.owner === me.id },
      anchor: eventToPct(e),
    })
  }

  const handleItemClick = (item: FieldItem, e: MouseEvent) => {
    e.stopPropagation()
    if (detail?.id === item.id) return setDetail(null)
    const leftPct = (item.position.x / fieldSize.width) * 100
    const topPct = (item.position.y / fieldSize.height) * 100
    setDetail({
      id: item.id,
      target: { kind: 'item', data: item },
      anchor: { leftPct, topPct },
    })
  }

  // 選択中のアイテム/弾はゲーム状態が更新されたら最新の値で再表示する (HP変化など)
  useEffect(() => {
    if (!detail) return
    if (detail.target.kind === 'bullet') {
      const fresh = bullets.find((b) => b.id === detail.id)
      if (!fresh) return setDetail(null)
    } else if (detail.target.kind === 'item') {
      const fresh = items.find((it) => it.id === detail.id)
      if (!fresh) return setDetail(null)
    } else if (detail.target.kind === 'curve') {
      const fresh = curves.find((c) => c.id === detail.id)
      if (!fresh) return setDetail(null)
    }
  }, [bullets, items, curves, detail])

  // グリッド/軸/原点マーカー: useMemo で settings 変化時のみ再計算
  const fieldGrid = useMemo(() => {
    const { mathXMax, mathYMax } = settings
    const verticals: number[] = []
    for (let v = GRID_SPACING_X; v <= mathXMax + 1e-9; v += GRID_SPACING_X) {
      verticals.push(v, -v)
    }
    const horizontals: number[] = []
    for (let v = GRID_SPACING_Y; v <= mathYMax + 1e-9; v += GRID_SPACING_Y) {
      horizontals.push(v, -v)
    }
    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
    return { mathXMax, mathYMax, verticals, horizontals, fmt }
  }, [settings])

  return (
    <ScreenShake className="w-full">
    <div
      ref={fieldRootRef}
      className="relative w-full aspect-[2/1] bg-bg-mid border-2 border-line-strong rounded-lg overflow-hidden"
      style={{
        boxShadow:
          'inset 0 0 0 1px var(--color-line-soft), inset 0 0 60px rgba(56, 189, 248, 0.04)',
      }}
      onClick={() => setDetail(null)}
    >
      {/* 背景: わずかな radial で原点を視覚的に主役化 (transform/opacity に該当しないが静的なので OK) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(56,189,248,0.08) 0%, transparent 65%)',
        }}
      />

      {/* グリッド線 (細格子): TRON 風主役化、cyan 微発光 */}
      <div className="absolute inset-0 pointer-events-none">
        {fieldGrid.verticals.map((v, i) => (
          <div
            key={`v-${i}`}
            className="absolute top-0 bottom-0 w-px bg-grid-minor"
            style={{ left: `${((v + fieldGrid.mathXMax) / (2 * fieldGrid.mathXMax)) * 100}%` }}
          />
        ))}
        {fieldGrid.horizontals.map((v, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 right-0 h-px bg-grid-minor"
            style={{ top: `${((fieldGrid.mathYMax - v) / (2 * fieldGrid.mathYMax)) * 100}%` }}
          />
        ))}
      </div>

      {/* 直交座標軸: 視覚言語の中心 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* x 軸 */}
        <div
          className="absolute left-0 right-0 h-px bg-axis"
          style={{ top: '50%', boxShadow: '0 0 6px var(--color-axis)' }}
        />
        {/* y 軸 */}
        <div
          className="absolute top-0 bottom-0 w-px bg-axis"
          style={{ left: '50%', boxShadow: '0 0 6px var(--color-axis)' }}
        />
        {/* 原点マーカー (cyan の点 + 微弱グロー) */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: '50%',
            top: '50%',
            width: '6px',
            height: '6px',
            background: 'var(--color-axis-origin)',
            boxShadow: '0 0 8px var(--color-axis-origin), 0 0 16px var(--color-axis-origin)',
          }}
        />
        {/* 目盛りラベル */}
        {(() => {
          const { mathXMax, mathYMax, fmt } = fieldGrid
          const xTicks = [-mathXMax, -mathXMax / 2, 0, mathXMax / 2, mathXMax]
          const yTicks = [-mathYMax, 0, mathYMax]
          return (
            <>
              {xTicks.map((v, i) => (
                <span
                  key={`x-${i}`}
                  className="absolute text-[8px] text-text-faint -translate-x-1/2 mb-tabular"
                  style={{ left: `${((v + mathXMax) / (2 * mathXMax)) * 100}%`, top: '51%' }}
                >
                  {fmt(v)}
                </span>
              ))}
              {yTicks.map((v, i) => (
                <span
                  key={`y-${i}`}
                  className="absolute text-[8px] text-text-faint -translate-y-1/2 mb-tabular"
                  style={{ left: '51%', top: `${((mathYMax - v) / (2 * mathYMax)) * 100}%` }}
                >
                  {v !== 0 ? fmt(v) : ''}
                </span>
              ))}
            </>
          )
        })()}
      </div>

      {/* 関数カーブ: ダメージを与えたカーブ (= 被害者の敵が所有) を pulse */}
      {curves.map((curve) => (
        <CurveDisplay
          key={curve.id}
          curve={curve}
          isOwn={curve.owner === me.id}
          settings={settings}
          onClick={isAction ? handleCurveClick : undefined}
          pulse={isPulseActive && !damagedIds.has(curve.owner)}
        />
      ))}

      {/* フィールド上のアイテム */}
      {items.map((item) => (
        <ItemDisplay
          key={item.id}
          item={item}
          fieldSize={fieldSize}
          onClick={isAction ? handleItemClick : undefined}
        />
      ))}

      {/* 軌跡プレビュー (actionフェーズのみ) */}
      {trajectories.map((traj) => (
        <TrajectoryTrail
          key={`traj-${traj.bulletId}`}
          trajectory={traj}
          isOwn={traj.owner === me.id}
          bulletRadius={settings.bulletRadius}
          fieldSize={fieldSize}
        />
      ))}

      {/* プレイヤー */}
      <Player
        position={me.position}
        facing={me.facing}
        isMe
        animating={phase === 'result' || phase === 'resolving'}
        playerRadius={settings.playerRadius}
        fieldSize={fieldSize}
      />
      <Player
        position={opponent.position}
        facing={opponent.facing}
        isMe={false}
        animating={phase === 'result' || phase === 'resolving'}
        playerRadius={settings.playerRadius}
        fieldSize={fieldSize}
      />

      {/* 弾 */}
      {displayBullets.map((bullet) => (
        <BulletDisplay
          key={bullet.id}
          bullet={bullet}
          isOwn={bullet.owner === me.id}
          bulletRadius={settings.bulletRadius}
          fieldSize={fieldSize}
          onClick={isAction ? handleBulletClick : undefined}
        />
      ))}

      {/* 詳細ツールチップ (アクションフェーズのみ) */}
      {detail && (
        <DetailTooltip
          target={detail.target}
          anchor={detail.anchor}
          onClose={() => setDetail(null)}
        />
      )}

      {/* アニメーション中インジケーター */}
      {isAnimating && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-bg-overlay border border-line-soft px-3 py-1 rounded text-xs text-warn">
          解決中...
        </div>
      )}

      {/* 衝突点の式空中表示 (resolving / result 中のみ意味がある) */}
      {turnResult?.bulletSnapshots && turnResult.bulletSnapshots.length > 0 && (
        <CollisionEquation
          snapshots={turnResult.bulletSnapshots}
          step={playbackStep}
          fieldSize={fieldSize}
        />
      )}

      {/* 被弾ダメージ数値ポップアップ (自分・相手それぞれ) */}
      <DamagePop
        totalDamage={turnResult?.damages?.[me.id] ?? 0}
        position={me.position}
        fieldSize={fieldSize}
        isMe
      />
      <DamagePop
        totalDamage={turnResult?.damages?.[opponent.id] ?? 0}
        position={opponent.position}
        fieldSize={fieldSize}
        isMe={false}
      />

      {/* 全画面フラッシュ (自分被弾時) */}
      <DamageFlash />
    </div>
    </ScreenShake>
  )
}
