// ゲーム設定の読み込み (サーバーサイド専用)
// プロジェクトルートの game-config.json を読み込む。
// ファイルが存在しない / パース失敗時はデフォルト値を使う。
//
// 設定値:
//   actionTimeoutSec:     アクション選択フェーズのタイムアウト (秒)。0 以下で時間制限なし
//   bulletDiameter:       弾の当たり判定の直径 (数学単位)。例: 1 → 1マス分の直径
//   playerDiameter:       プレイヤーの当たり判定の直径 (数学単位)
//   moveDistance:         1ターンあたりの移動距離 (数学単位)
//   wallReflectionBonus:  壁反射時に弾の数値に加算される量 (整数、単位なし)
//
// 数学座標系: x ∈ [-10, 10], y ∈ [-5, 5]、フィールド 800×400px → 1 数学単位 = 40px

import { readFileSync } from 'fs'
import { resolve } from 'path'

// 数学単位 → ピクセル変換係数
export const PIXELS_PER_UNIT = 40

export interface GameConfig {
  // アクション選択タイムアウト (秒)。0以下で無制限
  actionTimeoutSec: number
  // 当たり判定など (数学単位、生の設定値)
  bulletDiameter: number
  playerDiameter: number
  moveDistance: number
  wallReflectionBonus: number
}

// クライアント・サーバーの両方で使う、ピクセルに変換済みの設定
export interface GameSettings {
  bulletRadius: number   // px
  playerRadius: number   // px
  moveDistance: number   // px
  wallReflectionBonus: number
}

const DEFAULT_CONFIG: GameConfig = {
  actionTimeoutSec: 45,
  bulletDiameter: 0.5,         // 既存の 10px 半径 = 20px 直径 = 0.5 数学単位 相当
  playerDiameter: 1.2,         // 既存の 24px 半径 = 48px 直径 = 1.2 数学単位 相当
  moveDistance: 1,             // 既存の 40px = 1 数学単位 相当
  wallReflectionBonus: 3,
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

  return cfg
}

// 数学単位の設定をピクセル単位の GameSettings に変換
export const toGameSettings = (cfg: GameConfig): GameSettings => ({
  bulletRadius: (cfg.bulletDiameter / 2) * PIXELS_PER_UNIT,
  playerRadius: (cfg.playerDiameter / 2) * PIXELS_PER_UNIT,
  moveDistance: cfg.moveDistance * PIXELS_PER_UNIT,
  wallReflectionBonus: cfg.wallReflectionBonus,
})

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

// アクションタイムアウトが「無制限」かどうか
export const isUnlimited = (cfg: GameConfig): boolean => cfg.actionTimeoutSec <= 0
