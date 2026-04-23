'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { ClientGameState, Bullet } from '@/lib/types'
import { ANIMATION_DURATION_MS } from '@/lib/constants'
import { predictTrajectories } from '@/lib/trajectory'
import { Player } from './Player'
import { BulletDisplay } from './BulletDisplay'
import { TrajectoryTrail } from './TrajectoryTrail'
import { CurveDisplay } from './CurveDisplay'

interface GameFieldProps {
  gameState: ClientGameState
}

export const GameField = ({ gameState }: GameFieldProps) => {
  const { me, opponent, bullets, curves, turnResult, fieldSize } = gameState
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
  const trajectories = useMemo(() => {
    if (phase !== 'action' || isAnimating || displayBullets.length === 0) return []
    return predictTrajectories(displayBullets, fieldSize)
  }, [phase, isAnimating, displayBullets, fieldSize])

  return (
    <div className="relative w-full aspect-[2/1] bg-gray-800 border-2 border-gray-600 rounded-lg overflow-hidden">
      {/* グリッド線 */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={`v-${i}`}
            className="absolute top-0 bottom-0 w-px bg-gray-400"
            style={{ left: `${(i + 1) * 10}%` }}
          />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 right-0 h-px bg-gray-400"
            style={{ top: `${(i + 1) * 20}%` }}
          />
        ))}
      </div>

      {/* 直交座標軸 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* x軸 (y=0 → top:50%) */}
        <div className="absolute left-0 right-0 h-px bg-white/20" style={{ top: '50%' }} />
        {/* y軸 (x=0 → left:50%) */}
        <div className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: '50%' }} />
        {/* x軸の目盛りラベル */}
        {[-10, -5, 0, 5, 10].map((v) => (
          <span
            key={`x-${v}`}
            className="absolute text-[8px] text-white/30 -translate-x-1/2"
            style={{ left: `${((v + 10) / 20) * 100}%`, top: '51%' }}
          >
            {v}
          </span>
        ))}
        {/* y軸の目盛りラベル */}
        {[-5, 0, 5].map((v) => (
          <span
            key={`y-${v}`}
            className="absolute text-[8px] text-white/30 -translate-y-1/2"
            style={{ left: '51%', top: `${((5 - v) / 10) * 100}%` }}
          >
            {v !== 0 ? v : ''}
          </span>
        ))}
      </div>

      {/* 関数カーブ */}
      {curves.map((curve) => (
        <CurveDisplay
          key={curve.id}
          curve={curve}
          isOwn={curve.owner === me.id}
        />
      ))}

      {/* 軌跡プレビュー (actionフェーズのみ) */}
      {trajectories.map((traj) => (
        <TrajectoryTrail
          key={`traj-${traj.bulletId}`}
          trajectory={traj}
          isOwn={traj.owner === me.id}
        />
      ))}

      {/* プレイヤー */}
      <Player position={me.position} facing={me.facing} isMe animating={phase === 'result' || phase === 'resolving'} />
      <Player position={opponent.position} facing={opponent.facing} isMe={false} animating={phase === 'result' || phase === 'resolving'} />

      {/* 弾 */}
      {displayBullets.map((bullet) => (
        <BulletDisplay
          key={bullet.id}
          bullet={bullet}
          isOwn={bullet.owner === me.id}
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
