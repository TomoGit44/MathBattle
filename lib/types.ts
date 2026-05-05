// --- カード ---
export type Direction = 'up' | 'down' | 'left' | 'right'
export type NumberCard = { type: 'number'; value: number }
export type OperatorCard = { type: 'operator'; operator: '+' | '-' | '×' | '÷' }
// 移動カード: 使用すると即時にプレイヤーが指定方向に動く。1枚ごとに方向が固定。
export type MoveCard = { type: 'move'; direction: Direction }
export type Card = NumberCard | OperatorCard | MoveCard

// 計算結果として手札に残る数値トークン
export type NumberToken = { type: 'token'; value: number }

// 手札のアイテム (カードまたは合成済みトークン)
export type HandItem = Card | NumberToken

// --- デッキ ---
export interface Deck {
  id: string
  name: string
  cards: Card[]
}

// --- フィールド ---
export interface Position {
  x: number
  y: number
}

export interface Velocity {
  dx: number
  dy: number
}

export interface Bullet {
  id: string
  owner: string
  value: number
  position: Position
  velocity: Velocity
  reflections: number
}

// --- 関数の式の構成要素 ---
export interface FunctionExpressionItem {
  type: 'number' | 'operator' | 'token' | 'variable'
  value?: number
  operator?: '+' | '-' | '×' | '÷'
}

// --- フィールド上の関数カーブ ---
export interface FunctionCurve {
  id: string
  owner: string
  expression: FunctionExpressionItem[]
  displayString: string // "f(x) = 3×x+1"
}

// --- フィールド上のアイテム ---
// 撃破/接触で獲得できるアイテム。
// '+' '-' '×' '÷' は対応する演算子1枚を獲得。
// 'pack' は演算子パック: +/-/×/÷ 4種を一括で獲得 (手札の空きが足りなければ入る分だけ)。
// 'heal' は回復: HP を [healAmountMin, healAmountMax] の乱数だけ回復 (上限は初期HP)。
export type ItemKind = '+' | '-' | '×' | '÷' | 'pack' | 'heal'

// 演算子のみのカード種別 (pack/heal を除く)
export type OperatorItemKind = '+' | '-' | '×' | '÷'

export interface FieldItem {
  id: string
  kind: ItemKind
  position: Position
  hp: number
  maxHp: number
  size: number     // 当たり判定の直径 (px)
}

// --- アクション ---
// use_move_card / calculate は即時適用 (回数制限なし)。
// attack/function/skip は「メインアクション」で、両プレイヤーが submit するとターンが解決される。
export type Action =
  | { type: 'use_move_card'; handIndex: number }
  | { type: 'calculate'; cardIndices: number[] }
  | { type: 'attack'; handIndex: number }
  | { type: 'function'; cardIndices: number[]; xPositions: number[] }
  | { type: 'skip' }       // メインアクションをスキップ

// --- プレイヤー ---
export interface PlayerState {
  id: string
  name: string
  hp: number
  position: Position
  facing: 'left' | 'right'
  hand: HandItem[]
  deckRemaining: number
  functionUsesRemaining: number
}

// --- ゲーム ---
export type GamePhase =
  | 'waiting'
  | 'draw'
  | 'action'
  | 'resolving'
  | 'result'
  | 'gameover'

// --- ゲーム設定 (サーバー権威。各種サイズはピクセル単位 + 数学座標範囲) ---
export interface GameSettings {
  bulletRadius: number   // px (当たり判定の半径)
  playerRadius: number   // px (当たり判定の半径)
  moveDistance: number   // px (1ターンあたりの移動距離)
  wallReflectionBonus: number // 壁反射時に弾の数値に加算
  mathXMax: number       // 数学座標の x 右端 (左端は -mathXMax)
  mathYMax: number       // 数学座標の y 上端 (下端は -mathYMax、アスペクト比から導出)
  pixelsPerUnit: number  // 1 数学単位あたりのピクセル数
  itemSize: number       // px (アイテムの当たり判定の直径)
  // 種別ごとの絶対出現確率 (毎ターン開始時の試行確率)。合計 > 1 の場合は内部的にクランプ。
  itemSpawnRates: Record<ItemKind, number>
  maxItems: number       // フィールド上の同時存在アイテム数の上限
  healAmountMin: number  // heal アイテム獲得時の最小回復量
  healAmountMax: number  // heal アイテム獲得時の最大回復量
}

export interface GameState {
  phase: GamePhase
  turn: number
  players: Record<string, PlayerState>
  bullets: Bullet[]
  curves: FunctionCurve[]
  items: FieldItem[]
  fieldSize: { width: number; height: number }
  settings: GameSettings
}

// --- サニタイズ済みプレイヤー（相手から見える情報） ---
export interface SanitizedPlayerState {
  id: string
  name: string
  hp: number
  position: Position
  facing: 'left' | 'right'
  handCount: number
  deckRemaining: number
  functionUsesRemaining: number
}

// --- クライアントに送るゲーム状態 ---
export interface ClientGameState {
  phase: GamePhase
  turn: number
  me: PlayerState
  opponent: SanitizedPlayerState
  bullets: Bullet[]
  curves: FunctionCurve[]
  items: FieldItem[]
  fieldSize: { width: number; height: number }
  settings: GameSettings
  turnResult?: TurnResult
}

// --- 弾のスナップショット (1tick分) ---
export interface BulletSnapshot {
  bullets: Bullet[]
}

// --- ターン結果 ---
export interface TurnResult {
  actions: Record<string, { type: string; description: string }>
  damages: Record<string, number>
  bulletEvents: string[]
  bulletSnapshots: BulletSnapshot[]
  playerPositions: Record<string, Position>
  curveDamages: Record<string, number>
  // 関数カーブに関するイベント (打ち消し合いなど)。表示用テキスト。
  curveEvents?: string[]
  // 計算で素数弾 (10以上の素数) が合成されたときの値 (プレイヤーIDごと)
  primeSynthesis?: Record<string, number>
  // 撃破されたアイテム (UI 表示・ログ用)
  // awardedCount: 実際に手札へ追加できた演算子カードの枚数。通常アイテムは 0|1、pack は 0〜4
  itemKills?: Array<{ itemId: string; kind: ItemKind; killerId: string; awardedCount: number }>
  // 接触で拾得されたアイテム (移動アクションで触れたとき発生)
  itemPickups?: Array<{ itemId: string; kind: ItemKind; pickerId: string; awardedCount: number }>
}

// --- WebSocket メッセージ (Client → Server) ---
export type ClientMessage =
  | { type: 'join'; name: string; deck?: Card[] }
  | { type: 'action'; action: Action }

// --- WebSocket メッセージ (Server → Client) ---
export type ServerMessage =
  | { type: 'waiting'; roomId: string }
  | { type: 'gameState'; state: ClientGameState }
  | { type: 'error'; message: string }
  | { type: 'gameOver'; winnerId: string | null; state: ClientGameState }
