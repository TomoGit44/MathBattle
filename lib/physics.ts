import type { Bullet, Position, PlayerState } from './types'
import {
  BASE_BULLET_SPEED,
  SPEED_DECAY_FACTOR,
  BULLET_SIZE,
  PLAYER_SIZE,
  WALL_REFLECTION_BONUS,
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

export const tickBullets = (
  bullets: Bullet[],
  fieldSize: { width: number; height: number }
): Bullet[] => {
  const result: Bullet[] = []

  for (const bullet of bullets) {
    let { x, y } = bullet.position
    let { dx, dy } = bullet.velocity
    let { reflections, value } = bullet

    x += dx
    y += dy

    // 壁反射判定
    let reflected = false

    if (x - BULLET_SIZE <= 0) {
      x = BULLET_SIZE
      dx = Math.abs(dx)
      reflected = true
    } else if (x + BULLET_SIZE >= fieldSize.width) {
      x = fieldSize.width - BULLET_SIZE
      dx = -Math.abs(dx)
      reflected = true
    }

    if (y - BULLET_SIZE <= 0) {
      y = BULLET_SIZE
      dy = Math.abs(dy)
      reflected = true
    } else if (y + BULLET_SIZE >= fieldSize.height) {
      y = fieldSize.height - BULLET_SIZE
      dy = -Math.abs(dy)
      reflected = true
    }

    if (reflected) {
      reflections++
      value += WALL_REFLECTION_BONUS
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

export const checkBulletCollisions = (bullets: Bullet[]): Bullet[] => {
  const alive = new Set(bullets.map((_, i) => i))
  const replacements = new Map<number, Bullet>()

  for (let i = 0; i < bullets.length; i++) {
    if (!alive.has(i)) continue
    for (let j = i + 1; j < bullets.length; j++) {
      if (!alive.has(j)) continue

      const a = replacements.get(i) ?? bullets[i]
      const b = replacements.get(j) ?? bullets[j]

      // 味方弾同士はすり抜ける
      if (a.owner === b.owner) continue

      const dist = Math.sqrt(
        (a.position.x - b.position.x) ** 2 +
        (a.position.y - b.position.y) ** 2
      )

      if (dist < BULLET_SIZE * 2) {
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
          // a はそのまま (alive に残す、値変化なし)
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
  }

  return Array.from(alive).map((i) => replacements.get(i) ?? bullets[i])
}

export const checkPlayerHits = (
  bullets: Bullet[],
  players: Record<string, PlayerState>
): { bullets: Bullet[]; damages: Record<string, number> } => {
  const damages: Record<string, number> = {}
  const remaining: Bullet[] = []

  for (const bullet of bullets) {
    let hit = false
    for (const [playerId, player] of Object.entries(players)) {
      // 自分の弾は自分に当たらない
      if (bullet.owner === playerId) continue

      const dist = Math.sqrt(
        (bullet.position.x - player.position.x) ** 2 +
        (bullet.position.y - player.position.y) ** 2
      )

      if (dist < PLAYER_SIZE + BULLET_SIZE) {
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
