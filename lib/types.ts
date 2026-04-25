// --- カード ---
export type NumberCard = { type: 'number'; value: number }
export type OperatorCard = { type: 'operator'; operator: '+' | '-' | '×' | '÷' }
export type Card = NumberCard | OperatorCard

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
// 撃破した側がそのカードを獲得する。今は4演算子のみだが今後拡張予定
export type ItemKind = '+' | '-' | '×' | '÷'

export interface FieldItem {
  id: string
  kind: ItemKind
  position: Position
  hp: number
  maxHp: number
  size: number     // 当たり判定の直径 (px)
}

// --- アクション ---
// move/calculate は即時適用される。attack/function/skip は「メインアクション」で、
// 両プレイヤーが submit するとターンが解決される。
export type Action =
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'skip_move' }  // 移動フェーズで「移動しない」を選択 (即時処理)
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
  hasMovedThisTurn: boolean  // このターンに移動済みか (各ターン1回だけ)
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
  itemSpawnRate: number  // 0.0〜1.0 (毎ターン開始時に新アイテムを生成する確率)
  maxItems: number       // フィールド上の同時存在アイテム数の上限
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
  hasMovedThisTurn: boolean
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
  // 計算で素数弾 (10以上の素数) が合成されたときの値 (プレイヤーIDごと)
  primeSynthesis?: Record<string, number>
  // 撃破されたアイテム (UI 表示・ログ用)
  itemKills?: Array<{ itemId: string; kind: ItemKind; killerId: string; awarded: boolean }>
}

// --- WebSocket メッセージ (Client → Server) ---
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'action'; action: Action }

// --- WebSocket メッセージ (Server → Client) ---
export type ServerMessage =
  | { type: 'waiting'; roomId: string }
  | { type: 'gameState'; state: ClientGameState }
  | { type: 'error'; message: string }
  | { type: 'gameOver'; winnerId: string | null; state: ClientGameState }
