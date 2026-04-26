'use client'

import { useState, useEffect } from 'react'
import type { Action, ClientGameState } from '@/lib/types'
import { GameField } from './GameField'
import { HpBar } from './HpBar'
import { ActionPanel } from './ActionPanel'
import { OpponentInfo } from './OpponentInfo'
import { TurnResult } from './TurnResult'

interface GameScreenProps {
  gameState: ClientGameState
  sendAction: (action: Action) => void
}

const phaseLabel = (phase: string): string => {
  switch (phase) {
    case 'draw': return 'ドローフェーズ'
    case 'action': return 'アクション選択'
    case 'resolving': return '解決中...'
    case 'result': return 'ターン結果'
    default: return phase
  }
}

export const GameScreen = ({ gameState, sendAction }: GameScreenProps) => {
  const { me, opponent, phase, turn, turnResult } = gameState
  const [actionKey, setActionKey] = useState(0)

  // アクションフェーズが変わるたびにActionPanelをリセット
  useEffect(() => {
    if (phase === 'action') {
      setActionKey((k) => k + 1)
    }
  }, [phase, turn])

  return (
    <div className="flex flex-col items-center min-h-[100dvh] p-2 sm:p-4 gap-2 sm:gap-3 max-w-3xl mx-auto">
      {/* ヘッダー: ターン情報 (HPバーの左右はフィールド上の出現位置に合わせる) */}
      <div className="flex items-center justify-between w-full">
        {me.facing === 'right' ? (
          <>
            <HpBar name={me.name} hp={me.hp} isMe />
            <div className="text-center">
              <div className="text-xs text-gray-500">Turn {turn}</div>
              <div className="text-sm font-bold text-yellow-400">{phaseLabel(phase)}</div>
            </div>
            <HpBar name={opponent.name} hp={opponent.hp} isMe={false} />
          </>
        ) : (
          <>
            <HpBar name={opponent.name} hp={opponent.hp} isMe={false} />
            <div className="text-center">
              <div className="text-xs text-gray-500">Turn {turn}</div>
              <div className="text-sm font-bold text-yellow-400">{phaseLabel(phase)}</div>
            </div>
            <HpBar name={me.name} hp={me.hp} isMe />
          </>
        )}
      </div>

      {/* 相手情報 (相手のフィールド側に寄せる) */}
      <div className={`flex w-full ${me.facing === 'right' ? 'justify-end' : 'justify-start'}`}>
        <OpponentInfo opponent={opponent} />
      </div>

      {/* フィールド */}
      <GameField gameState={gameState} />

      {/* ターン結果 (素数合成時はaction中でも演出表示) */}
      {turnResult &&
        (phase === 'result' ||
          phase === 'resolving' ||
          Object.keys(turnResult.primeSynthesis ?? {}).length > 0) && (
          <TurnResult turnResult={turnResult} />
        )}

      {/* アクションパネル */}
      <div className="w-full">
        <ActionPanel
          key={actionKey}
          hand={me.hand}
          onSubmit={sendAction}
          disabled={phase !== 'action'}
          functionUsesRemaining={me.functionUsesRemaining}
          hasMoved={me.hasMovedThisTurn}
        />
      </div>

      {/* 自分の情報 */}
      <div className="text-xs text-gray-500">
        手札: {me.hand.length}枚 / デッキ残: {me.deckRemaining}枚 / 関数残: {me.functionUsesRemaining}回
      </div>
    </div>
  )
}
