import type { HandItem } from './types'
import { MAX_CALC_CARDS } from './constants'

const getNumericValue = (item: HandItem): number | null => {
  if (item.type === 'number') return item.value
  if (item.type === 'token') return item.value
  return null
}

const getOperator = (item: HandItem): string | null => {
  if (item.type === 'operator') return item.operator
  return null
}

export const validateCalculation = (
  hand: HandItem[],
  cardIndices: number[]
): boolean => {
  if (cardIndices.length < 3) return false
  if (cardIndices.length > MAX_CALC_CARDS) return false
  if (cardIndices.length % 2 === 0) return false

  // インデックスの範囲チェック
  if (cardIndices.some((i) => i < 0 || i >= hand.length)) return false

  // 重複チェック
  if (new Set(cardIndices).size !== cardIndices.length) return false

  // 数字-演算子-数字 の交互パターンチェック
  for (let i = 0; i < cardIndices.length; i++) {
    const item = hand[cardIndices[i]]
    if (i % 2 === 0) {
      if (getNumericValue(item) === null) return false
    } else {
      if (getOperator(item) === null) return false
    }
  }

  return true
}

export const evaluateCalculation = (items: HandItem[]): number | null => {
  if (items.length === 0) return null

  let result = getNumericValue(items[0])
  if (result === null) return null

  for (let i = 1; i < items.length; i += 2) {
    const op = getOperator(items[i])
    const next = getNumericValue(items[i + 1])
    if (op === null || next === null) return null

    switch (op) {
      case '+':
        result += next
        break
      case '-':
        result -= next
        break
      case '×':
        result *= next
        break
      case '÷':
        if (next === 0) return null
        result /= next
        break
      default:
        return null
    }
  }

  if (!Number.isFinite(result)) return null
  return Math.round(result * 100) / 100
}

export const applyCalculation = (
  hand: HandItem[],
  cardIndices: number[]
): HandItem[] | null => {
  if (!validateCalculation(hand, cardIndices)) return null

  const selectedItems = cardIndices.map((i) => hand[i])
  const result = evaluateCalculation(selectedItems)
  if (result === null) return null

  // 使用したカードを除去し、結果トークンを追加
  const newHand = hand.filter((_, i) => !cardIndices.includes(i))
  newHand.push({ type: 'token', value: result })
  return newHand
}
