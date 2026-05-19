'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useGameSocket } from '@/hooks/useGameSocket'
import { GameScreen } from '@/components/game/GameScreen'
import { GameOver } from '@/components/game/GameOver'
import { BackgroundGrid } from '@/components/game/BackgroundGrid'

// 接続待ちなどで使うパルスドット (3 つを位相ずらし)
const PulseDots = () => (
  <span aria-hidden className="inline-flex gap-1 ml-1">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-axis-origin"
        style={{
          boxShadow: '0 0 6px var(--color-axis-origin)',
          animation: `mb-dot-pulse 1.05s var(--ease-in-out) ${i * 140}ms infinite`,
        }}
      />
    ))}
  </span>
)

const GameRoomInner = () => {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomId = params.roomId as string
  const name = searchParams.get('name') ?? 'Player'
  const [copied, setCopied] = useState(false)

  const { gameState, status, error, isWaiting, gameOverWinnerId, sendAction } =
    useGameSocket(roomId, name)

  // 決着がついたターンも、まずは弾の物理シミュレーションを GameScreen で再生してから
  // GameOver 画面に遷移する。サーバーは phase='gameover' を turnResult と一緒に送ってくる
  // ため、turnResult の表示 (= settings.animationDurationMs) が終わるまで遷移を遅らせる。
  const [showGameOver, setShowGameOver] = useState(false)
  const animDurationMs = gameState?.settings.animationDurationMs
  useEffect(() => {
    if (gameOverWinnerId === undefined) {
      setShowGameOver(false)
      return
    }
    // turnResult が無いとき (相手切断など) は即時に GameOver へ
    const hasTurnResult = !!gameState?.turnResult?.bulletSnapshots?.length
    if (!hasTurnResult || !animDurationMs) {
      setShowGameOver(true)
      return
    }
    const t = setTimeout(() => setShowGameOver(true), animDurationMs)
    return () => clearTimeout(t)
  }, [gameOverWinnerId, gameState?.turnResult, animDurationMs])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // クリップボードAPI非対応環境では何もしない
    }
  }

  const handleCancel = () => {
    router.push('/')
  }

  if (status === 'connecting') {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen">
        <BackgroundGrid />
        <div className="text-xl text-text-dim flex items-center">
          接続中<PulseDots />
        </div>
      </div>
    )
  }

  if (status === 'disconnected') {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen gap-4">
        <BackgroundGrid />
        <div className="text-xl text-error">接続が切断されました</div>
        <a href="/" className="px-4 py-2 bg-bg-elev hover:bg-bg-mid border border-line text-text-mid rounded-lg transition-colors duration-[var(--dur-fast)]">
          ロビーに戻る
        </a>
      </div>
    )
  }

  if (error) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen gap-4">
        <BackgroundGrid />
        <div className="text-xl text-error">{error}</div>
        <a href="/" className="px-4 py-2 bg-bg-elev hover:bg-bg-mid border border-line text-text-mid rounded-lg transition-colors duration-[var(--dur-fast)]">
          ロビーに戻る
        </a>
      </div>
    )
  }

  if (isWaiting || !gameState) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <BackgroundGrid />
        <div className="text-2xl font-bold text-text flex items-center">
          対戦相手を待っています<PulseDots />
        </div>
        <div className="flex items-center gap-3 text-lg text-text-dim flex-wrap justify-center">
          <span>ルームID:</span>
          <span
            className="text-text font-mono text-3xl mb-tabular tracking-[0.15em] px-3 py-1 rounded-md border border-line-strong bg-bg-mid/70"
            style={{
              textShadow:
                '0 0 8px var(--color-axis-origin), 0 0 18px rgba(103,232,249,0.45)',
            }}
          >
            {roomId}
          </span>
          <button
            onClick={handleCopy}
            className="px-3 py-1 text-sm bg-bg-elev hover:bg-bg-mid border border-line text-text-mid rounded-lg transition-colors duration-[var(--dur-fast)]"
            style={
              copied
                ? {
                    animation: 'mb-copy-flash 380ms var(--ease-back)',
                    color: 'var(--color-success)',
                    borderColor: 'var(--color-op-add-border)',
                  }
                : undefined
            }
          >
            {copied ? 'コピー済み ✓' : 'コピー'}
          </button>
        </div>
        <p className="text-text-faint text-sm">このIDを対戦相手に共有してください</p>
        <button
          onClick={handleCancel}
          className="mt-4 px-4 py-2 bg-bg-elev hover:bg-bg-mid border border-line text-text-mid rounded-lg transition-colors duration-[var(--dur-fast)]"
        >
          キャンセル
        </button>
      </div>
    )
  }

  if (gameOverWinnerId !== undefined && showGameOver) {
    return (
      <GameOver
        gameState={gameState}
        winnerId={gameOverWinnerId}
        myId={gameState.me.id}
      />
    )
  }

  // 決着ターンでも、解決アニメーションが終わるまでは GameScreen を表示する
  return <GameScreen gameState={gameState} sendAction={sendAction} />
}

const GameRoom = () => {
  return (
    <Suspense fallback={
      <div className="relative flex items-center justify-center min-h-screen text-text-dim">
        <BackgroundGrid />
        <span className="flex items-center">読み込み中<PulseDots /></span>
      </div>
    }>
      <GameRoomInner />
    </Suspense>
  )
}

export default GameRoom
