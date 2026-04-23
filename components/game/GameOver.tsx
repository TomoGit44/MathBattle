import type { ClientGameState } from '@/lib/types'

interface GameOverProps {
  gameState: ClientGameState
  winnerId: string | null
  myId: string
}

export const GameOver = ({ gameState, winnerId, myId }: GameOverProps) => {
  const isWinner = winnerId === myId
  const isDraw = winnerId === null

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <div className="text-center">
        {isDraw ? (
          <h1 className="text-4xl font-bold text-yellow-400">引き分け!</h1>
        ) : isWinner ? (
          <h1 className="text-4xl font-bold text-green-400">勝利!</h1>
        ) : (
          <h1 className="text-4xl font-bold text-red-400">敗北...</h1>
        )}
      </div>

      <div className="text-gray-400 space-y-1 text-center">
        <div>{gameState.me.name}: HP {gameState.me.hp}</div>
        <div>{gameState.opponent.name}: HP {gameState.opponent.hp}</div>
        <div className="text-sm">ターン {gameState.turn}</div>
      </div>

      <a
        href="/"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors"
      >
        ロビーに戻る
      </a>
    </div>
  )
}
