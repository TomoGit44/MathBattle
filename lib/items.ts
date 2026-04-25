// アイテム関連: スポーン / 弾衝突 / カーブダメージ
// アイテムは静止オブジェクト。両プレイヤーが攻撃可能で、最後にHPを0にした側が
// その演算子カードを獲得する。
import type { Bullet, FieldItem, GameSettings, ItemKind, Position } from './types'
import { ITEM_HP_MAX, ITEM_HP_MIN, ITEM_SPAWN_X_HALF_WIDTH } from './constants'
import { sweptCirclesOverlap } from './physics'
import { isPrimeBullet } from './prime'
import { sampleCurve, isPlayerOnCurve } from './curve-collision'
import type { FunctionCurve } from './types'

const ITEM_KINDS: ItemKind[] = ['+', '-', '×', '÷']

let itemIdCounter = 0
const nextItemId = () => `item-${Date.now()}-${itemIdCounter++}`

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

// 1ターンに1回呼ばれ、確率でアイテムを1つ生成して返す。
// 生成しなかった場合は null。
export const trySpawnItem = (
  items: FieldItem[],
  fieldSize: { width: number; height: number },
  settings: GameSettings
): FieldItem | null => {
  if (items.length >= settings.maxItems) return null
  if (Math.random() >= settings.itemSpawnRate) return null

  const kind = ITEM_KINDS[Math.floor(Math.random() * ITEM_KINDS.length)]
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

      const collisionDist = settings.bulletRadius + item.size / 2
      // 静止アイテム: b0 = b1 = item.position
      if (
        !sweptCirclesOverlap(bulletPrev, bullet.position, item.position, item.position, collisionDist)
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
      if (isPlayerOnCurve(item.position, sampled)) {
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
