import type { HandItem } from './types'
import { MAX_CALC_CARDS } from './constants'

const getNumericValue = (item: HandItem | undefined): number | null => {
  if (!item) return null
  if (item.type === 'number') return item.value
  if (item.type === 'token') return item.value
  return null
}

const getOperator = (item: HandItem | undefined): string | null => {
  if (!item) return null
  if (item.type === 'operator') return item.operator
  return null
}

// 計算が失敗した理由 (UIで表示できる)
export type CalcError =
  | 'too_few'        // カードが3枚未満
  | 'too_many'       // カードが上限超過
  | 'even_count'     // 偶数枚 (パターン不可)
  | 'bad_index'      // 範囲外/NaN/非整数のインデックス
  | 'duplicate'      // 重複インデックス
  | 'pattern'        // 数字-演算子-数字 の交互でない
  | 'has_infinity'   // 無限カードは計算に使えない
  | 'invalid'        // その他 (NaN等)

export const validateCalculation = (
  hand: HandItem[],
  cardIndices: number[]
): CalcError | null => {
  // 配列でない・要素が無いといった呼び出し側の不具合を防御
  if (!Array.isArray(cardIndices)) return 'invalid'
  if (cardIndices.length < 3) return 'too_few'
  if (cardIndices.length > MAX_CALC_CARDS) return 'too_many'
  if (cardIndices.length % 2 === 0) return 'even_count'

  // インデックスが整数で範囲内であることを厳密に確認
  for (const i of cardIndices) {
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= hand.length) {
      return 'bad_index'
    }
  }

  // 重複チェック
  if (new Set(cardIndices).size !== cardIndices.length) return 'duplicate'

  // 数字-演算子-数字 の交互パターンチェック
  for (let i = 0; i < cardIndices.length; i++) {
    const item = hand[cardIndices[i]]
    if (i % 2 === 0) {
      const v = getNumericValue(item)
      if (v === null) return 'pattern'
      if (!Number.isFinite(v)) return 'has_infinity'
    } else {
      if (getOperator(item) === null) return 'pattern'
    }
  }

  return null
}

export const evaluateCalculation = (items: HandItem[]): number | null => {
  if (!Array.isArray(items) || items.length === 0) return null

  // values と ops の交互列に分解
  const values: number[] = []
  const ops: string[] = []

  const first = getNumericValue(items[0])
  if (first === null) return null
  values.push(first)

  for (let i = 1; i < items.length; i += 2) {
    const op = getOperator(items[i])
    const next = getNumericValue(items[i + 1])
    if (op === null || next === null) return null
    ops.push(op)
    values.push(next)
  }

  // パス1: × と ÷ を左→右で畳み込む
  for (let i = 0; i < ops.length; ) {
    const op = ops[i]
    if (op === '×' || op === '÷') {
      const a = values[i]
      const b = values[i + 1]
      let v: number
      if (op === '×') {
        v = a * b
      } else {
        // 0除算 → 無限大トークンを生成 (この時点で評価を打ち切り Infinity を返す)
        if (b === 0) return Infinity
        v = a / b
      }
      values.splice(i, 2, v)
      ops.splice(i, 1)
    } else {
      i++
    }
  }

  // パス2: + と - を左→右で処理
  let result = values[0]
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    const next = values[i + 1]
    if (op === '+') result += next
    else if (op === '-') result -= next
    else return null
  }

  if (Number.isNaN(result)) return null
  if (!Number.isFinite(result)) return result
  return Math.round(result * 100) / 100
}

// 実行系: 失敗理由を含めて返す
export interface CalcResult {
  ok: true
  newHand: HandItem[]
  resultValue: number
}
export interface CalcFailure {
  ok: false
  reason: CalcError
}

export const tryApplyCalculation = (
  hand: HandItem[],
  cardIndices: number[]
): CalcResult | CalcFailure => {
  try {
    const validationError = validateCalculation(hand, cardIndices)
    if (validationError) return { ok: false, reason: validationError }

    const selectedItems = cardIndices.map((i) => hand[i])
    const result = evaluateCalculation(selectedItems)
    if (result === null) {
      return { ok: false, reason: 'invalid' }
    }

    const newHand = hand.filter((_, i) => !cardIndices.includes(i))
    newHand.push({ type: 'token', value: result })
    return { ok: true, newHand, resultValue: result }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

// 後方互換: 既存呼び出しのため残す。失敗時は null
export const applyCalculation = (
  hand: HandItem[],
  cardIndices: number[]
): HandItem[] | null => {
  const r = tryApplyCalculation(hand, cardIndices)
  return r.ok ? r.newHand : null
}

// エラーメッセージ (日本語)
export const calcErrorMessage = (err: CalcError): string => {
  switch (err) {
    case 'too_few':
      return 'カードを3枚以上選んでください'
    case 'too_many':
      return `カードは最大${MAX_CALC_CARDS}枚まで`
    case 'even_count':
      return 'カード枚数は奇数 (3, 5枚) にしてください'
    case 'bad_index':
      return 'カード選択が不正です'
    case 'duplicate':
      return '同じカードを複数選んでいます'
    case 'pattern':
      return '数字 → 演算 → 数字 の順で並べてください'
    case 'has_infinity':
      return '無限 (∞) は計算に使えません'
    case 'invalid':
      return '計算式が不正です'
  }
}
