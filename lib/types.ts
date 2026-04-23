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

// --- アクション ---
export type Action =
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'calculate'; cardIndices: number[] }
  | { type: 'attack'; handIndex: number }
  | { type: 'function'; cardIndices: number[]; xPositions: number[] }

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

export interface GameState {
  phase: GamePhase
  turn: number
  players: Record<string, PlayerState>
  bullets: Bullet[]
  curves: FunctionCurve[]
  fieldSize: { width: number; height: number }
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
  fieldSize: { width: number; height: number }
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
