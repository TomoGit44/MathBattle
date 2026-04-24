// ゲーム設定の読み込み (サーバーサイド専用)
// プロジェクトルートの game-config.json を読み込む。
// ファイルが存在しない / パース失敗時はデフォルト値を使う。
//
// 設定値:
//   actionTimeoutSec:     アクション選択フェーズのタイムアウト (秒)。0 以下で時間制限なし
//   bulletDiameter:       弾の当たり判定の直径 (px)
//   playerDiameter:       プレイヤーの当たり判定の直径 (px)
//   moveDistance:         1ターンあたりの移動距離 (px)
//   wallReflectionBonus:  壁反射時に弾の数値に加算される量 (整数、単位なし)
//   mathXMax:             数学座標の x 軸の右端 (左端は -mathXMax、対称)
//                         y 軸の上下端はフィールドのアスペクト比から自動計算
//
// フィールドは 800×400 px で固定。mathXMax から pixelsPerUnit と mathYMax が導出される
// (数学座標 ↔ ピクセル変換に使う)。サイズ系は px 指定なので mathXMax を変えても視覚サイズは不変。

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { FIELD_WIDTH, FIELD_HEIGHT } from './constants'
import type { GameSettings } from './types'

export type { GameSettings }

export interface GameConfig {
  actionTimeoutSec: number
  bulletDiameter: number
  playerDiameter: number
  moveDistance: number
  wallReflectionBonus: number
  mathXMax: number
}

const DEFAULT_CONFIG: GameConfig = {
  actionTimeoutSec: 45,
  bulletDiameter: 20,  // px (旧 BULLET_SIZE=10 の半径→直径)
  playerDiameter: 48,  // px (旧 PLAYER_SIZE=24 の半径→直径)
  moveDistance: 40,    // px
  wallReflectionBonus: 3,
  mathXMax: 10,
}

const CONFIG_PATH = resolve(process.cwd(), 'game-config.json')

const isPositiveNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0

const isNonNegativeNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0

const validate = (raw: unknown): GameConfig => {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG
  const obj = raw as Record<string, unknown>
  const cfg: GameConfig = { ...DEFAULT_CONFIG }

  if (typeof obj.actionTimeoutSec === 'number' && Number.isFinite(obj.actionTimeoutSec)) {
    cfg.actionTimeoutSec = obj.actionTimeoutSec
  }
  if (isPositiveNumber(obj.bulletDiameter)) {
    cfg.bulletDiameter = obj.bulletDiameter
  }
  if (isPositiveNumber(obj.playerDiameter)) {
    cfg.playerDiameter = obj.playerDiameter
  }
  if (isPositiveNumber(obj.moveDistance)) {
    cfg.moveDistance = obj.moveDistance
  }
  if (isNonNegativeNumber(obj.wallReflectionBonus)) {
    cfg.wallReflectionBonus = obj.wallReflectionBonus
  }
  if (isPositiveNumber(obj.mathXMax)) {
    cfg.mathXMax = obj.mathXMax
  }

  return cfg
}

// GameConfig → 解決済みの GameSettings
// サイズは px 指定なので pixelsPerUnit は数学座標変換専用 (サイズには掛けない)。
export const toGameSettings = (cfg: GameConfig): GameSettings => {
  const pixelsPerUnit = FIELD_WIDTH / (2 * cfg.mathXMax)
  const mathYMax = (FIELD_HEIGHT / 2) / pixelsPerUnit
  return {
    bulletRadius: cfg.bulletDiameter / 2,
    playerRadius: cfg.playerDiameter / 2,
    moveDistance: cfg.moveDistance,
    wallReflectionBonus: cfg.wallReflectionBonus,
    mathXMax: cfg.mathXMax,
    mathYMax,
    pixelsPerUnit,
  }
}

export const loadConfig = (): GameConfig => {
  try {
    const text = readFileSync(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(text)
    const cfg = validate(parsed)
    console.log(`[config] Loaded ${CONFIG_PATH}:`, cfg)
    return cfg
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`[config] ${CONFIG_PATH} not found, using defaults:`, DEFAULT_CONFIG)
    } else {
      console.warn(`[config] Failed to load ${CONFIG_PATH}, using defaults:`, err)
    }
    return DEFAULT_CONFIG
  }
}

export const isUnlimited = (cfg: GameConfig): boolean => cfg.actionTimeoutSec <= 0
