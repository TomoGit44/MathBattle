'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useGameSocket } from '@/hooks/useGameSocket'
import { GameScreen } from '@/components/game/GameScreen'
import { GameOver } from '@/components/game/GameOver'

const GameRoomInner = () => {
  const params = useParams()
  const searchParams = useSearchParams()
  const roomId = params.roomId as string
  const name = searchParams.get('name') ?? 'Player'

  const { gameState, status, error, isWaiting, gameOverWinnerId, sendAction } =
    useGameSocket(roomId, name)

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
        <div className="text-lg text-gray-400">
          ルームID: <span className="text-white font-mono text-2xl">{roomId}</span>
        </div>
        <p className="text-gray-500 text-sm">このIDを対戦相手に共有してください</p>
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
