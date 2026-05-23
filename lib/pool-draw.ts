// プール抽選エンジン: 毎ターンの補充カードを共通プールから重み付き乱択で決定する。
//
// 仕様:
//   - 各枠 (operator / number / other) は独立した PoolEntry[] を持つ
//   - 各 PoolEntry の実効重みは baseWeight × decayFactor ^ drawCounts[cardKey(card)]
//   - 一度配ったカードは drawCounts が +1 され、次回以降の確率が低下する (永続スタック式)
//   - decayFactor=1 なら減衰なし、decayFactor=0.5 なら配るたび半減
//
// 抽選失敗時 (プール空・全重み0 など) の挙動:
//   - 全重み 0 → baseWeight ベースで再計算 (フォールバック)
//   - プールそのものが空 → null を返す (呼び出し側でスキップ)

import type {
  Card,
  CardKey,
  GameSettings,
  HandItem,
  PoolEntry,
  SlotKind,
} from './types'
import { cardKey } from './types'

const SLOT_ORDER: SlotKind[] = ['operator', 'number', 'other']

// プールから1枚抽選する。drawCounts は加算しない (呼び出し側で行う)。
export const drawOneFromSlot = (
  pool: PoolEntry[],
  drawCounts: Record<CardKey, number>,
  decayFactor: number,
  rng: () => number = Math.random
): { card: Card; key: CardKey } | null => {
  if (!pool || pool.length === 0) return null

  // 1パス目: baseWeight × decayFactor ^ N で実効重みを計算
  const weights: number[] = new Array(pool.length)
  let total = 0
  for (let i = 0; i < pool.length; i++) {
    const entry = pool[i]
    const n = drawCounts[cardKey(entry.card)] ?? 0
    const w = entry.baseWeight * Math.pow(decayFactor, n)
    weights[i] = w
    total += w
  }

  // 全減衰しきった場合のフォールバック: baseWeight だけで再分配
  if (!Number.isFinite(total) || total <= 0) {
    total = 0
    for (let i = 0; i < pool.length; i++) {
      weights[i] = pool[i].baseWeight > 0 ? pool[i].baseWeight : 0
      total += weights[i]
    }
    if (total <= 0) return null
  }

  let r = rng() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) {
      const card: Card = { ...pool[i].card } as Card
      return { card, key: cardKey(card) }
    }
  }
  // 浮動小数誤差で末尾に届かなかった場合のフォールバック
  const last = pool[pool.length - 1].card
  const card: Card = { ...last } as Card
  return { card, key: cardKey(card) }
}

// 指定された枠数 (slots) 分のカードを抽選する共通ロジック。
// drawCounts は新しいオブジェクトを返す (immutable)。
// 枠数が 0 の slot はスキップされる。プール空の slot もスキップ。
export const drawForSlots = (
  settings: GameSettings,
  drawCounts: Record<CardKey, number>,
  slots: Record<SlotKind, number>,
  rng: () => number = Math.random
): { cards: HandItem[]; perSlot: Record<SlotKind, HandItem[]>; drawCounts: Record<CardKey, number> } => {
  const cards: HandItem[] = []
  const perSlot: Record<SlotKind, HandItem[]> = { operator: [], number: [], other: [] }
  const nextCounts: Record<CardKey, number> = { ...drawCounts }

  for (const slot of SLOT_ORDER) {
    const count = slots[slot] ?? 0
    if (count <= 0) continue
    const pool = settings.pools[slot] ?? []
    for (let i = 0; i < count; i++) {
      const drawn = drawOneFromSlot(pool, nextCounts, settings.decayFactor, rng)
      if (!drawn) break
      cards.push(drawn.card)
      perSlot[slot].push(drawn.card)
      // 関数カードだけは確率低下の対象外 (drawCounts を加算しない)。
      // → baseWeight × decayFactor^0 = baseWeight が常に維持され、出現頻度が試合中ずっと一定になる。
      // 他のカード (数字・演算子・移動) は通常通り永続スタック式で減衰する。
      if (drawn.card.type !== 'function') {
        nextCounts[drawn.key] = (nextCounts[drawn.key] ?? 0) + 1
      }
    }
  }

  return { cards, perSlot, drawCounts: nextCounts }
}

// 1ターン分の補充 (settings.slots を使う)
export const drawForTurn = (
  settings: GameSettings,
  drawCounts: Record<CardKey, number>,
  rng: () => number = Math.random
): { cards: HandItem[]; drawCounts: Record<CardKey, number> } => {
  const r = drawForSlots(settings, drawCounts, settings.slots, rng)
  return { cards: r.cards, drawCounts: r.drawCounts }
}

// 試合開始時の初期手札 (settings.initialSlots を使う)
export const drawInitialHand = (
  settings: GameSettings,
  drawCounts: Record<CardKey, number>,
  rng: () => number = Math.random
): { cards: HandItem[]; perSlot: Record<SlotKind, HandItem[]>; drawCounts: Record<CardKey, number> } =>
  drawForSlots(settings, drawCounts, settings.initialSlots, rng)

// 1ターンに補充される総枚数 (枠の合計)
export const totalSlotsPerTurn = (settings: GameSettings): number =>
  SLOT_ORDER.reduce((sum, k) => sum + (settings.slots[k] ?? 0), 0)

// HandLog 用: そのカードがどの slot から来たかを推定する。
// (補充ロジック内で確実な slot 情報を保持できれば不要だが、汎用化のために提供)
// move / function は other 枠扱い。
export const inferSlotOfCard = (card: Card): SlotKind => {
  if (card.type === 'operator') return 'operator'
  if (card.type === 'number') return 'number'
  return 'other'  // move | function
}
