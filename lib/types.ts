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

// --- スロット & カードプール ---
// 毎ターンの補充は3つの「枠」 (slot) で構成され、各枠は独立した共通プールから抽選される。
//   operator: 演算子カード (+ - × ÷ など)
//   number:   数字カード (0, 1〜9, -1, 0.5, ∞ などプール側で自由定義)
//   other:    移動カードを含む「その他」枠 (今後の新カード追加先)
export type SlotKind = 'operator' | 'number' | 'other'

// プールに含まれる1エントリ。baseWeight が大きいほど抽選で出やすい。
// 一度配ると drawCounts が加算され、抽選時の実効重みは
//   effectiveWeight = baseWeight × decayFactor ^ drawCounts[cardKey(card)]
// で減衰する (永続スタック式)。
export interface PoolEntry {
  card: Card
  baseWeight: number
}

// プールエントリの正規化キー (drawCounts のキーとして使う)
export type CardKey = string

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

// --- 新規カードの追加イベント (演出用) ---
// クライアントは ClientGameState.me.newCardEvents を受け取り、対応する手札スロットに
// 「光の玉が発信元から飛んできて入れ替わりにカードが現れる」演出を再生する。
// kind が 'pool' なら発信元はカードプールアイコン (次ターンプレビュー)、
// 'item' なら拾得元アイテムのフィールド座標 (px)。
export type NewCardEvent =
  | {
      kind: 'pool'
      targetIndices: number[]
    }
  | {
      kind: 'item'
      targetIndices: number[]
      originPosition: Position    // フィールドのピクセル座標
      itemKind: ItemKind
    }

// --- 手札ログ (自分分のみ。ActionLog の「手札変化」セクションに表示) ---
export type HandLogReason =
  | 'draw_op'      // 補充 (演算子枠)
  | 'draw_num'     // 補充 (数字枠)
  | 'draw_other'   // 補充 (その他枠)
  | 'attack'       // 攻撃で発射
  | 'function'     // 関数で消費
  | 'calc'         // 計算で消費
  | 'calc_result'  // 計算結果として追加
  | 'use_move'     // 移動カード使用で消費
  | 'discard'      // 自分で捨てた
  | 'item_kill'    // アイテム撃破で獲得
  | 'item_pickup'  // アイテム接触で獲得

export interface HandLogEntry {
  kind: 'add' | 'remove'
  cardLabel: string  // '7' '∞' '+' '↑' など表示用
  reason: HandLogReason
}

// --- アクション ---
// use_move_card / calculate / discard は即時適用 (回数制限なし)。
// attack/function/skip は「メインアクション」で、両プレイヤーが submit するとターンが解決される。
export type Action =
  | { type: 'use_move_card'; handIndex: number }
  | { type: 'calculate'; cardIndices: number[] }
  | { type: 'attack'; handIndex: number }
  | { type: 'function'; cardIndices: number[]; xPositions: number[] }
  | { type: 'discard'; handIndex: number }
  | { type: 'skip' }       // メインアクションをスキップ

// --- プレイヤー ---
export interface PlayerState {
  id: string
  name: string
  hp: number
  position: Position
  facing: 'left' | 'right'
  hand: HandItem[]
  functionUsesRemaining: number
  // 抽選確率低下用: これまで配られた累積カウント (cardKey → 回数)
  drawCounts: Record<CardKey, number>
  // 次ターン補充が確定済みの (両者公開) カード列
  nextDraw: HandItem[]
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
  maxHandSize: number    // 手札の上限枚数
  animationDurationMs: number // ターン解決アニメーションの総再生時間 (ms)
  // 毎ターン補充の枠数 (0 以上の整数)
  slots: Record<SlotKind, number>
  // 各枠の共通カードプール
  pools: Record<SlotKind, PoolEntry[]>
  // 永続スタック式の確率低下係数 (0 < decayFactor ≤ 1)。1 で減衰なし。
  decayFactor: number
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
  functionUsesRemaining: number
  // 次ターン補充プレビューは両者公開
  nextDraw: HandItem[]
}

// --- クライアントに送るゲーム状態 ---
export interface ClientGameState {
  phase: GamePhase
  turn: number
  me: PlayerState & { newCardEvents?: NewCardEvent[] }
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
  // originPosition / targetIndices はクライアント側の玉飛行演出に使う
  itemPickups?: Array<{
    itemId: string
    kind: ItemKind
    pickerId: string
    awardedCount: number
    originPosition: Position
    targetIndices: number[]
  }>
  // 自分の手札変動ログ (サーバーが viewer ごとにフィルタしてから配信)
  handLog?: HandLogEntry[]
  // 回復イベント (負ダメージ弾・heal アイテム)。playerId → 累積回復量。
  heals?: Record<string, number>
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

// --- 共通ユーティリティ: カードラベル / cardKey ---
// プールエントリのキー正規化。drawCounts のキーとして使う。
export const cardKey = (c: Card): CardKey => {
  if (c.type === 'number') {
    if (c.value === Infinity) return 'n:Inf'
    if (c.value === -Infinity) return 'n:-Inf'
    return `n:${c.value}`
  }
  if (c.type === 'operator') return `o:${c.operator}`
  return `m:${c.direction}`
}

const dirArrow = (d: Direction): string =>
  ({ up: '↑', down: '↓', left: '←', right: '→' }[d])

// 手札ログや UI 表示で使うカードラベル
export const handItemLabel = (item: HandItem): string => {
  switch (item.type) {
    case 'number':
      return Number.isFinite(item.value) ? String(item.value) : item.value > 0 ? '∞' : '-∞'
    case 'token':
      return Number.isFinite(item.value) ? String(item.value) : item.value > 0 ? '∞' : '-∞'
    case 'operator':
      return item.operator
    case 'move':
      return dirArrow(item.direction)
  }
}
