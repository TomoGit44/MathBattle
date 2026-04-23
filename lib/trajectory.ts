import type { Bullet, Position } from './types'
import { tickBullets, checkBulletCollisions } from './physics'
import { PHYSICS_TICKS_PER_TURN } from './constants'

export interface TrajectoryPoint {
  position: Position
  value: number
  tick: number
}

export interface BulletTrajectory {
  bulletId: string
  owner: string
  points: TrajectoryPoint[]
  finalPosition: Position
  finalValue: number
}

/**
 * 現在の弾一覧から次ターンの全tick軌跡を予測する。
 * 弾同士の衝突・壁反射・消滅を全て考慮する。
 */
export const predictTrajectories = (
  bullets: Bullet[],
  fieldSize: { width: number; height: number }
): BulletTrajectory[] => {
  if (bullets.length === 0) return []

  // 各弾のtick毎の位置を記録するMap
  const trajectories = new Map<string, TrajectoryPoint[]>()
  for (const b of bullets) {
    trajectories.set(b.id, [{ position: { ...b.position }, value: b.value, tick: 0 }])
  }

  // 物理シミュレーションをコピーして実行
  let simBullets = bullets.map((b) => ({
    ...b,
    position: { ...b.position },
    velocity: { ...b.velocity },
  }))

  for (let tick = 1; tick <= PHYSICS_TICKS_PER_TURN; tick++) {
    simBullets = tickBullets(simBullets, fieldSize)
    simBullets = checkBulletCollisions(simBullets)

    // 生き残った弾の位置を記録
    for (const b of simBullets) {
      const traj = trajectories.get(b.id)
      if (traj) {
        traj.push({ position: { ...b.position }, value: b.value, tick })
      }
    }
  }

  // 結果をまとめる
  const result: BulletTrajectory[] = []
  for (const bullet of bullets) {
    const points = trajectories.get(bullet.id) ?? []
    if (points.length === 0) continue

    const last = points[points.length - 1]
    result.push({
      bulletId: bullet.id,
      owner: bullet.owner,
      points,
      finalPosition: last.position,
      finalValue: last.value,
    })
  }

  return result
}
