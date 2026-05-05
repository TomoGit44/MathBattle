import type { FunctionCurve, Position, GameSettings } from './types'
import { evaluateFunction, expressionKey } from './func-engine'
import { mathToPixelX, mathToPixelY } from './coordinates'
import {
  CURVE_SAMPLE_COUNT,
  CURVE_COLLISION_THRESHOLD,
} from './constants'

/**
 * 曲線を CURVE_SAMPLE_COUNT 点でサンプリングし、ピクセル座標の配列を返す。
 * y範囲外の点は除外する。
 */
export const sampleCurve = (curve: FunctionCurve, settings: GameSettings): Position[] => {
  const points: Position[] = []
  const { mathXMax, mathYMax } = settings
  const step = (2 * mathXMax) / CURVE_SAMPLE_COUNT

  for (let i = 0; i <= CURVE_SAMPLE_COUNT; i++) {
    const mathX = -mathXMax + step * i
    const mathY = evaluateFunction(curve.expression, mathX)

    if (mathY === null) continue
    if (mathY < -mathYMax || mathY > mathYMax) continue

    points.push({
      x: mathToPixelX(mathX, settings),
      y: mathToPixelY(mathY, settings),
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
 * 同じプレイヤーが同じ式の関数を複数定義しても効果は重複しない (owner+expression で重複排除)。
 */
export const checkCurveDamages = (
  curves: FunctionCurve[],
  players: Record<string, { position: Position }>,
  functionDamage: number,
  settings: GameSettings
): Record<string, number> => {
  const damages: Record<string, number> = {}

  // 重複排除: 同じ owner で同じ式の curve は最初の1つだけ判定対象とする
  const seen = new Set<string>()
  const dedupedCurves: FunctionCurve[] = []
  for (const curve of curves) {
    const key = `${curve.owner}:${expressionKey(curve.expression)}`
    if (seen.has(key)) continue
    seen.add(key)
    dedupedCurves.push(curve)
  }

  for (const curve of dedupedCurves) {
    const sampledPoints = sampleCurve(curve, settings)
    if (sampledPoints.length === 0) continue

    for (const [playerId, player] of Object.entries(players)) {
      if (playerId === curve.owner) continue

      if (isPlayerOnCurve(player.position, sampledPoints)) {
        damages[playerId] = (damages[playerId] ?? 0) + functionDamage
      }
    }
  }

  return damages
}
