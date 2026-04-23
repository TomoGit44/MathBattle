import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  MATH_X_MIN,
  MATH_X_MAX,
  MATH_Y_MIN,
  MATH_Y_MAX,
} from './constants'

/** 数学座標のxをピクセルxに変換 (-10→0, 0→400, 10→800) */
export const mathToPixelX = (mathX: number): number => {
  return ((mathX - MATH_X_MIN) / (MATH_X_MAX - MATH_X_MIN)) * FIELD_WIDTH
}

/** 数学座標のyをピクセルyに変換 (5→0, 0→200, -5→400) ※Y反転 */
export const mathToPixelY = (mathY: number): number => {
  return ((MATH_Y_MAX - mathY) / (MATH_Y_MAX - MATH_Y_MIN)) * FIELD_HEIGHT
}

/** ピクセルxを数学座標のxに変換 */
export const pixelToMathX = (pixelX: number): number => {
  return MATH_X_MIN + (pixelX / FIELD_WIDTH) * (MATH_X_MAX - MATH_X_MIN)
}

/** ピクセルyを数学座標のyに変換 */
export const pixelToMathY = (pixelY: number): number => {
  return MATH_Y_MAX - (pixelY / FIELD_HEIGHT) * (MATH_Y_MAX - MATH_Y_MIN)
}
