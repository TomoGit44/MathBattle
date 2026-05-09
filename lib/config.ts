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
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  ITEM_SIZE,
  DEFAULT_ITEM_SPAWN_RATES,
  DEFAULT_HEAL_AMOUNT_MIN,
  DEFAULT_HEAL_AMOUNT_MAX,
  MAX_ITEMS,
  DRAW_COUNT,
  MAX_HAND_SIZE,
  MIN_DECK_SIZE,
  MAX_DECK_SIZE,
} from './constants'
import type { GameSettings, ItemKind } from './types'

export type { GameSettings }

export interface GameConfig {
  actionTimeoutSec: number
  bulletDiameter: number
  playerDiameter: number
  moveDistance: number
  wallReflectionBonus: number
  mathXMax: number
  itemSize: number          // px (アイテムの当たり判定の直径)
  // 種別ごとの絶対出現確率。設定ファイルでキー '+', '-', '×', '÷', 'pack', 'heal' を指定可能
  itemSpawnRates: Record<ItemKind, number>
  maxItems: number          // フィールド上の同時存在上限
  healAmountMin: number     // heal 取得時の最小回復量
  healAmountMax: number     // heal 取得時の最大回復量
  drawCount: number         // 1ターンにドローする枚数
  maxHandSize: number       // 手札の上限枚数
  minDeckSize: number       // デッキの下限枚数 (構築時の最小値)
  maxDeckSize: number       // デッキの上限枚数 (構築時の最大値)
}

const DEFAULT_CONFIG: GameConfig = {
  actionTimeoutSec: 45,
  bulletDiameter: 20,  // px (旧 BULLET_SIZE=10 の半径→直径)
  playerDiameter: 48,  // px (旧 PLAYER_SIZE=24 の半径→直径)
  moveDistance: 40,    // px
  wallReflectionBonus: 3,
  mathXMax: 10,
  itemSize: ITEM_SIZE,
  itemSpawnRates: { ...DEFAULT_ITEM_SPAWN_RATES },
  maxItems: MAX_ITEMS,
  healAmountMin: DEFAULT_HEAL_AMOUNT_MIN,
  healAmountMax: DEFAULT_HEAL_AMOUNT_MAX,
  drawCount: DRAW_COUNT,
  maxHandSize: MAX_HAND_SIZE,
  minDeckSize: MIN_DECK_SIZE,
  maxDeckSize: MAX_DECK_SIZE,
}

const ITEM_KIND_KEYS: ItemKind[] = ['+', '-', '×', '÷', 'pack', 'heal']
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

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
  if (isPositiveNumber(obj.itemSize)) {
    cfg.itemSize = obj.itemSize
  }
  // itemSpawnRates: 種別ごとに 0..1 でクランプ。
  // 後方互換: 旧キー itemSpawnRate (単一数値) は演算子4種に均等配分する。
  if (obj.itemSpawnRates && typeof obj.itemSpawnRates === 'object') {
    const rates = obj.itemSpawnRates as Record<string, unknown>
    const next: Record<ItemKind, number> = { ...cfg.itemSpawnRates }
    for (const k of ITEM_KIND_KEYS) {
      const v = rates[k]
      if (typeof v === 'number' && Number.isFinite(v)) {
        next[k] = clamp01(v)
      }
    }
    cfg.itemSpawnRates = next
  } else if (typeof obj.itemSpawnRate === 'number' && Number.isFinite(obj.itemSpawnRate)) {
    const total = clamp01(obj.itemSpawnRate)
    const each = total / 4
    cfg.itemSpawnRates = {
      '+': each, '-': each, '×': each, '÷': each, pack: 0, heal: 0,
    }
  }
  if (
    typeof obj.maxItems === 'number' &&
    Number.isFinite(obj.maxItems) &&
    obj.maxItems >= 0 &&
    Number.isInteger(obj.maxItems)
  ) {
    cfg.maxItems = obj.maxItems
  }

  // heal 回復量レンジ。負値や逆転 (min > max) は補正
  if (isNonNegativeNumber(obj.healAmountMin)) {
    cfg.healAmountMin = Math.floor(obj.healAmountMin)
  }
  if (isNonNegativeNumber(obj.healAmountMax)) {
    cfg.healAmountMax = Math.floor(obj.healAmountMax)
  }
  if (cfg.healAmountMax < cfg.healAmountMin) {
    cfg.healAmountMax = cfg.healAmountMin
  }

  // ドロー枚数 / 手札上限 / デッキサイズ。すべて非負整数で受け取る。
  if (isNonNegativeNumber(obj.drawCount) && Number.isInteger(obj.drawCount)) {
    cfg.drawCount = obj.drawCount
  }
  if (isPositiveNumber(obj.maxHandSize) && Number.isInteger(obj.maxHandSize)) {
    cfg.maxHandSize = obj.maxHandSize
  }
  if (isPositiveNumber(obj.minDeckSize) && Number.isInteger(obj.minDeckSize)) {
    cfg.minDeckSize = obj.minDeckSize
  }
  if (isPositiveNumber(obj.maxDeckSize) && Number.isInteger(obj.maxDeckSize)) {
    cfg.maxDeckSize = obj.maxDeckSize
  }
  // min > max の逆転は max を min に揃えて整合させる
  if (cfg.maxDeckSize < cfg.minDeckSize) {
    cfg.maxDeckSize = cfg.minDeckSize
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
    itemSize: cfg.itemSize,
    itemSpawnRates: { ...cfg.itemSpawnRates },
    maxItems: cfg.maxItems,
    healAmountMin: cfg.healAmountMin,
    healAmountMax: cfg.healAmountMax,
    drawCount: cfg.drawCount,
    maxHandSize: cfg.maxHandSize,
    minDeckSize: cfg.minDeckSize,
    maxDeckSize: cfg.maxDeckSize,
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
