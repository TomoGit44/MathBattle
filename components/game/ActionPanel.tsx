'use client'

import { useState, useCallback } from 'react'
import type { Action, HandItem } from '@/lib/types'
import { HandDisplay } from './HandDisplay'
import { FunctionPreview, type FunctionSequenceEntry } from './FunctionPreview'
import { validateCalculation, calcErrorMessage } from '@/lib/calc-engine'

type ActionMode = null | 'calculate' | 'attack' | 'function'

interface ActionPanelProps {
  hand: HandItem[]
  onSubmit: (action: Action) => void
  disabled: boolean
  functionUsesRemaining: number
  hasMoved: boolean
}

export const ActionPanel = ({ hand, onSubmit, disabled, functionUsesRemaining, hasMoved }: ActionPanelProps) => {
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

  // 移動 / skip_move は即時処理 (ターン終了しない)
  const submitImmediate = useCallback((action: Action) => {
    onSubmit(action)
    reset()
  }, [onSubmit, reset])

  // 計算は即時処理。submitted=true にせず、選択だけクリアして連続入力を許可
  const submitCalculate = useCallback(() => {
    const indices = Array.from(selectedIndices)
    if (validateCalculation(hand, indices) !== null) return
    onSubmit({ type: 'calculate', cardIndices: indices })
    setSelectedIndices(new Set())
  }, [onSubmit, selectedIndices, hand])

  // 現在の選択状態に対する計算バリデーション結果 (UI制御用)
  const calcValidationError =
    mode === 'calculate' && selectedIndices.size > 0
      ? validateCalculation(hand, Array.from(selectedIndices))
      : null

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
        <div className="text-text-dim">
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

      {/* 第1段階: 移動フェーズ (必須・毎ターン1回) */}
      {!hasMoved && mode === null && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm text-axis-origin font-bold">ステップ 1: 移動</div>
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => submitImmediate({ type: 'move', direction: 'up' })}
              className="w-14 h-12 sm:w-12 sm:h-10 bg-p1-deep/80 active:bg-p1-deep hover:bg-p1-deep border border-p1-border/40 text-text rounded font-bold text-xl sm:text-base touch-manipulation transition-colors duration-[var(--dur-fast)]"
            >
              ↑
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => submitImmediate({ type: 'move', direction: 'left' })}
                className="w-14 h-12 sm:w-12 sm:h-10 bg-p1-deep/80 active:bg-p1-deep hover:bg-p1-deep border border-p1-border/40 text-text rounded font-bold text-xl sm:text-base touch-manipulation transition-colors duration-[var(--dur-fast)]"
              >
                ←
              </button>
              <button
                onClick={() => submitImmediate({ type: 'skip_move' })}
                className="w-14 h-12 sm:w-12 sm:h-10 bg-bg-elev active:bg-bg-mid hover:bg-bg-mid border border-line text-text-mid rounded text-[10px] leading-tight touch-manipulation transition-colors duration-[var(--dur-fast)]"
              >
                移動<br />しない
              </button>
              <button
                onClick={() => submitImmediate({ type: 'move', direction: 'right' })}
                className="w-14 h-12 sm:w-12 sm:h-10 bg-p1-deep/80 active:bg-p1-deep hover:bg-p1-deep border border-p1-border/40 text-text rounded font-bold text-xl sm:text-base touch-manipulation transition-colors duration-[var(--dur-fast)]"
              >
                →
              </button>
            </div>
            <button
              onClick={() => submitImmediate({ type: 'move', direction: 'down' })}
              className="w-14 h-12 sm:w-12 sm:h-10 bg-p1-deep/80 active:bg-p1-deep hover:bg-p1-deep border border-p1-border/40 text-text rounded font-bold text-xl sm:text-base touch-manipulation transition-colors duration-[var(--dur-fast)]"
            >
              ↓
            </button>
          </div>
        </div>
      )}

      {/* 第2段階: メインアクション選択 */}
      {hasMoved && mode === null && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm text-warn font-bold">ステップ 2: アクション</div>
          <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3 sm:justify-center">
            <button
              onClick={() => setMode('calculate')}
              className="px-4 py-3 sm:py-2 bg-op-mul-bg active:bg-op-mul-bg/70 hover:bg-op-mul-bg/70 border border-op-mul-border/50 text-op-mul rounded-lg font-bold transition-colors duration-[var(--dur-fast)] touch-manipulation"
            >
              計算
            </button>
            <button
              onClick={() => setMode('attack')}
              className="px-4 py-3 sm:py-2 bg-p2-bg active:bg-p2-bg/70 hover:bg-p2-bg/70 border border-p2-border/50 text-p2 rounded-lg font-bold transition-colors duration-[var(--dur-fast)] touch-manipulation"
            >
              攻撃
            </button>
            <button
              onClick={() => setMode('function')}
              disabled={functionUsesRemaining <= 0}
              className="px-4 py-3 sm:py-2 bg-op-add-bg active:bg-op-add-bg/70 hover:bg-op-add-bg/70 border border-op-add-border/50 text-op-add disabled:bg-bg-elev disabled:text-text-mute disabled:border-line rounded-lg font-bold transition-colors duration-[var(--dur-fast)] touch-manipulation"
            >
              関数 ({functionUsesRemaining})
            </button>
            <button
              onClick={() => submit({ type: 'skip' })}
              className="px-4 py-3 sm:py-2 bg-bg-elev active:bg-bg-mid hover:bg-bg-mid border border-line text-text-mid rounded-lg font-bold transition-colors duration-[var(--dur-fast)] touch-manipulation"
            >
              スキップ
            </button>
          </div>
        </div>
      )}

      {/* 計算 (1ターンに何度でも実行可能) */}
      {mode === 'calculate' && (
        <div className="flex flex-col gap-2 items-center">
          <div className="flex gap-2 justify-center items-center flex-wrap">
            <span className="text-sm text-text-dim">カードを選択して計算</span>
            <button
              onClick={submitCalculate}
              disabled={calcValidationError !== null || selectedIndices.size === 0}
              className="px-4 py-2 bg-op-mul-bg active:bg-op-mul-bg/70 hover:bg-op-mul-bg/70 border border-op-mul-border/50 text-op-mul disabled:bg-bg-elev disabled:text-text-mute disabled:border-line rounded-lg font-bold transition-colors duration-[var(--dur-fast)] touch-manipulation"
            >
              計算実行
            </button>
            <button
              onClick={reset}
              className="px-3 py-2 bg-bg-elev active:bg-bg-mid hover:bg-bg-mid border border-line text-text-mid rounded-lg text-sm touch-manipulation transition-colors duration-[var(--dur-fast)]"
            >
              他のアクションへ
            </button>
          </div>
          {calcValidationError && (
            <p className="text-xs text-warn bg-bg-mid border border-line-strong rounded px-2 py-1">
              ⚠ {calcErrorMessage(calcValidationError)}
            </p>
          )}
          <p className="text-xs text-text-faint text-center">
            選択した順番で計算されます (例: 3 → + → 7)。1ターンに何度でも実行可能。
          </p>
        </div>
      )}

      {/* 攻撃 */}
      {mode === 'attack' && (
        <div className="flex gap-2 justify-center items-center">
          <span className="text-sm text-text-dim">数字を1つ選んで発射</span>
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
            className="px-4 py-2 bg-p2-bg active:bg-p2-bg/70 hover:bg-p2-bg/70 border border-p2-border/50 text-p2 disabled:bg-bg-elev disabled:text-text-mute disabled:border-line rounded-lg font-bold transition-colors duration-[var(--dur-fast)]"
          >
            発射!
          </button>
          <button onClick={reset} className="px-3 py-2 bg-bg-elev hover:bg-bg-mid border border-line text-text-mid rounded-lg text-sm transition-colors duration-[var(--dur-fast)]">
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
              className="px-3 py-2 bg-op-sub-bg hover:bg-op-sub-bg/70 border border-op-sub-border/50 rounded-lg font-bold text-op-sub transition-colors duration-[var(--dur-fast)]"
            >
              x
            </button>
            <button
              onClick={removeLastFromSequence}
              disabled={functionSequence.length === 0}
              className="px-3 py-2 bg-bg-elev hover:bg-bg-mid disabled:bg-bg-deep disabled:text-text-mute border border-line text-text-mid rounded-lg text-sm transition-colors duration-[var(--dur-fast)]"
            >
              1つ戻す
            </button>
            <button
              onClick={submitFunction}
              disabled={!isFunctionValid()}
              className="px-4 py-2 bg-op-add-bg hover:bg-op-add-bg/70 border border-op-add-border/50 text-op-add disabled:bg-bg-elev disabled:text-text-mute disabled:border-line rounded-lg font-bold transition-colors duration-[var(--dur-fast)]"
            >
              定義
            </button>
            <button onClick={reset} className="px-3 py-2 bg-bg-elev hover:bg-bg-mid border border-line text-text-mid rounded-lg text-sm transition-colors duration-[var(--dur-fast)]">
              戻る
            </button>
          </div>
          <p className="text-xs text-text-faint text-center">
            手札のカードとxを交互に配置して関数を定義 (例: x×x+3)
          </p>
        </div>
      )}
    </div>
  )
}
