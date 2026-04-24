import type { GameSettings } from './types'
import { FIELD_WIDTH, FIELD_HEIGHT } from './constants'

// 数学座標 ↔ ピクセル座標の変換。
// 数学範囲は settings.mathXMax / mathYMax によって決まる (対称範囲)。
// フィールド寸法は FIELD_WIDTH × FIELD_HEIGHT (px) 固定。

/** 数学座標のxをピクセルxに変換 */
export const mathToPixelX = (mathX: number, settings: GameSettings): number => {
  return ((mathX + settings.mathXMax) / (2 * settings.mathXMax)) * FIELD_WIDTH
}

/** 数学座標のyをピクセルyに変換 (Y反転) */
export const mathToPixelY = (mathY: number, settings: GameSettings): number => {
  return ((settings.mathYMax - mathY) / (2 * settings.mathYMax)) * FIELD_HEIGHT
}

/** ピクセルxを数学座標のxに変換 */
export const pixelToMathX = (pixelX: number, settings: GameSettings): number => {
  return -settings.mathXMax + (pixelX / FIELD_WIDTH) * (2 * settings.mathXMax)
}

/** ピクセルyを数学座標のyに変換 (Y反転) */
export const pixelToMathY = (pixelY: number, settings: GameSettings): number => {
  return settings.mathYMax - (pixelY / FIELD_HEIGHT) * (2 * settings.mathYMax)
}
