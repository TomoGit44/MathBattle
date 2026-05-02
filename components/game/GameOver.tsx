'use client'

import { useEffect } from 'react'
import type { ClientGameState } from '@/lib/types'
import { BackgroundGrid } from './BackgroundGrid'
import { shake, flash, hitstop } from '@/lib/effects'

interface GameOverProps {
  gameState: ClientGameState
  winnerId: string | null
  myId: string
}

/**
 * 決着画面: KO / WIN / DRAW のバッジが揺れながら登場 + 背景フラッシュ + 短いシェイク。
 * バッジは Cyberpunk Math 美学に合わせて巨大でネオングロー。
 */
export const GameOver = ({ gameState, winnerId, myId }: GameOverProps) => {
  const isWinner = winnerId === myId
  const isDraw = winnerId === null

  // 入場時に一発だけ:画面シェイク + フラッシュ + ヒットストップ。
  useEffect(() => {
    if (isWinner) {
      hitstop(180)
      flash('rgba(74, 222, 128, 0.30)', 480) // success green flash
      shake(8, 360)
    } else if (isDraw) {
      flash('rgba(250, 204, 21, 0.25)', 380) // warn yellow flash
      shake(4, 240)
    } else {
      hitstop(220)
      flash('rgba(248, 113, 113, 0.45)', 600) // error red flash
      shake(14, 520)
    }
    // 1 度だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // バッジ色とラベル
  const verdict = isDraw
    ? { label: 'DRAW', color: 'var(--color-warn)', glow: 'rgba(250, 204, 21, 0.55)' }
    : isWinner
    ? { label: 'WIN',  color: 'var(--color-success)', glow: 'rgba(74, 222, 128, 0.55)' }
    : { label: 'KO',   color: 'var(--color-error)',   glow: 'rgba(248, 113, 133, 0.55)' }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <BackgroundGrid />

      {/* 背景の演出グロー (verdict 色を radial で薄く) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, ${verdict.glow} 0%, transparent 60%)`,
          animation: 'mb-verdict-bg 800ms var(--ease-out-quart) both',
        }}
      />

      <div className="relative text-center">
        <h1
          className="font-black mb-tabular tracking-[0.4em]"
          style={{
            color: verdict.color,
            fontSize: 'clamp(4rem, 16vw, 9rem)',
            lineHeight: 1,
            textShadow: `0 0 18px ${verdict.glow}, 0 0 48px ${verdict.glow}, 0 0 90px ${verdict.glow}`,
            animation:
              'mb-verdict-in 900ms var(--ease-out-quart) 80ms both',
            willChange: 'transform, opacity',
          }}
        >
          {verdict.label}
        </h1>
        <p
          className="mt-4 text-text-mid text-lg"
          style={{
            animation: 'mb-result-row var(--dur-slow) var(--ease-out-quart) 600ms both',
          }}
        >
          {isDraw ? '引き分け' : isWinner ? '勝利!' : '敗北...'}
        </p>
      </div>

      <div
        className="relative text-text-dim space-y-1 text-center mb-tabular bg-bg-mid/70 border border-line-soft rounded-lg px-5 py-3"
        style={{
          animation: 'mb-result-row var(--dur-slow) var(--ease-out-quart) 800ms both',
        }}
      >
        <div>
          <span className="text-p1 font-bold">{gameState.me.name}</span>: HP {gameState.me.hp}
        </div>
        <div>
          <span className="text-p2 font-bold">{gameState.opponent.name}</span>: HP {gameState.opponent.hp}
        </div>
        <div className="text-sm text-text-faint">ターン {gameState.turn}</div>
      </div>

      <a
        href="/"
        className="relative px-6 py-3 bg-p1-bg hover:bg-p1-deep border border-p1-border/50 text-text rounded-lg font-bold transition-colors duration-[var(--dur-fast)]"
        style={{
          animation: 'mb-result-row var(--dur-slow) var(--ease-out-quart) 1000ms both',
        }}
      >
        ロビーに戻る
      </a>
    </div>
  )
}
