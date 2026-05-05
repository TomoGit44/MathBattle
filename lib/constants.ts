import type { Card, ItemKind } from './types'

// フィールド
export const FIELD_WIDTH = 800
export const FIELD_HEIGHT = 400

// プレイヤー
export const PLAYER_SIZE = 24
export const INITIAL_HP = 50
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
export const NUMBER_REPLENISH_THRESHOLD = 3
// 移動カードの自動補充: ターン開始時、各方向ごとに不足分を1枚ずつ補充する
export const MOVE_AUTO_REPLENISH = true

// デッキ構築の制限
export const MIN_DECK_SIZE = 5
export const MAX_DECK_SIZE = 20
export const MAX_SAME_CARD_COUNT = 6  // 同名カードの投入上限

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

// アイテム
export const ITEM_SIZE = 40              // px (当たり判定の直径)
export const ITEM_CORNER_RADIUS = 6      // px (見た目の rounded-md と当たり判定の角丸半径)
export const MAX_ITEMS = 5               // フィールド上の同時存在上限
export const ITEM_HP_MIN = 1             // ランダムHPの下限
export const ITEM_HP_MAX = 50            // ランダムHPの上限
// 出現範囲 (画面左右中央の ±100px)
export const ITEM_SPAWN_X_HALF_WIDTH = 100

// 種別ごとの絶対出現確率 (毎ターン開始時)。
// 演算子 0.2 × 4 = 0.8 + pack 0.05 + heal 0.1 = 0.95 (合計 ≤1 で内部クランプ不要)。
export const DEFAULT_ITEM_SPAWN_RATES: Record<ItemKind, number> = {
  '+': 0.2,
  '-': 0.2,
  '×': 0.2,
  '÷': 0.2,
  pack: 0.05,
  heal: 0.1,
}

// heal アイテム取得時の回復量 (両端含む乱数)
export const DEFAULT_HEAL_AMOUNT_MIN = 5
export const DEFAULT_HEAL_AMOUNT_MAX = 20

// 数学座標系
export const MATH_X_MIN = -10
export const MATH_X_MAX = 10
export const MATH_Y_MIN = -5
export const MATH_Y_MAX = 5

// グリッド線 (数学座標単位)。x軸・y軸 (原点) を基準にこの間隔ごとに描画される
export const GRID_SPACING_X = 0.5
export const GRID_SPACING_Y = 0.5

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
