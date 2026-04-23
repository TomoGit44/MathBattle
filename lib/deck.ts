import type { Card, HandItem } from './types'
import { DEFAULT_DECK } from './constants'

export const createDefaultDeck = (): Card[] => {
  return DEFAULT_DECK.map((card) => ({ ...card }))
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
