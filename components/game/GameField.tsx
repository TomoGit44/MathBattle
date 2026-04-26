'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { ClientGameState, Bullet } from '@/lib/types'
import { ANIMATION_DURATION_MS, GRID_SPACING_X, GRID_SPACING_Y } from '@/lib/constants'
import { predictTrajectories } from '@/lib/trajectory'
import { Player } from './Player'
import { BulletDisplay } from './BulletDisplay'
import { TrajectoryTrail } from './TrajectoryTrail'
import { CurveDisplay } from './CurveDisplay'
import { ItemDisplay } from './ItemDisplay'

interface GameFieldProps {
  gameState: ClientGameState
}

export const GameField = ({ gameState }: GameFieldProps) => {
  const { me, opponent, bullets, curves, items, turnResult, fieldSize } = gameState
  const phase = gameState.phase

  // アニメーション用: 現在表示中の弾一覧
  const [displayBullets, setDisplayBullets] = useState<Bullet[]>(bullets)
  const [isAnimating, setIsAnimating] = useState(false)
  const animFrameRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevTurnRef = useRef<number>(0)

  // スナップショットアニメーション再生
  useEffect(() => {
    const snapshots = turnResult?.bulletSnapshots
    if (!snapshots || snapshots.length === 0) {
      setDisplayBullets(bullets)
      return
    }

    if (phase !== 'result' && phase !== 'resolving' && phase !== 'gameover') {
      setDisplayBullets(bullets)
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
      if (currentStep < totalSteps) {
        setDisplayBullets(snapshots[currentStep].bullets)
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

  return (
    <div className="relative w-full aspect-[2/1] bg-gray-800 border-2 border-gray-600 rounded-lg overflow-hidden">
      {/* グリッド線: x軸・y軸 (原点) を基準に GRID_SPACING_X / GRID_SPACING_Y ごとに描画 */}
      <div className="absolute inset-0 opacity-10">
        {(() => {
          const { mathXMax, mathYMax } = settings
          const verticals: number[] = []
          for (let v = GRID_SPACING_X; v <= mathXMax + 1e-9; v += GRID_SPACING_X) {
            verticals.push(v, -v)
          }
          const horizontals: number[] = []
          for (let v = GRID_SPACING_Y; v <= mathYMax + 1e-9; v += GRID_SPACING_Y) {
            horizontals.push(v, -v)
          }
          return (
            <>
              {verticals.map((v, i) => (
                <div
                  key={`v-${i}`}
                  className="absolute top-0 bottom-0 w-px bg-gray-400"
                  style={{ left: `${((v + mathXMax) / (2 * mathXMax)) * 100}%` }}
                />
              ))}
              {horizontals.map((v, i) => (
                <div
                  key={`h-${i}`}
                  className="absolute left-0 right-0 h-px bg-gray-400"
                  style={{ top: `${((mathYMax - v) / (2 * mathYMax)) * 100}%` }}
                />
              ))}
            </>
          )
        })()}
      </div>

      {/* 直交座標軸 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* x軸 (y=0 → top:50%) */}
        <div className="absolute left-0 right-0 h-px bg-white/20" style={{ top: '50%' }} />
        {/* y軸 (x=0 → left:50%) */}
        <div className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: '50%' }} />
        {/* x軸の目盛りラベル: -mathXMax, -mathXMax/2, 0, mathXMax/2, mathXMax */}
        {(() => {
          const { mathXMax, mathYMax } = settings
          const xTicks = [-mathXMax, -mathXMax / 2, 0, mathXMax / 2, mathXMax]
          const yTicks = [-mathYMax, 0, mathYMax]
          const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
          return (
            <>
              {xTicks.map((v, i) => (
                <span
                  key={`x-${i}`}
                  className="absolute text-[8px] text-white/30 -translate-x-1/2"
                  style={{ left: `${((v + mathXMax) / (2 * mathXMax)) * 100}%`, top: '51%' }}
                >
                  {fmt(v)}
                </span>
              ))}
              {yTicks.map((v, i) => (
                <span
                  key={`y-${i}`}
                  className="absolute text-[8px] text-white/30 -translate-y-1/2"
                  style={{ left: '51%', top: `${((mathYMax - v) / (2 * mathYMax)) * 100}%` }}
                >
                  {v !== 0 ? fmt(v) : ''}
                </span>
              ))}
            </>
          )
        })()}
      </div>

      {/* 関数カーブ */}
      {curves.map((curve) => (
        <CurveDisplay
          key={curve.id}
          curve={curve}
          isOwn={curve.owner === me.id}
          settings={settings}
        />
      ))}

      {/* フィールド上のアイテム */}
      {items.map((item) => (
        <ItemDisplay key={item.id} item={item} fieldSize={fieldSize} />
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
        />
      ))}

      {/* アニメーション中インジケーター */}
      {isAnimating && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded text-xs text-yellow-300">
          解決中...
        </div>
      )}
    </div>
  )
}
