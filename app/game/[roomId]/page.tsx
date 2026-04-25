'use client'

import { Suspense, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useGameSocket } from '@/hooks/useGameSocket'
import { GameScreen } from '@/components/game/GameScreen'
import { GameOver } from '@/components/game/GameOver'

const GameRoomInner = () => {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomId = params.roomId as string
  const name = searchParams.get('name') ?? 'Player'
  const [copied, setCopied] = useState(false)

  const { gameState, status, error, isWaiting, gameOverWinnerId, sendAction } =
    useGameSocket(roomId, name)

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
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-xl text-gray-400">接続中...</div>
      </div>
    )
  }

  if (status === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-xl text-red-400">接続が切断されました</div>
        <a href="/" className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">
          ロビーに戻る
        </a>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-xl text-red-400">{error}</div>
        <a href="/" className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">
          ロビーに戻る
        </a>
      </div>
    )
  }

  if (isWaiting || !gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-2xl font-bold">対戦相手を待っています...</div>
        <div className="flex items-center gap-3 text-lg text-gray-400">
          <span>ルームID:</span>
          <span className="text-white font-mono text-2xl">{roomId}</span>
          <button
            onClick={handleCopy}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
          >
            {copied ? 'コピー済み ✓' : 'コピー'}
          </button>
        </div>
        <p className="text-gray-500 text-sm">このIDを対戦相手に共有してください</p>
        <button
          onClick={handleCancel}
          className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
        >
          キャンセル
        </button>
      </div>
    )
  }

  if (gameOverWinnerId !== undefined) {
    return (
      <GameOver
        gameState={gameState}
        winnerId={gameOverWinnerId}
        myId={gameState.me.id}
      />
    )
  }

  return <GameScreen gameState={gameState} sendAction={sendAction} />
}

const GameRoom = () => {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">読み込み中...</div>}>
      <GameRoomInner />
    </Suspense>
  )
}

export default GameRoom
