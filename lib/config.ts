// ゲーム設定の読み込み (サーバーサイド専用)
// プロジェクトルートの game-config.json を読み込む。
// ファイルが存在しない / パース失敗時はデフォルト値を使う。
//
// 設定値:
//   actionTimeoutSec: アクション選択フェーズのタイムアウト (秒)
//                     0 以下を指定すると時間制限なし

import { readFileSync } from 'fs'
import { resolve } from 'path'

export interface GameConfig {
  // アクション選択タイムアウト (秒)。0以下で無制限
  actionTimeoutSec: number
}

const DEFAULT_CONFIG: GameConfig = {
  actionTimeoutSec: 45,
}

const CONFIG_PATH = resolve(process.cwd(), 'game-config.json')

const validate = (raw: unknown): GameConfig => {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG
  const obj = raw as Record<string, unknown>
  const cfg: GameConfig = { ...DEFAULT_CONFIG }

  if (typeof obj.actionTimeoutSec === 'number' && Number.isFinite(obj.actionTimeoutSec)) {
    cfg.actionTimeoutSec = obj.actionTimeoutSec
  }

  return cfg
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

// アクションタイムアウトが「無制限」かどうか
export const isUnlimited = (cfg: GameConfig): boolean => cfg.actionTimeoutSec <= 0
