// アイテム関連: スポーン / 弾衝突 / カーブダメージ / 接触拾得
// アイテムは静止オブジェクト。両プレイヤーが攻撃可能で、最後にHPを0にした側が
// その演算子カードを獲得する。プレイヤーが触れた場合も即時に拾得できる。
import type { Bullet, FieldItem, GameSettings, HandItem, ItemKind, PlayerState, Position } from './types'
import { INITIAL_HP, ITEM_CORNER_RADIUS, ITEM_HP_MAX, ITEM_HP_MIN, ITEM_SPAWN_X_HALF_WIDTH, MAX_HAND_SIZE } from './constants'
import { pointInRoundedRect, segmentHitsRoundedRect } from './physics'
import { isPrimeBullet } from './prime'
import { sampleCurve } from './curve-collision'
import type { FunctionCurve } from './types'

const ITEM_KINDS: ItemKind[] = ['+', '-', '×', '÷', 'pack', 'heal']

let itemIdCounter = 0
const nextItemId = () => `item-${Date.now()}-${itemIdCounter++}`

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

// pack の枚数 (4種演算子)
const PACK_OPERATORS: ('+' | '-' | '×' | '÷')[] = ['+', '-', '×', '÷']

// 種別ごとの絶対確率から発火するか / どの種別かを決める。
// 合計 > 1 のときは均等に縮約。
const pickKindByRates = (rates: Record<ItemKind, number>): ItemKind | null => {
  const entries = ITEM_KINDS.map((k) => [k, Math.max(0, rates[k] ?? 0)] as const)
  let total = entries.reduce((s, [, r]) => s + r, 0)
  if (total <= 0) return null

  let scale = 1
  if (total > 1) {
    scale = 1 / total
    total = 1
  }

  const r = Math.random()
  if (r >= total) return null
  let acc = 0
  for (const [kind, rate] of entries) {
    acc += rate * scale
    if (r < acc) return kind
  }
  return entries[entries.length - 1][0]
}

// 1ターンに1回呼ばれ、確率でアイテムを1つ生成して返す。
// 生成しなかった場合は null。
export const trySpawnItem = (
  items: FieldItem[],
  fieldSize: { width: number; height: number },
  settings: GameSettings
): FieldItem | null => {
  if (items.length >= settings.maxItems) return null

  const kind = pickKindByRates(settings.itemSpawnRates)
  if (!kind) return null

  const hp = randInt(ITEM_HP_MIN, ITEM_HP_MAX)

  const radius = settings.itemSize / 2
  const centerX = fieldSize.width / 2
  const minX = centerX - ITEM_SPAWN_X_HALF_WIDTH + radius
  const maxX = centerX + ITEM_SPAWN_X_HALF_WIDTH - radius
  const minY = radius
  const maxY = fieldSize.height - radius

  const x = minX + Math.random() * Math.max(0, maxX - minX)
  const y = minY + Math.random() * Math.max(0, maxY - minY)

  return {
    id: nextItemId(),
    kind,
    position: { x, y },
    hp,
    maxHp: hp,
    size: settings.itemSize,
  }
}

export interface ItemKill {
  itemId: string
  kind: ItemKind
  killerId: string
}

// 弾とアイテムの衝突判定。tickBullets / checkBulletCollisions / checkPlayerHits の後に呼ぶ。
// - 通常弾: ヒットでアイテムHPを value だけ減らし、弾は消滅
// - 素数弾: 同様にHPを減らすが、弾は貫通 (位置・速度変わらず)
// - HPが0以下になったらアイテムは消滅し、そのHitを与えた弾の owner が killer になる
// 同tick内で1つの弾は最大1アイテムにヒットする (素数弾は複数ヒットOK)
export const checkBulletItemCollisions = (
  bullets: Bullet[],
  prevBulletPositions: Map<string, Position>,
  items: FieldItem[],
  settings: GameSettings
): { bullets: Bullet[]; items: FieldItem[]; kills: ItemKill[] } => {
  if (items.length === 0) return { bullets, items, kills: [] }

  // 可変コピー (HPを減らしていく)
  const itemMap = new Map<string, FieldItem>(items.map((i) => [i.id, { ...i }]))
  const remainingBullets: Bullet[] = []
  const kills: ItemKill[] = []

  for (const bullet of bullets) {
    const bulletPrev = prevBulletPositions.get(bullet.id) ?? bullet.position
    const bulletPrime = isPrimeBullet(bullet.value)

    let nonPrimeConsumed = false

    for (const item of itemMap.values()) {
      if (item.hp <= 0) continue

      // アイテムは角丸正方形。弾(円)の経路 vs (アイテム角丸矩形 ⊕ 弾半径) で判定。
      const halfSize = item.size / 2
      const hw = halfSize + settings.bulletRadius
      const hh = halfSize + settings.bulletRadius
      const cr = ITEM_CORNER_RADIUS + settings.bulletRadius
      if (
        !segmentHitsRoundedRect(bulletPrev, bullet.position, item.position, hw, hh, cr)
      ) {
        continue
      }

      // ヒット: 弾の値だけHPを減らす
      item.hp -= bullet.value
      if (item.hp <= 0 && !kills.find((k) => k.itemId === item.id)) {
        kills.push({ itemId: item.id, kind: item.kind, killerId: bullet.owner })
      }

      if (!bulletPrime) {
        // 通常弾は消滅
        nonPrimeConsumed = true
        break
      }
      // 素数弾は貫通 → 同tick中に他のアイテムにも当たり得る
    }

    if (!nonPrimeConsumed) {
      remainingBullets.push(bullet)
    }
  }

  const remainingItems = Array.from(itemMap.values()).filter((i) => i.hp > 0)
  return { bullets: remainingBullets, items: remainingItems, kills }
}

// 関数カーブとアイテムの衝突判定。ターン終了時に1回だけ呼ぶ。
// 自分の曲線でも相手の曲線でも (アイテムは中立)、曲線にかかっているアイテムはダメージを受ける。
// HPが0以下になったらアイテムは消滅し、ダメージを与えた曲線の owner が killer。
// 複数の曲線が同一アイテムにかかる場合、合計ダメージで判定する。最後に当たった曲線の owner が killer になる。
export const applyCurveDamageToItems = (
  curves: FunctionCurve[],
  items: FieldItem[],
  fnDamage: number,
  settings: GameSettings
): { items: FieldItem[]; kills: ItemKill[] } => {
  if (curves.length === 0 || items.length === 0) return { items, kills: [] }

  const itemMap = new Map<string, FieldItem>(items.map((i) => [i.id, { ...i }]))
  const kills: ItemKill[] = []

  for (const curve of curves) {
    const sampled = sampleCurve(curve, settings)
    if (sampled.length === 0) continue

    for (const item of itemMap.values()) {
      if (item.hp <= 0) continue
      const halfSize = item.size / 2
      const hit = sampled.some((pt) =>
        pointInRoundedRect(pt, item.position, halfSize, halfSize, ITEM_CORNER_RADIUS)
      )
      if (hit) {
        item.hp -= fnDamage
        if (item.hp <= 0 && !kills.find((k) => k.itemId === item.id)) {
          kills.push({ itemId: item.id, kind: item.kind, killerId: curve.owner })
        }
      }
    }
  }

  const remainingItems = Array.from(itemMap.values()).filter((i) => i.hp > 0)
  return { items: remainingItems, kills }
}

export interface ItemPickup {
  itemId: string
  kind: ItemKind
  pickerId: string
  awardedCount: number
}

// アイテム種別と現在の手札から、付与する演算子カードのリストを返す。
// pack は4種、heal はカード無し、それ以外は対応する1種。手札の空きを超えない範囲。
export const cardsForItemKind = (kind: ItemKind, currentHandLen: number): HandItem[] => {
  if (kind === 'heal') return []
  const room = Math.max(0, MAX_HAND_SIZE - currentHandLen)
  if (room === 0) return []
  if (kind === 'pack') {
    return PACK_OPERATORS.slice(0, room).map((op) => ({ type: 'operator', operator: op }))
  }
  return [{ type: 'operator', operator: kind }]
}

// アイテムの報酬をプレイヤーに適用する。返り値の awardedCount の意味は種別による:
// - 演算子 / pack: 手札に追加できたカードの枚数 (0..1 / 0..4)
// - heal: 実際に回復したHP量 (0..healAmountMax)
// 何も適用できなかった場合 (手札満杯 / HP満タン) は awardedCount=0 で
// 呼び出し側はアイテムを残置/ドロップ判定する。
export const applyItemReward = (
  player: PlayerState,
  kind: ItemKind,
  settings: GameSettings
): { player: PlayerState; awardedCount: number } => {
  if (kind === 'heal') {
    if (player.hp <= 0) return { player, awardedCount: 0 }
    if (player.hp >= INITIAL_HP) return { player, awardedCount: 0 }
    const min = Math.max(0, Math.floor(settings.healAmountMin))
    const max = Math.max(min, Math.floor(settings.healAmountMax))
    const rolled = max <= 0 ? 0 : randInt(min, max)
    if (rolled <= 0) return { player, awardedCount: 0 }
    const newHp = Math.min(INITIAL_HP, player.hp + rolled)
    const actual = newHp - player.hp
    if (actual <= 0) return { player, awardedCount: 0 }
    return { player: { ...player, hp: newHp }, awardedCount: actual }
  }
  const cards = cardsForItemKind(kind, player.hand.length)
  if (cards.length === 0) return { player, awardedCount: 0 }
  return {
    player: { ...player, hand: [...player.hand, ...cards] },
    awardedCount: cards.length,
  }
}

// プレイヤー位置とアイテムの接触判定。プレイヤーは円 (半径 settings.playerRadius)、
// アイテムは角丸正方形として扱う。重なっているアイテムは即時に拾得され、報酬を適用する
// (演算子はカード追加、heal はHP回復)。報酬を1つも適用できない場合 (手札満杯 / HP満タン)
// はアイテムをフィールドに残す。
export const pickupItemsForPlayer = (
  player: PlayerState,
  items: FieldItem[],
  settings: GameSettings
): { items: FieldItem[]; player: PlayerState; pickups: ItemPickup[] } => {
  if (items.length === 0) return { items, player, pickups: [] }

  const remaining: FieldItem[] = []
  const pickups: ItemPickup[] = []
  let current = player

  for (const item of items) {
    const halfSize = item.size / 2
    const hw = halfSize + settings.playerRadius
    const hh = halfSize + settings.playerRadius
    const cr = ITEM_CORNER_RADIUS + settings.playerRadius
    const touching = pointInRoundedRect(current.position, item.position, hw, hh, cr)

    if (!touching) {
      remaining.push(item)
      continue
    }

    const { player: nextPlayer, awardedCount } = applyItemReward(current, item.kind, settings)
    if (awardedCount <= 0) {
      // 報酬を1つも適用できない (手札満杯 / HP満タン) → アイテムを残置
      remaining.push(item)
      continue
    }

    current = nextPlayer
    pickups.push({ itemId: item.id, kind: item.kind, pickerId: current.id, awardedCount })
  }

  return { items: remaining, player: current, pickups }
}
