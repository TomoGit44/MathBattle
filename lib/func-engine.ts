import type { HandItem, FunctionExpressionItem, FunctionCurve } from './types'

// 数学的に等価かどうかで2つの式を比較する。
// number と token は値が同じなら同一視する (合成済みトークンも同じ係数なら同じ関数)。
export const expressionsEqual = (
  a: FunctionExpressionItem[],
  b: FunctionExpressionItem[]
): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai.type === 'variable' && bi.type === 'variable') continue
    if ((ai.type === 'number' || ai.type === 'token') && (bi.type === 'number' || bi.type === 'token')) {
      if ((ai.value ?? 0) !== (bi.value ?? 0)) return false
      continue
    }
    if (ai.type === 'operator' && bi.type === 'operator' && ai.operator === bi.operator) continue
    return false
  }
  return true
}

// 同じ式同士をハッシュ的にまとめるためのキー。expressionsEqual と同じ等価関係を表現する。
export const expressionKey = (expr: FunctionExpressionItem[]): string =>
  expr
    .map((it) => {
      if (it.type === 'variable') return 'x'
      if (it.type === 'operator') return `o:${it.operator}`
      // number / token を同一視
      return `n:${it.value ?? 0}`
    })
    .join('|')

let curveIdCounter = 0

/**
 * functionSequence (UIの入力順序) から式の構成要素配列を構築する。
 * cardIndices: 使用する手札のインデックス（出現順）
 * xPositions: 式全体の中で「x」が入る位置（0-indexed）
 */
export const buildFunctionExpression = (
  hand: HandItem[],
  cardIndices: number[],
  xPositions: number[]
): FunctionExpressionItem[] => {
  // 式の全長 = カード数 + x数
  const totalLength = cardIndices.length + xPositions.length
  const xPosSet = new Set(xPositions)

  const expression: FunctionExpressionItem[] = []
  let cardIdx = 0

  for (let i = 0; i < totalLength; i++) {
    if (xPosSet.has(i)) {
      expression.push({ type: 'variable' })
    } else {
      const item = hand[cardIndices[cardIdx]]
      if (!item) return []
      if (item.type === 'number') {
        expression.push({ type: 'number', value: item.value })
      } else if (item.type === 'token') {
        expression.push({ type: 'token', value: item.value })
      } else if (item.type === 'operator') {
        expression.push({ type: 'operator', operator: item.operator })
      }
      cardIdx++
    }
  }

  return expression
}

/**
 * 関数式のバリデーション
 * - 奇数長 ≥ 3
 * - 数値/変数と演算子の交互パターン
 * - xが1つ以上
 * - cardIndicesが手札範囲内・重複なし
 */
export const validateFunctionExpression = (
  hand: HandItem[],
  cardIndices: number[],
  xPositions: number[]
): { valid: boolean; error?: string } => {
  const totalLength = cardIndices.length + xPositions.length

  if (totalLength < 3) {
    return { valid: false, error: '式は最低3要素必要です' }
  }
  if (totalLength % 2 === 0) {
    return { valid: false, error: '式の長さが不正です' }
  }
  if (xPositions.length === 0) {
    return { valid: false, error: 'xが1つ以上必要です' }
  }

  // cardIndices の重複・範囲チェック
  const usedSet = new Set<number>()
  for (const idx of cardIndices) {
    if (idx < 0 || idx >= hand.length) {
      return { valid: false, error: `手札インデックス ${idx} が範囲外です` }
    }
    if (usedSet.has(idx)) {
      return { valid: false, error: `手札インデックス ${idx} が重複しています` }
    }
    const item = hand[idx]
    if (
      (item.type === 'number' || item.type === 'token') &&
      !Number.isFinite(item.value)
    ) {
      return { valid: false, error: '無限 (∞) は関数に使えません' }
    }
    usedSet.add(idx)
  }

  // xPositions の重複・範囲チェック
  const xPosSet = new Set<number>()
  for (const pos of xPositions) {
    if (pos < 0 || pos >= totalLength) {
      return { valid: false, error: `x位置 ${pos} が範囲外です` }
    }
    if (xPosSet.has(pos)) {
      return { valid: false, error: `x位置 ${pos} が重複しています` }
    }
    xPosSet.add(pos)
  }

  // 式を構築して交互パターンをチェック
  const expression = buildFunctionExpression(hand, cardIndices, xPositions)
  if (expression.length !== totalLength) {
    return { valid: false, error: '式の構築に失敗しました' }
  }

  for (let i = 0; i < expression.length; i++) {
    const item = expression[i]
    if (i % 2 === 0) {
      // 偶数位置: 数値 or 変数
      if (item.type !== 'number' && item.type !== 'token' && item.type !== 'variable') {
        return { valid: false, error: `位置 ${i} には数値またはxが必要です` }
      }
    } else {
      // 奇数位置: 演算子
      if (item.type !== 'operator') {
        return { valid: false, error: `位置 ${i} には演算子が必要です` }
      }
    }
  }

  return { valid: true }
}

/**
 * 数値xを代入して式を評価する。
 * × と ÷ を + と - より優先 (通常の数学の優先順位)。同優先度内は左→右。
 * 0除算の場合は null を返す。
 */
export const evaluateFunction = (
  expression: FunctionExpressionItem[],
  x: number
): number | null => {
  if (expression.length === 0) return null

  const getValue = (item: FunctionExpressionItem): number => {
    if (item.type === 'variable') return x
    return item.value ?? 0
  }

  // values と ops の交互列に分解
  const values: number[] = [getValue(expression[0])]
  const ops: string[] = []

  for (let i = 1; i < expression.length; i += 2) {
    const op = expression[i]
    const next = expression[i + 1]
    if (!op || !next || !op.operator) break
    ops.push(op.operator)
    values.push(getValue(next))
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
        if (b === 0) return null
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
  }

  return isFinite(result) ? result : null
}

/**
 * 式の表示文字列を生成する。
 * 例: "f(x) = x×x+3"
 */
export const buildDisplayString = (expression: FunctionExpressionItem[]): string => {
  const parts = expression.map((item) => {
    switch (item.type) {
      case 'variable':
        return 'x'
      case 'number':
      case 'token':
        return String(item.value ?? 0)
      case 'operator':
        return item.operator ?? ''
    }
  })
  return `f(x) = ${parts.join('')}`
}

/**
 * 関数アクションを適用する。
 * 成功時: 手札からカードを消費し、FunctionCurve を返す。
 * 失敗時: null を返す。
 */
export const applyFunction = (
  hand: HandItem[],
  cardIndices: number[],
  xPositions: number[],
  owner: string,
  usesRemaining: number
): { curve: FunctionCurve; newHand: HandItem[] } | null => {
  if (usesRemaining <= 0) return null

  const validation = validateFunctionExpression(hand, cardIndices, xPositions)
  if (!validation.valid) return null

  const expression = buildFunctionExpression(hand, cardIndices, xPositions)
  if (expression.length === 0) return null

  // 式が有効か簡易チェック（x=0で評価してみる）
  // ただし0除算の式でもx=0以外では有効かもしれないので、ここではスキップ

  const displayString = buildDisplayString(expression)

  const curve: FunctionCurve = {
    id: `curve-${Date.now()}-${curveIdCounter++}`,
    owner,
    expression,
    displayString,
  }

  // 手札からカードを消費（インデックスが大きい方から削除）
  const sortedIndices = [...cardIndices].sort((a, b) => b - a)
  const newHand = [...hand]
  for (const idx of sortedIndices) {
    newHand.splice(idx, 1)
  }

  return { curve, newHand }
}
