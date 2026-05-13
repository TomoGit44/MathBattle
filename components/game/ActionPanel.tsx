'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Action, HandItem, GameSettings, Direction } from '@/lib/types'
import { HandDisplay } from './HandDisplay'
import { FunctionPreview, type FunctionSequenceEntry } from './FunctionPreview'
import { CalculationPreview } from './CalculationPreview'
import { validateCalculation, calcErrorMessage } from '@/lib/calc-engine'
import { FIELD_WIDTH, FIELD_HEIGHT } from '@/lib/constants'

type ActionMode = null | 'calculate' | 'attack' | 'function' | 'move'

interface ActionPanelProps {
  hand: HandItem[]
  onSubmit: (action: Action) => void
  disabled: boolean
  functionUsesRemaining: number
  settings: GameSettings
  onMovePreview?: (handIndex: number | null) => void
  /** 玉が飛行中のカードインデックス (HandDisplay に透過) */
  pendingCardIndices?: Set<number>
  /** 玉が着地して入場演出中のカードインデックス */
  arrivingCardIndices?: Set<number>
}

const dirArrow = (d: Direction): string =>
  ({ up: '↑', down: '↓', left: '←', right: '→' }[d])

const dirLabel = (d: Direction): string =>
  ({ up: '上', down: '下', left: '左', right: '右' }[d])

export const ActionPanel = ({ hand, onSubmit, disabled, functionUsesRemaining, settings, onMovePreview, pendingCardIndices, arrivingCardIndices }: ActionPanelProps) => {
  const [mode, setMode] = useState<ActionMode>(null)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [functionSequence, setFunctionSequence] = useState<FunctionSequenceEntry[]>([])
  const [movePreviewIndex, setMovePreviewIndex] = useState<number | null>(null)

  // 親に preview 状態を通知 (フィールド上のゴースト表示用)
  useEffect(() => {
    onMovePreview?.(movePreviewIndex)
  }, [movePreviewIndex, onMovePreview])

  const reset = useCallback(() => {
    setMode(null)
    setSelectedIndices(new Set())
    setFunctionSequence([])
    setMovePreviewIndex(null)
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

  // 移動カード使用は即時処理 (ターン終了しない・回数制限なし)
  // クリックでまずプレビュー → ユーザー確定で送信
  const startMovePreview = useCallback((index: number) => {
    setMode('move')
    setMovePreviewIndex(index)
  }, [])

  const confirmMoveCard = useCallback(() => {
    if (movePreviewIndex == null) return
    const card = hand[movePreviewIndex]
    if (!card || card.type !== 'move') return
    onSubmit({ type: 'use_move_card', handIndex: movePreviewIndex })
    reset()
  }, [movePreviewIndex, hand, onSubmit, reset])

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

  // 関数式バリデーション。null = OK、それ以外は表示用のエラーメッセージ。
  // 入力途中 (空・短すぎ) はメッセージを出さず無効化のみ。x 抜け等は具体的に案内する。
  const functionError = (): { silent: true } | { message: string } | null => {
    if (functionSequence.length === 0) return { silent: true }
    if (functionSequence.length < 3) return { message: '式は最低3要素必要です' }
    if (functionSequence.length % 2 === 0) return { message: '式の長さが不正です (奇数枚にしてください)' }

    const hasX = functionSequence.some((e) => e.type === 'x')
    if (!hasX) return { message: 'x を使用してください (例: x+1)' }

    // 交互パターンチェック
    for (let i = 0; i < functionSequence.length; i++) {
      const entry = functionSequence[i]
      if (i % 2 === 0) {
        if (entry.type === 'hand') {
          const item = hand[entry.index]
          if (item?.type === 'operator') return { message: `${i + 1}番目は数値かxにしてください` }
        }
      } else {
        if (entry.type === 'x') return { message: `${i + 1}番目は演算子にしてください` }
        if (entry.type === 'hand') {
          const item = hand[entry.index]
          if (item?.type !== 'operator') return { message: `${i + 1}番目は演算子にしてください` }
        }
      }
    }
    return null
  }

  const fnErr = functionError()
  const isFunctionValid = fnErr === null

  // 関数モードで「次に置けるトークン」の種別。偶数位置=値(数値/x)、奇数位置=演算子。
  const nextSlotKind: 'value' | 'operator' =
    functionSequence.length % 2 === 0 ? 'value' : 'operator'

  // 関数モードで無効化する手札インデックス:
  //   - すでに使用済み
  //   - 次に置けるトークン種別と合わない (operator スロットに数値、value スロットに演算子)
  //   - 無限 (∞) は関数では使えない (サーバーも拒否する)
  //   - 移動カードも関数では使えない
  const fnDisabledIndices = useMemo(() => {
    const set = new Set(usedHandIndices)
    hand.forEach((item, idx) => {
      if (set.has(idx)) return
      if (item.type === 'move') {
        set.add(idx)
        return
      }
      const isValue = item.type === 'number' || item.type === 'token'
      const isInfinity = isValue && !Number.isFinite(item.value)
      if (isInfinity) {
        set.add(idx)
        return
      }
      if (nextSlotKind === 'value' && item.type === 'operator') set.add(idx)
      if (nextSlotKind === 'operator' && isValue) set.add(idx)
    })
    return set
  }, [hand, usedHandIndices, nextSlotKind])

  // 移動カード以外を無効化したインデックス集合 (null モードで使用)
  const nonMoveDisabledIndices = useMemo(() => {
    const set = new Set<number>()
    hand.forEach((item, idx) => {
      if (item.type !== 'move') set.add(idx)
    })
    return set
  }, [hand])

  // 移動カードを無効化したインデックス集合 (calculate/attack モードで使用)
  const moveDisabledIndices = useMemo(() => {
    const set = new Set<number>()
    hand.forEach((item, idx) => {
      if (item.type === 'move') set.add(idx)
    })
    return set
  }, [hand])

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
      {mode === null && (
        <HandDisplay
          hand={hand}
          selectedIndices={new Set()}
          onToggle={(index) => {
            if (nonMoveDisabledIndices.has(index)) return
            startMovePreview(index)
          }}
          selectable={true}
          disabledIndices={nonMoveDisabledIndices}
          pendingIndices={pendingCardIndices}
          arrivingIndices={arrivingCardIndices}
        />
      )}
      {mode === 'move' && (
        <HandDisplay
          hand={hand}
          selectedIndices={movePreviewIndex != null ? new Set([movePreviewIndex]) : new Set()}
          onToggle={(index) => {
            if (nonMoveDisabledIndices.has(index)) return
            // 別の移動カードに切替
            setMovePreviewIndex(index)
          }}
          selectable={true}
          disabledIndices={nonMoveDisabledIndices}
          pendingIndices={pendingCardIndices}
          arrivingIndices={arrivingCardIndices}
        />
      )}
      {(mode === 'calculate' || mode === 'attack') && (
        <HandDisplay
          hand={hand}
          selectedIndices={selectedIndices}
          onToggle={(index) => {
            if (moveDisabledIndices.has(index)) return
            toggleCard(index)
          }}
          selectable={true}
          disabledIndices={moveDisabledIndices}
          pendingIndices={pendingCardIndices}
          arrivingIndices={arrivingCardIndices}
        />
      )}
      {mode === 'function' && (
        <HandDisplay
          hand={hand}
          selectedIndices={usedHandIndices}
          onToggle={(index) => {
            if (fnDisabledIndices.has(index)) return
            addHandToSequence(index)
          }}
          selectable={true}
          disabledIndices={fnDisabledIndices}
          pendingIndices={pendingCardIndices}
          arrivingIndices={arrivingCardIndices}
        />
      )}

      {/* 移動プレビュー (確定するまで実際には動かない) */}
      {mode === 'move' && (() => {
        const card = movePreviewIndex != null ? hand[movePreviewIndex] : null
        const direction = card?.type === 'move' ? card.direction : null
        const distPx = settings.moveDistance
        const isVertical = direction === 'up' || direction === 'down'
        const axisMax = isVertical ? settings.mathYMax : settings.mathXMax
        const fieldSpan = isVertical ? FIELD_HEIGHT : FIELD_WIDTH
        const distMath = (distPx * (2 * axisMax)) / fieldSpan
        return (
          <div className="flex flex-col gap-2 items-center">
            <div className="flex gap-2 justify-center items-center flex-wrap">
              <span className="text-sm text-text-dim">
                {direction ? (
                  <>
                    <span className="text-axis-origin font-bold text-lg align-middle">
                      {dirArrow(direction)}
                    </span>{' '}
                    {dirLabel(direction)}に <span className="font-bold text-text">{distMath.toFixed(2)}</span>
                    <span className="text-text-faint"> 単位</span>
                    <span className="text-text-faint"> ({distPx}px)</span>
                    {' '}移動
                  </>
                ) : (
                  '移動カードを選択'
                )}
              </span>
              <button
                onClick={confirmMoveCard}
                disabled={movePreviewIndex == null}
                className="px-4 py-2 bg-axis-origin/20 active:bg-axis-origin/30 hover:bg-axis-origin/30 border border-axis-origin/50 text-axis-origin disabled:bg-bg-elev disabled:text-text-mute disabled:border-line rounded-lg font-bold transition-colors duration-[var(--dur-fast)] touch-manipulation"
              >
                移動を確定
              </button>
              <button
                onClick={reset}
                className="px-3 py-2 bg-bg-elev active:bg-bg-mid hover:bg-bg-mid border border-line text-text-mid rounded-lg text-sm touch-manipulation transition-colors duration-[var(--dur-fast)]"
              >
                キャンセル
              </button>
            </div>
            <p className="text-xs text-text-faint text-center">
              フィールド上のゴーストが移動先。別の方向カードをクリックで切替できます。
            </p>
          </div>
        )
      })()}

      {/* メインアクション選択。移動カードは手札からクリックでプレビュー → 確定で実行 (回数制限なし)。 */}
      {mode === null && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs text-text-faint">移動は手札の矢印カードをクリック (プレビュー → 確定)</div>
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
          <CalculationPreview hand={hand} selectedIndices={Array.from(selectedIndices)} />
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
              disabled={nextSlotKind === 'operator'}
              className="px-3 py-2 bg-op-sub-bg hover:bg-op-sub-bg/70 disabled:bg-bg-elev disabled:text-text-mute disabled:border-line border border-op-sub-border/50 rounded-lg font-bold text-op-sub transition-colors duration-[var(--dur-fast)]"
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
              disabled={!isFunctionValid}
              className="px-4 py-2 bg-op-add-bg hover:bg-op-add-bg/70 border border-op-add-border/50 text-op-add disabled:bg-bg-elev disabled:text-text-mute disabled:border-line rounded-lg font-bold transition-colors duration-[var(--dur-fast)]"
            >
              定義
            </button>
            <button onClick={reset} className="px-3 py-2 bg-bg-elev hover:bg-bg-mid border border-line text-text-mid rounded-lg text-sm transition-colors duration-[var(--dur-fast)]">
              戻る
            </button>
          </div>
          {fnErr && 'message' in fnErr && (
            <p className="text-xs text-warn bg-bg-mid border border-line-strong rounded px-2 py-1 text-center">
              ⚠ {fnErr.message}
            </p>
          )}
          <p className="text-xs text-text-faint text-center">
            手札のカードとxを交互に配置して関数を定義 (例: x×x+3)
          </p>
        </div>
      )}
    </div>
  )
}
