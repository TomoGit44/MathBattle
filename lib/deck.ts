import type { Card, HandItem } from './types'
import {
  DEFAULT_DECK,
  MIN_DECK_SIZE,
  MAX_DECK_SIZE,
  MAX_SAME_CARD_COUNT,
} from './constants'

// デッキ検証時のサイズ制約。指定なしなら定数を使う。
export interface DeckLimits {
  minDeckSize?: number
  maxDeckSize?: number
}

export const createDefaultDeck = (): Card[] => {
  return DEFAULT_DECK.map((card) => ({ ...card }))
}

const cardKey = (c: Card): string => {
  if (c.type === 'number') return `n:${c.value}`
  if (c.type === 'operator') return `o:${c.operator}`
  return `m:${c.direction}`
}

const isValidCard = (c: unknown): c is Card => {
  if (!c || typeof c !== 'object') return false
  const card = c as { type?: unknown; value?: unknown; operator?: unknown; direction?: unknown }
  if (card.type === 'number') {
    return (
      typeof card.value === 'number' &&
      Number.isInteger(card.value) &&
      card.value >= 0 &&
      card.value <= 9
    )
  }
  if (card.type === 'operator') {
    return card.operator === '+' || card.operator === '-' || card.operator === '×' || card.operator === '÷'
  }
  if (card.type === 'move') {
    return card.direction === 'up' || card.direction === 'down' || card.direction === 'left' || card.direction === 'right'
  }
  return false
}

// 受信したデッキを検証する。失敗時は理由を返す。
export type DeckError =
  | 'too_small'
  | 'too_large'
  | 'too_many_same'
  | 'invalid_card'
  | 'not_array'

export const validateDeck = (deck: unknown, limits?: DeckLimits): DeckError | null => {
  const minSize = limits?.minDeckSize ?? MIN_DECK_SIZE
  const maxSize = limits?.maxDeckSize ?? MAX_DECK_SIZE
  if (!Array.isArray(deck)) return 'not_array'
  if (deck.length < minSize) return 'too_small'
  if (deck.length > maxSize) return 'too_large'

  const counts = new Map<string, number>()
  for (const c of deck) {
    if (!isValidCard(c)) return 'invalid_card'
    const k = cardKey(c)
    const next = (counts.get(k) ?? 0) + 1
    if (next > MAX_SAME_CARD_COUNT) return 'too_many_same'
    counts.set(k, next)
  }
  return null
}

export const deckErrorMessage = (err: DeckError, limits?: DeckLimits): string => {
  const minSize = limits?.minDeckSize ?? MIN_DECK_SIZE
  const maxSize = limits?.maxDeckSize ?? MAX_DECK_SIZE
  switch (err) {
    case 'too_small': return `カードを${minSize}枚以上入れてください`
    case 'too_large': return `カードは${maxSize}枚までです`
    case 'too_many_same': return `同じカードは${MAX_SAME_CARD_COUNT}枚までです`
    case 'invalid_card': return 'デッキに無効なカードが含まれています'
    case 'not_array': return 'デッキ形式が不正です'
  }
}

// 検証済みデッキを返す。無効な場合はデフォルトデッキを返す (サーバーで使用)。
export const sanitizeDeck = (deck: unknown, limits?: DeckLimits): Card[] => {
  if (validateDeck(deck, limits) !== null) return createDefaultDeck()
  return (deck as Card[]).map((c) => ({ ...c }))
}

export const shuffleDeck = (cards: Card[]): Card[] => {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export const drawCards = (
  deck: Card[],
  count: number
): { drawn: Card[]; remaining: Card[] } => {
  const drawn = deck.slice(0, count)
  const remaining = deck.slice(count)
  return { drawn, remaining }
}
