import type { FunctionCurve, Position } from './types'
import { evaluateFunction } from './func-engine'
import { mathToPixelX, mathToPixelY } from './coordinates'
import {
  CURVE_SAMPLE_COUNT,
  CURVE_COLLISION_THRESHOLD,
  MATH_X_MIN,
  MATH_X_MAX,
  MATH_Y_MIN,
  MATH_Y_MAX,
} from './constants'

/**
 * 曲線を CURVE_SAMPLE_COUNT 点でサンプリングし、ピクセル座標の配列を返す。
 * y範囲外の点は除外する。
 */
export const sampleCurve = (curve: FunctionCurve): Position[] => {
  const points: Position[] = []
  const step = (MATH_X_MAX - MATH_X_MIN) / CURVE_SAMPLE_COUNT

  for (let i = 0; i <= CURVE_SAMPLE_COUNT; i++) {
    const mathX = MATH_X_MIN + step * i
    const mathY = evaluateFunction(curve.expression, mathX)

    if (mathY === null) continue
    if (mathY < MATH_Y_MIN || mathY > MATH_Y_MAX) continue

    points.push({
      x: mathToPixelX(mathX),
      y: mathToPixelY(mathY),
    })
  }

  return points
}

/**
 * プレイヤーが曲線上にいるかどうかを判定する。
 * プレイヤー中心からいずれかのサンプル点までの距離が閾値未満なら true。
 */
export const isPlayerOnCurve = (
  playerPos: Position,
  sampledPoints: Position[]
): boolean => {
  const thresholdSq = CURVE_COLLISION_THRESHOLD * CURVE_COLLISION_THRESHOLD

  for (const point of sampledPoints) {
    const dx = playerPos.x - point.x
    const dy = playerPos.y - point.y
    if (dx * dx + dy * dy < thresholdSq) {
      return true
    }
  }

  return false
}

/**
 * 全曲線 × 全プレイヤーの衝突判定を行い、ダメージを集計する。
 * 自分の曲線は自分にダメージを与えない。
 */
export const checkCurveDamages = (
  curves: FunctionCurve[],
  players: Record<string, { position: Position }>,
  functionDamage: number
): Record<string, number> => {
  const damages: Record<string, number> = {}

  for (const curve of curves) {
    const sampledPoints = sampleCurve(curve)
    if (sampledPoints.length === 0) continue

    for (const [playerId, player] of Object.entries(players)) {
      // 自分の曲線は自分に無害
      if (playerId === curve.owner) continue

      if (isPlayerOnCurve(player.position, sampledPoints)) {
        damages[playerId] = (damages[playerId] ?? 0) + functionDamage
      }
    }
  }

  return damages
}
