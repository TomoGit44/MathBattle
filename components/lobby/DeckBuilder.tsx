'use client'

import { useMemo } from 'react'
import type { Card } from '@/lib/types'
import { createDefaultDeck, validateDeck, deckErrorMessage } from '@/lib/deck'
import { MIN_DECK_SIZE, MAX_DECK_SIZE, MAX_SAME_CARD_COUNT } from '@/lib/constants'

interface DeckBuilderProps {
  deck: Card[]
  onChange: (deck: Card[]) => void
  // サーバーから取得した制限値。未指定なら定数(デフォルト)を使う
  minDeckSize?: number
  maxDeckSize?: number
}

const NUMBER_PALETTE: Card[] = Array.from({ length: 10 }, (_, i) => ({ type: 'number', value: i }))
const OPERATOR_PALETTE: Card[] = [
  { type: 'operator', operator: '+' },
  { type: 'operator', operator: '-' },
  { type: 'operator', operator: '×' },
  { type: 'operator', operator: '÷' },
]
const MOVE_PALETTE: Card[] = [
  { type: 'move', direction: 'up' },
  { type: 'move', direction: 'down' },
  { type: 'move', direction: 'left' },
  { type: 'move', direction: 'right' },
]

const dirArrow = (d: 'up' | 'down' | 'left' | 'right') =>
  ({ up: '↑', down: '↓', left: '←', right: '→' }[d])

const cardLabel = (c: Card): string => {
  if (c.type === 'number') return String(c.value)
  if (c.type === 'operator') return c.operator
  return dirArrow(c.direction)
}
const cardKey = (c: Card): string => {
  if (c.type === 'number') return `n:${c.value}`
  if (c.type === 'operator') return `o:${c.operator}`
  return `m:${c.direction}`
}

const cardClass = (c: Card, dim?: boolean): string => {
  const base =
    'w-10 h-12 sm:w-11 sm:h-14 rounded-lg border-2 flex items-center justify-center font-bold text-base mb-tabular ' +
    'transition-[transform,border-color,background-color,box-shadow] duration-[var(--dur-fast)] ' +
    'hover:-translate-y-[1px] active:translate-y-[1px] cursor-pointer touch-manipulation'
  const tone =
    c.type === 'number'
      ? 'border-p1-deep bg-p1-bg text-p1 hover:border-p1'
      : c.type === 'operator'
      ? 'border-op-mul-border bg-op-mul-bg text-op-mul hover:border-op-mul'
      : 'border-axis-origin/50 bg-bg-elev text-axis-origin text-xl hover:border-axis-origin'
  return `${base} ${tone} ${dim ? 'opacity-40 cursor-not-allowed' : ''}`
}

export const DeckBuilder = ({
  deck,
  onChange,
  minDeckSize = MIN_DECK_SIZE,
  maxDeckSize = MAX_DECK_SIZE,
}: DeckBuilderProps) => {
  const limits = useMemo(() => ({ minDeckSize, maxDeckSize }), [minDeckSize, maxDeckSize])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of deck) m.set(cardKey(c), (m.get(cardKey(c)) ?? 0) + 1)
    return m
  }, [deck])

  const validationError = useMemo(() => validateDeck(deck, limits), [deck, limits])

  const addCard = (c: Card) => {
    if (deck.length >= maxDeckSize) return
    if ((counts.get(cardKey(c)) ?? 0) >= MAX_SAME_CARD_COUNT) return
    onChange([...deck, { ...c }])
  }

  const removeAt = (index: number) => {
    onChange(deck.filter((_, i) => i !== index))
  }

  const reset = () => onChange(createDefaultDeck())
  const clear = () => onChange([])

  return (
    <div className="space-y-3 bg-bg-mid/50 border border-line rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-text-mid">デッキ構築</h3>
        <span
          className={`text-xs mb-tabular ${
            validationError ? 'text-warn' : 'text-success'
          }`}
        >
          {deck.length} / {maxDeckSize} 枚
        </span>
      </div>

      {/* 現在のデッキ */}
      <div className="min-h-[3.5rem] flex flex-wrap gap-1.5 p-2 bg-bg-deep border border-line-soft rounded">
        {deck.length === 0 ? (
          <span className="text-text-faint text-xs self-center mx-auto">カードを下から選んでください</span>
        ) : (
          deck.map((c, i) => (
            <button
              key={`${cardKey(c)}-${i}`}
              onClick={() => removeAt(i)}
              className={cardClass(c)}
              title="クリックで削除"
            >
              {cardLabel(c)}
            </button>
          ))
        )}
      </div>

      {validationError && (
        <p className="text-xs text-warn">⚠ {deckErrorMessage(validationError, limits)}</p>
      )}

      {/* 数字パレット */}
      <div>
        <div className="text-xs text-text-faint mb-1">数字</div>
        <div className="flex flex-wrap gap-1.5">
          {NUMBER_PALETTE.map((c) => {
            const used = counts.get(cardKey(c)) ?? 0
            const full = used >= MAX_SAME_CARD_COUNT || deck.length >= maxDeckSize
            return (
              <button
                key={cardKey(c)}
                onClick={() => addCard(c)}
                disabled={full}
                className={cardClass(c, full)}
                title={`残り ${MAX_SAME_CARD_COUNT - used} 枚追加可`}
              >
                {cardLabel(c)}
              </button>
            )
          })}
        </div>
      </div>

      {/* 演算子パレット */}
      <div>
        <div className="text-xs text-text-faint mb-1">演算子</div>
        <div className="flex flex-wrap gap-1.5">
          {OPERATOR_PALETTE.map((c) => {
            const used = counts.get(cardKey(c)) ?? 0
            const full = used >= MAX_SAME_CARD_COUNT || deck.length >= maxDeckSize
            return (
              <button
                key={cardKey(c)}
                onClick={() => addCard(c)}
                disabled={full}
                className={cardClass(c, full)}
                title={`残り ${MAX_SAME_CARD_COUNT - used} 枚追加可`}
              >
                {cardLabel(c)}
              </button>
            )
          })}
        </div>
      </div>

      {/* 移動カードパレット */}
      <div>
        <div className="text-xs text-text-faint mb-1">移動 (4方向)</div>
        <div className="flex flex-wrap gap-1.5">
          {MOVE_PALETTE.map((c) => {
            const used = counts.get(cardKey(c)) ?? 0
            const full = used >= MAX_SAME_CARD_COUNT || deck.length >= maxDeckSize
            return (
              <button
                key={cardKey(c)}
                onClick={() => addCard(c)}
                disabled={full}
                className={cardClass(c, full)}
                title={`残り ${MAX_SAME_CARD_COUNT - used} 枚追加可`}
              >
                {cardLabel(c)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={clear}
          className="px-3 py-1.5 text-xs bg-bg-elev hover:bg-bg-mid border border-line text-text-mid rounded-md transition-colors duration-[var(--dur-fast)]"
        >
          全削除
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 text-xs bg-bg-elev hover:bg-bg-mid border border-line text-text-mid rounded-md transition-colors duration-[var(--dur-fast)]"
        >
          デフォルトに戻す
        </button>
      </div>

      <p className="text-[10px] text-text-faint">
        {minDeckSize}〜{maxDeckSize} 枚 / 同じカードは {MAX_SAME_CARD_COUNT} 枚まで。
        数字カードと移動カード (4方向) はターン開始時に自動補充されます。
      </p>
    </div>
  )
}
