'use client'

import { useState, useCallback } from 'react'
import type { Action, HandItem } from '@/lib/types'
import { HandDisplay } from './HandDisplay'
import { FunctionPreview, type FunctionSequenceEntry } from './FunctionPreview'

type ActionMode = null | 'move' | 'calculate' | 'attack' | 'function'

interface ActionPanelProps {
  hand: HandItem[]
  onSubmit: (action: Action) => void
  disabled: boolean
  functionUsesRemaining: number
}

export const ActionPanel = ({ hand, onSubmit, disabled, functionUsesRemaining }: ActionPanelProps) => {
  const [mode, setMode] = useState<ActionMode>(null)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [functionSequence, setFunctionSequence] = useState<FunctionSequenceEntry[]>([])

  const reset = useCallback(() => {
    setMode(null)
    setSelectedIndices(new Set())
    setFunctionSequence([])
  }, [])

  const toggleCard = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // 関数モード用: 手札カードを順序付きで追加
  const addHandToSequence = useCallback((index: number) => {
    setFunctionSequence((prev) => [...prev, { type: 'hand', index }])
  }, [])

  const addXToSequence = useCallback(() => {
    setFunctionSequence((prev) => [...prev, { type: 'x' }])
  }, [])

  const removeLastFromSequence = useCallback(() => {
    setFunctionSequence((prev) => prev.slice(0, -1))
  }, [])

  // 関数モードで既に使用済みの手札インデックス
  const usedHandIndices = new Set(
    functionSequence
      .filter((e): e is FunctionSequenceEntry & { type: 'hand' } => e.type === 'hand')
      .map((e) => e.index)
  )

  const submit = useCallback((action: Action) => {
    onSubmit(action)
    setSubmitted(true)
    reset()
  }, [onSubmit, reset])

  // 計算は即時処理。submitted=true にせず、選択だけクリアして連続入力を許可
  const submitCalculate = useCallback(() => {
    if (selectedIndices.size < 3) return
    onSubmit({ type: 'calculate', cardIndices: Array.from(selectedIndices) })
    setSelectedIndices(new Set())
  }, [onSubmit, selectedIndices])

  // 関数式の送信: functionSequenceからcardIndicesとxPositionsに変換
  const submitFunction = useCallback(() => {
    const cardIndices: number[] = []
    const xPositions: number[] = []

    for (let i = 0; i < functionSequence.length; i++) {
      const entry = functionSequence[i]
      if (entry.type === 'x') {
        xPositions.push(i)
      } else {
        cardIndices.push(entry.index)
      }
    }

    submit({ type: 'function', cardIndices, xPositions })
  }, [functionSequence, submit])

  // 関数式バリデーション (簡易)
  const isFunctionValid = (): boolean => {
    if (functionSequence.length < 3) return false
    if (functionSequence.length % 2 === 0) return false
    const hasX = functionSequence.some((e) => e.type === 'x')
    if (!hasX) return false

    // 交互パターンチェック
    for (let i = 0; i < functionSequence.length; i++) {
      const entry = functionSequence[i]
      if (i % 2 === 0) {
        // 偶数位置: 数値 or x
        if (entry.type === 'hand') {
          const item = hand[entry.index]
          if (item?.type === 'operator') return false
        }
        // x は OK
      } else {
        // 奇数位置: 演算子
        if (entry.type === 'x') return false
        if (entry.type === 'hand') {
          const item = hand[entry.index]
          if (item?.type !== 'operator') return false
        }
      }
    }
    return true
  }

  if (submitted || disabled) {
    return (
      <div className="text-center py-4">
        <div className="text-gray-400">
          {submitted ? 'アクション送信済み — 相手を待っています...' : '待機中...'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 手札表示 */}
      {mode !== 'function' ? (
        <HandDisplay
          hand={hand}
          selectedIndices={selectedIndices}
          onToggle={toggleCard}
          selectable={mode === 'calculate' || mode === 'attack'}
        />
      ) : (
        <HandDisplay
          hand={hand}
          selectedIndices={usedHandIndices}
          onToggle={(index) => {
            if (!usedHandIndices.has(index)) {
              addHandToSequence(index)
            }
          }}
          selectable={true}
          disabledIndices={usedHandIndices}
        />
      )}

      {/* モード選択 */}
      {mode === null && (
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3 sm:justify-center">
          <button
            onClick={() => setMode('move')}
            className="px-4 py-3 sm:py-2 bg-cyan-700 active:bg-cyan-800 hover:bg-cyan-600 rounded-lg font-bold transition-colors touch-manipulation"
          >
            移動
          </button>
          <button
            onClick={() => setMode('calculate')}
            className="px-4 py-3 sm:py-2 bg-purple-700 active:bg-purple-800 hover:bg-purple-600 rounded-lg font-bold transition-colors touch-manipulation"
          >
            計算
          </button>
          <button
            onClick={() => setMode('attack')}
            className="px-4 py-3 sm:py-2 bg-red-700 active:bg-red-800 hover:bg-red-600 rounded-lg font-bold transition-colors touch-manipulation"
          >
            攻撃
          </button>
          <button
            onClick={() => setMode('function')}
            disabled={functionUsesRemaining <= 0}
            className="px-4 py-3 sm:py-2 bg-emerald-700 active:bg-emerald-800 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-bold transition-colors touch-manipulation"
          >
            関数 ({functionUsesRemaining})
          </button>
        </div>
      )}

      {/* 移動方向 */}
      {mode === 'move' && (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => submit({ type: 'move', direction: 'up' })}
            className="w-14 h-12 sm:w-12 sm:h-10 bg-cyan-700 active:bg-cyan-800 hover:bg-cyan-600 rounded font-bold text-xl sm:text-base touch-manipulation"
          >
            ↑
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => submit({ type: 'move', direction: 'left' })}
              className="w-14 h-12 sm:w-12 sm:h-10 bg-cyan-700 active:bg-cyan-800 hover:bg-cyan-600 rounded font-bold text-xl sm:text-base touch-manipulation"
            >
              ←
            </button>
            <button
              onClick={reset}
              className="w-14 h-12 sm:w-12 sm:h-10 bg-gray-700 active:bg-gray-800 hover:bg-gray-600 rounded text-sm touch-manipulation"
            >
              戻
            </button>
            <button
              onClick={() => submit({ type: 'move', direction: 'right' })}
              className="w-14 h-12 sm:w-12 sm:h-10 bg-cyan-700 active:bg-cyan-800 hover:bg-cyan-600 rounded font-bold text-xl sm:text-base touch-manipulation"
            >
              →
            </button>
          </div>
          <button
            onClick={() => submit({ type: 'move', direction: 'down' })}
            className="w-14 h-12 sm:w-12 sm:h-10 bg-cyan-700 active:bg-cyan-800 hover:bg-cyan-600 rounded font-bold text-xl sm:text-base touch-manipulation"
          >
            ↓
          </button>
        </div>
      )}

      {/* 計算 (1ターンに何度でも実行可能) */}
      {mode === 'calculate' && (
        <div className="flex flex-col gap-2 items-center">
          <div className="flex gap-2 justify-center items-center">
            <span className="text-sm text-gray-400">カードを選択して計算</span>
            <button
              onClick={submitCalculate}
              disabled={selectedIndices.size < 3}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-bold transition-colors"
            >
              計算実行
            </button>
            <button onClick={reset} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
              他のアクションへ
            </button>
          </div>
          <p className="text-xs text-gray-500">
            計算は1ターンに何度でも実行できます。手札が更新されたら続けて選択可能。
          </p>
        </div>
      )}

      {/* 攻撃 */}
      {mode === 'attack' && (
        <div className="flex gap-2 justify-center items-center">
          <span className="text-sm text-gray-400">数字を1つ選んで発射</span>
          <button
            onClick={() => {
              const idx = Array.from(selectedIndices)[0]
              if (idx !== undefined) {
                const item = hand[idx]
                if (item.type === 'number' || item.type === 'token') {
                  submit({ type: 'attack', handIndex: idx })
                }
              }
            }}
            disabled={selectedIndices.size !== 1}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-bold transition-colors"
          >
            発射!
          </button>
          <button onClick={reset} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
            戻る
          </button>
        </div>
      )}

      {/* 関数 */}
      {mode === 'function' && (
        <div className="space-y-2">
          {/* 式プレビュー */}
          <FunctionPreview sequence={functionSequence} hand={hand} />

          {/* 操作ボタン */}
          <div className="flex gap-2 justify-center items-center flex-wrap">
            <button
              onClick={addXToSequence}
              className="px-3 py-2 bg-amber-700 hover:bg-amber-600 rounded-lg font-bold text-amber-200 transition-colors"
            >
              x
            </button>
            <button
              onClick={removeLastFromSequence}
              disabled={functionSequence.length === 0}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm transition-colors"
            >
              1つ戻す
            </button>
            <button
              onClick={submitFunction}
              disabled={!isFunctionValid()}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-bold transition-colors"
            >
              定義
            </button>
            <button onClick={reset} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
              戻る
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center">
            手札のカードとxを交互に配置して関数を定義 (例: x×x+3)
          </p>
        </div>
      )}
    </div>
  )
}
