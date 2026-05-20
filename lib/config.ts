// ゲーム設定の読み込み (サーバーサイド専用)
// プロジェクトルートの game-config.json を読み込む。
// ファイルが存在しない / パース失敗時はデフォルト値を使う。
//
// 主要な設定値:
//   actionTimeoutSec:     アクション選択フェーズのタイムアウト (秒)。0 以下で時間制限なし
//   bulletDiameter:       弾の当たり判定の直径 (px)
//   playerDiameter:       プレイヤーの当たり判定の直径 (px)
//   moveDistance:         1ターンあたりの移動距離 (px)
//   wallReflectionBonus:  壁反射時に弾の数値に加算される量 (整数、単位なし)
//   mathXMax:             数学座標の x 軸の右端 (左端は -mathXMax、対称)
//                         y 軸の上下端はフィールドのアスペクト比から自動計算
//   slots / pools / decayFactor:
//                         毎ターン補充の枠数・カードプール・確率低下係数。
//                         詳細は CLAUDE.md「カードシステム」参照
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
  MAX_HAND_SIZE,
  ANIMATION_DURATION_MS,
  DEFAULT_SLOTS,
  DEFAULT_INITIAL_SLOTS,
  DEFAULT_POOLS,
  DEFAULT_DECAY_FACTOR,
} from './constants'
import type { Card, GameSettings, ItemKind, PoolEntry, SlotKind } from './types'

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
  maxHandSize: number       // 手札の上限枚数
  animationDurationMs: number // ターン解決アニメーションの総再生時間 (ms)
  slots: Record<SlotKind, number>
  initialSlots: Record<SlotKind, number>
  pools: Record<SlotKind, PoolEntry[]>
  decayFactor: number
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
  maxHandSize: MAX_HAND_SIZE,
  animationDurationMs: ANIMATION_DURATION_MS,
  slots: { ...DEFAULT_SLOTS },
  initialSlots: { ...DEFAULT_INITIAL_SLOTS },
  pools: {
    operator: DEFAULT_POOLS.operator.map((e) => ({ ...e, card: { ...e.card } })),
    number: DEFAULT_POOLS.number.map((e) => ({ ...e, card: { ...e.card } })),
    other: DEFAULT_POOLS.other.map((e) => ({ ...e, card: { ...e.card } })),
  },
  decayFactor: DEFAULT_DECAY_FACTOR,
}

const ITEM_KIND_KEYS: ItemKind[] = ['+', '-', '×', '÷', 'pack', 'heal']
const SLOT_KIND_KEYS: SlotKind[] = ['operator', 'number', 'other']
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

const CONFIG_PATH = resolve(process.cwd(), 'game-config.json')

const isPositiveNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0

const isNonNegativeNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0

// 設定ファイル上の数値リテラル ("Infinity" / "-Infinity" を含む) を JavaScript の number に変換。
// json-codec のセンチネル文字列もここで受け入れる。
const parseNumberLike = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    if (v === 'Infinity' || v === '__INF__') return Infinity
    if (v === '-Infinity' || v === '__NEG_INF__') return -Infinity
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

// 設定ファイルの "card" オブジェクトをバリデーションして Card に変換 (失敗時は null)。
const parseCard = (raw: unknown): Card | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { type?: unknown; value?: unknown; operator?: unknown; direction?: unknown }
  if (r.type === 'number') {
    const v = parseNumberLike(r.value)
    if (v === null) return null
    if (Number.isNaN(v)) return null
    return { type: 'number', value: v }
  }
  if (r.type === 'operator') {
    if (r.operator === '+' || r.operator === '-' || r.operator === '×' || r.operator === '÷') {
      return { type: 'operator', operator: r.operator }
    }
    return null
  }
  if (r.type === 'move') {
    if (r.direction === 'up' || r.direction === 'down' || r.direction === 'left' || r.direction === 'right') {
      return { type: 'move', direction: r.direction }
    }
    return null
  }
  return null
}

// 設定の pools[slotKind] を PoolEntry[] にパース (各 baseWeight は >0 必須)。
const parsePoolEntries = (raw: unknown): PoolEntry[] | null => {
  if (!Array.isArray(raw)) return null
  const out: PoolEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as { card?: unknown; baseWeight?: unknown }
    const card = parseCard(obj.card)
    if (!card) continue
    const w = typeof obj.baseWeight === 'number' && obj.baseWeight > 0 && Number.isFinite(obj.baseWeight)
      ? obj.baseWeight
      : 1
    out.push({ card, baseWeight: w })
  }
  return out.length > 0 ? out : null
}

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

  if (isPositiveNumber(obj.maxHandSize) && Number.isInteger(obj.maxHandSize)) {
    cfg.maxHandSize = obj.maxHandSize
  }

  // アニメーション時間 (ms)。極端に短い値を防ぐため最低 200ms にクランプ。
  if (isPositiveNumber(obj.animationDurationMs)) {
    cfg.animationDurationMs = Math.max(200, Math.floor(obj.animationDurationMs))
  }

  // slots: 各枠数 (0 以上の整数)。値が無効なキーはデフォルトのまま。
  if (obj.slots && typeof obj.slots === 'object') {
    const s = obj.slots as Record<string, unknown>
    const nextSlots: Record<SlotKind, number> = { ...cfg.slots }
    for (const k of SLOT_KIND_KEYS) {
      const v = s[k]
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && Number.isInteger(v)) {
        nextSlots[k] = v
      }
    }
    cfg.slots = nextSlots
  }

  // initialSlots: 試合開始時の初期手札の枠数 (0 以上の整数)。
  if (obj.initialSlots && typeof obj.initialSlots === 'object') {
    const s = obj.initialSlots as Record<string, unknown>
    const nextSlots: Record<SlotKind, number> = { ...cfg.initialSlots }
    for (const k of SLOT_KIND_KEYS) {
      const v = s[k]
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && Number.isInteger(v)) {
        nextSlots[k] = v
      }
    }
    cfg.initialSlots = nextSlots
  }

  // pools: 各枠のカードプール。未指定の枠はデフォルトのまま。空配列を渡すと「この枠は無効」となるが
  // 設定の意図的な抑止 (slots=0 と組み合わせ) を妨げないため許可しない (パース失敗扱い)。
  if (obj.pools && typeof obj.pools === 'object') {
    const p = obj.pools as Record<string, unknown>
    const nextPools: Record<SlotKind, PoolEntry[]> = {
      operator: cfg.pools.operator,
      number: cfg.pools.number,
      other: cfg.pools.other,
    }
    for (const k of SLOT_KIND_KEYS) {
      const entries = parsePoolEntries(p[k])
      if (entries) nextPools[k] = entries
    }
    cfg.pools = nextPools
  }

  // decayFactor: (0, 1] の範囲。範囲外はデフォルトに戻す。
  if (typeof obj.decayFactor === 'number' && Number.isFinite(obj.decayFactor) && obj.decayFactor > 0 && obj.decayFactor <= 1) {
    cfg.decayFactor = obj.decayFactor
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
    maxHandSize: cfg.maxHandSize,
    animationDurationMs: cfg.animationDurationMs,
    slots: { ...cfg.slots },
    initialSlots: { ...cfg.initialSlots },
    pools: {
      operator: cfg.pools.operator.map((e) => ({ ...e, card: { ...e.card } })),
      number: cfg.pools.number.map((e) => ({ ...e, card: { ...e.card } })),
      other: cfg.pools.other.map((e) => ({ ...e, card: { ...e.card } })),
    },
    decayFactor: cfg.decayFactor,
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
