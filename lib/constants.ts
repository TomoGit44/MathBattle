import type { Card } from './types'

// フィールド
export const FIELD_WIDTH = 800
export const FIELD_HEIGHT = 400

// プレイヤー
export const PLAYER_SIZE = 24
export const INITIAL_HP = 100
export const MOVE_DISTANCE = 40

// 弾
export const BULLET_SIZE = 10
export const BASE_BULLET_SPEED = 80
export const SPEED_DECAY_FACTOR = 0.15
export const WALL_REFLECTION_BONUS = 3
export const MAX_REFLECTIONS = 3

// カード・手札
export const DRAW_COUNT = 2
export const MAX_HAND_SIZE = 16
export const MAX_CALC_CARDS = 5
export const NUMBER_REPLENISH_THRESHOLD = 2

// ターン
// ※ ACTION_TIMEOUT_MS は game-config.json (lib/config.ts) で上書き可能。
//    game-config.json の actionTimeoutSec が優先される (0以下で時間制限なし)
export const ACTION_TIMEOUT_MS = 45000
export const PHYSICS_TICKS_PER_TURN = 10

// アニメーション
export const ANIMATION_DURATION_MS = 3000
export const TURN_DELAY_MS = 4000

// 初期位置
export const P1_START_X = 100
export const P2_START_X = 700
export const START_Y = 200

// 関数アクション
export const MAX_FUNCTION_USES = 10
export const FUNCTION_DAMAGE = 10
export const CURVE_SAMPLE_COUNT = 200
export const CURVE_COLLISION_THRESHOLD = 30 // px (PLAYER_SIZE + マージン)

// 数学座標系
export const MATH_X_MIN = -10
export const MATH_X_MAX = 10
export const MATH_Y_MIN = -5
export const MATH_Y_MAX = 5

// デフォルトデッキ (演算カード7枚のみ。数字カード1-9は手札補充で供給)
export const DEFAULT_DECK: Card[] = [
  { type: 'operator', operator: '+' },
  { type: 'operator', operator: '+' },
  { type: 'operator', operator: '×' },
  { type: 'operator', operator: '×' },
  { type: 'operator', operator: '-' },
  { type: 'operator', operator: '÷' },
  { type: 'operator', operator: '÷' },
]
