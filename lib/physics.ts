import type { Bullet, Position, PlayerState, GameSettings } from './types'
import {
  BASE_BULLET_SPEED,
  SPEED_DECAY_FACTOR,
  MAX_REFLECTIONS,
} from './constants'
import { isPrimeBullet } from './prime'

let bulletIdCounter = 0

const calcSpeed = (value: number): number => {
  return BASE_BULLET_SPEED / (1 + Math.abs(value) * SPEED_DECAY_FACTOR)
}

export const createBullet = (
  owner: string,
  position: Position,
  facing: 'left' | 'right',
  value: number
): Bullet => {
  const speed = calcSpeed(value)
  const dx = facing === 'right' ? speed : -speed
  return {
    id: `bullet-${Date.now()}-${bulletIdCounter++}`,
    owner,
    value,
    position: { x: position.x, y: position.y },
    velocity: { dx, dy: 0 },
    reflections: 0,
  }
}

// --- 連続衝突判定 (Swept Circle vs Swept Circle) ---
// A(t) = a0 + t*(a1-a0), B(t) = b0 + t*(b1-b0), t∈[0,1]
// |A(t)-B(t)|^2 - r^2 が [0,1] で 0 以下になるかを解析的に判定。
// プレイヤー判定では B が静止なので b1 = b0 を渡す。
export const sweptCirclesOverlap = (
  a0: Position,
  a1: Position,
  b0: Position,
  b1: Position,
  collisionDist: number
): boolean => {
  const dx = a0.x - b0.x
  const dy = a0.y - b0.y
  const vx = (a1.x - a0.x) - (b1.x - b0.x)
  const vy = (a1.y - a0.y) - (b1.y - b0.y)
  const r2 = collisionDist * collisionDist

  // f(t) = A*t^2 + B*t + C  ここで f(t) ≤ 0 ⇔ overlap
  const A = vx * vx + vy * vy
  const B = 2 * (dx * vx + dy * vy)
  const C = dx * dx + dy * dy - r2

  if (C <= 0) return true        // t=0 時点で既に重なっている
  if (A === 0) return false      // 相対運動なし → 重なり距離は変化せず

  // 最小値は t* = -B/(2A) で発生 (放物線の頂点)
  const tStar = -B / (2 * A)
  const t = Math.max(0, Math.min(1, tStar))
  const minVal = A * t * t + B * t + C
  return minVal <= 0
}

export const tickBullets = (
  bullets: Bullet[],
  fieldSize: { width: number; height: number },
  settings: GameSettings
): Bullet[] => {
  const result: Bullet[] = []
  const r = settings.bulletRadius

  for (const bullet of bullets) {
    let { x, y } = bullet.position
    let { dx, dy } = bullet.velocity
    let { reflections, value } = bullet

    x += dx
    y += dy

    // 壁反射判定
    let reflected = false

    if (x - r <= 0) {
      x = r
      dx = Math.abs(dx)
      reflected = true
    } else if (x + r >= fieldSize.width) {
      x = fieldSize.width - r
      dx = -Math.abs(dx)
      reflected = true
    }

    if (y - r <= 0) {
      y = r
      dy = Math.abs(dy)
      reflected = true
    } else if (y + r >= fieldSize.height) {
      y = fieldSize.height - r
      dy = -Math.abs(dy)
      reflected = true
    }

    if (reflected) {
      reflections++
      value += settings.wallReflectionBonus
      // 反射で速度再計算 (方向は維持)
      const newSpeed = calcSpeed(value)
      const oldSpeed = Math.sqrt(dx * dx + dy * dy)
      if (oldSpeed > 0) {
        dx = (dx / oldSpeed) * newSpeed
        dy = (dy / oldSpeed) * newSpeed
      }
    }

    if (reflections > MAX_REFLECTIONS) continue

    result.push({
      ...bullet,
      value,
      position: { x, y },
      velocity: { dx, dy },
      reflections,
    })
  }

  return result
}

// 弾同士の衝突判定。tickBullets 後に呼ぶ。
// prevPositions: 各弾の tick 前の位置 (ID → Position)。
// 連続判定により、弾同士がすり抜けるケースを防ぐ。
export const checkBulletCollisions = (
  bullets: Bullet[],
  prevPositions: Map<string, Position>,
  settings: GameSettings
): Bullet[] => {
  const alive = new Set(bullets.map((_, i) => i))
  const replacements = new Map<number, Bullet>()
  const collisionDist = settings.bulletRadius * 2

  for (let i = 0; i < bullets.length; i++) {
    if (!alive.has(i)) continue
    for (let j = i + 1; j < bullets.length; j++) {
      if (!alive.has(j)) continue

      const a = replacements.get(i) ?? bullets[i]
      const b = replacements.get(j) ?? bullets[j]

      // 味方弾同士はすり抜ける
      if (a.owner === b.owner) continue

      const aPrev = prevPositions.get(a.id) ?? a.position
      const bPrev = prevPositions.get(b.id) ?? b.position

      // pre→post の線分同士で連続衝突判定
      if (!sweptCirclesOverlap(aPrev, a.position, bPrev, b.position, collisionDist)) continue

      const aPrime = isPrimeBullet(a.value)
      const bPrime = isPrimeBullet(b.value)

      if (aPrime && bPrime) {
        // 素数弾同士はすり抜ける (何も起きない)
        continue
      }
      if (aPrime && !bPrime) {
        // 素数弾aは貫通。相手bは a.value だけ削られる
        const newB = b.value - a.value
        if (newB <= 0) {
          alive.delete(j)
        } else {
          replacements.set(j, { ...b, value: newB })
        }
        continue
      }
      if (!aPrime && bPrime) {
        // 素数弾bは貫通。相手aは b.value だけ削られる
        const newA = a.value - b.value
        if (newA <= 0) {
          alive.delete(i)
        } else {
          replacements.set(i, { ...a, value: newA })
        }
        continue
      }

      // 通常: 大小相殺
      if (a.value === b.value) {
        alive.delete(i)
        alive.delete(j)
      } else if (a.value > b.value) {
        alive.delete(j)
        replacements.set(i, { ...a, value: a.value - b.value })
      } else {
        alive.delete(i)
        replacements.set(j, { ...b, value: b.value - a.value })
      }
    }
  }

  return Array.from(alive).map((i) => replacements.get(i) ?? bullets[i])
}

// プレイヤーへのヒット判定。プレイヤーは物理tick中は静止のため b0 = b1。
export const checkPlayerHits = (
  bullets: Bullet[],
  prevPositions: Map<string, Position>,
  players: Record<string, PlayerState>,
  settings: GameSettings
): { bullets: Bullet[]; damages: Record<string, number> } => {
  const damages: Record<string, number> = {}
  const remaining: Bullet[] = []
  const hitDist = settings.playerRadius + settings.bulletRadius

  for (const bullet of bullets) {
    let hit = false
    const bulletPrev = prevPositions.get(bullet.id) ?? bullet.position

    for (const [playerId, player] of Object.entries(players)) {
      // 自分の弾は自分に当たらない
      if (bullet.owner === playerId) continue

      // プレイヤーは静止 → b0 = b1 = player.position
      if (
        sweptCirclesOverlap(
          bulletPrev,
          bullet.position,
          player.position,
          player.position,
          hitDist
        )
      ) {
        damages[playerId] = (damages[playerId] ?? 0) + bullet.value
        hit = true
        break
      }
    }
    if (!hit) {
      remaining.push(bullet)
    }
  }

  return { bullets: remaining, damages }
}
