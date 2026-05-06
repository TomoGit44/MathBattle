'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Action, ClientGameState, Position } from '@/lib/types'
import { GameField } from './GameField'
import { HpBar } from './HpBar'
import { ActionPanel } from './ActionPanel'
import { OpponentInfo } from './OpponentInfo'
import { TurnResult } from './TurnResult'
import { ActionLog, type LogEntry } from './ActionLog'
import { LowHpVignette } from './LowHpVignette'
import { MAX_HAND_SIZE, INITIAL_HP } from '@/lib/constants'

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
  const { me, opponent, phase, turn, turnResult, fieldSize, settings } = gameState
  const [actionKey, setActionKey] = useState(0)
  const [actionLog, setActionLog] = useState<LogEntry[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [movePreviewIndex, setMovePreviewIndex] = useState<number | null>(null)

  // アクションフェーズが変わるたびにActionPanelをリセット
  useEffect(() => {
    if (phase === 'action') {
      setActionKey((k) => k + 1)
    }
    // フェーズが action 以外になったらゴーストも消す
    if (phase !== 'action') setMovePreviewIndex(null)
  }, [phase, turn])

  // 移動プレビュー → クランプ済み目的地を計算
  const movePreviewDestination: Position | null = useMemo(() => {
    if (movePreviewIndex == null) return null
    const card = me.hand[movePreviewIndex]
    if (!card || card.type !== 'move') return null
    let { x, y } = me.position
    const d = settings.moveDistance
    if (card.direction === 'up') y -= d
    else if (card.direction === 'down') y += d
    else if (card.direction === 'left') x -= d
    else if (card.direction === 'right') x += d
    const r = settings.playerRadius
    return {
      x: Math.max(r, Math.min(fieldSize.width - r, x)),
      y: Math.max(r, Math.min(fieldSize.height - r, y)),
    }
  }, [movePreviewIndex, me.hand, me.position, settings.moveDistance, settings.playerRadius, fieldSize])

  const handleMovePreview = useCallback((index: number | null) => {
    setMovePreviewIndex(index)
  }, [])

  // 新ターンの結果を見たらログに追記 (ターン番号で重複防止)
  useEffect(() => {
    if (!turnResult) return
    if (phase !== 'result' && phase !== 'gameover') return
    setActionLog((prev) => {
      if (prev.some((e) => e.turn === turn)) return prev
      return [
        ...prev,
        {
          turn,
          result: turnResult,
          playerNames: { [me.id]: me.name, [opponent.id]: opponent.name },
        },
      ]
    })
  }, [phase, turn, turnResult, me.id, me.name, opponent.id, opponent.name])

  return (
    <div className="flex flex-col items-center min-h-[100dvh] p-2 sm:p-4 gap-2 sm:gap-3 max-w-3xl mx-auto">
      {/* ヘッダー: ターン情報 (HPバーの左右はフィールド上の出現位置に合わせる) */}
      <div className="flex items-center justify-between w-full">
        {me.facing === 'right' ? (
          <>
            <HpBar name={me.name} hp={me.hp} isMe />
            <div className="text-center">
              <div className="text-xs text-text-faint mb-tabular">Turn {turn}</div>
              <div className="text-sm font-bold text-warn">{phaseLabel(phase)}</div>
            </div>
            <HpBar name={opponent.name} hp={opponent.hp} isMe={false} />
          </>
        ) : (
          <>
            <HpBar name={opponent.name} hp={opponent.hp} isMe={false} />
            <div className="text-center">
              <div className="text-xs text-text-faint mb-tabular">Turn {turn}</div>
              <div className="text-sm font-bold text-warn">{phaseLabel(phase)}</div>
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
      <GameField
        gameState={gameState}
        movePreview={
          phase === 'action' && movePreviewDestination
            ? { from: me.position, to: movePreviewDestination }
            : null
        }
      />

      {/* ターン結果 (素数合成時はaction中でも演出表示) */}
      {turnResult &&
        (phase === 'result' ||
          phase === 'resolving' ||
          Object.keys(turnResult.primeSynthesis ?? {}).length > 0) && (
          <TurnResult turnResult={turnResult} meId={me.id} turn={turn} />
        )}

      {/* アクションパネル */}
      <div className="w-full">
        <ActionPanel
          key={actionKey}
          hand={me.hand}
          onSubmit={sendAction}
          disabled={phase !== 'action'}
          functionUsesRemaining={me.functionUsesRemaining}
          settings={settings}
          onMovePreview={handleMovePreview}
        />
      </div>

      {/* 自分の情報 + ログボタン */}
      <div className="w-full flex items-center justify-between gap-2 text-xs text-text-faint mb-tabular">
        <span>
          手札: <span className={me.hand.length >= MAX_HAND_SIZE ? 'text-error font-bold' : ''}>{me.hand.length}/{MAX_HAND_SIZE}</span>枚 / デッキ残: {me.deckRemaining}枚 / 関数残: {me.functionUsesRemaining}回
        </span>
        <button
          onClick={() => setLogOpen(true)}
          className="px-2 py-1 rounded border border-line bg-bg-mid hover:bg-bg-elev text-text-mid text-xs flex items-center gap-1 transition-colors duration-[var(--dur-fast)]"
          aria-label="アクションログを開く"
        >
          📜 ログ
          {actionLog.length > 0 && (
            <span className="text-[10px] text-text-dim">({actionLog.length})</span>
          )}
        </button>
      </div>

      <ActionLog log={actionLog} open={logOpen} onClose={() => setLogOpen(false)} />

      {/* 低 HP 警告ビネット (画面全体): HP 25% 以下で表示 */}
      {me.hp > 0 && me.hp <= INITIAL_HP * 0.25 && (
        <LowHpVignette
          intensity={Math.max(0.3, 1 - me.hp / (INITIAL_HP * 0.25))}
        />
      )}
    </div>
  )
}
