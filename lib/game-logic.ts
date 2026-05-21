import type {
  GameState,
  PlayerState,
  Action,
  HandItem,
  ClientGameState,
  SanitizedPlayerState,
  TurnResult,
  BulletSnapshot,
  GameSettings,
  Position,
  Direction,
  NewCardEvent,
  HandLogEntry,
  HandLogReason,
  SlotKind,
} from './types'
import { handItemLabel } from './types'
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  INITIAL_HP,
  MAX_HAND_SIZE,
  PHYSICS_TICKS_PER_TURN,
  P1_START_X,
  P2_START_X,
  START_Y,
  FUNCTION_DAMAGE,
  BULLET_SIZE,
  PLAYER_SIZE,
  MOVE_DISTANCE,
  WALL_REFLECTION_BONUS,
  ITEM_SIZE,
  DEFAULT_ITEM_SPAWN_RATES,
  DEFAULT_HEAL_AMOUNT_MIN,
  DEFAULT_HEAL_AMOUNT_MAX,
  MAX_ITEMS,
  ANIMATION_DURATION_MS,
  DEFAULT_SLOTS,
  DEFAULT_INITIAL_SLOTS,
  DEFAULT_POOLS,
  DEFAULT_DECAY_FACTOR,
} from './constants'
import { drawForTurn, drawInitialHand, inferSlotOfCard } from './pool-draw'
import { applyCalculation } from './calc-engine'
import { applyFunction } from './func-engine'
import { createBullet, tickBullets, checkBulletCollisions, checkPlayerHits } from './physics'
import { applyDamage, checkGameOver } from './damage'
import { checkCurveDamages } from './curve-collision'
import { expressionKey } from './func-engine'
import { isPrimeBullet } from './prime'
import {
  trySpawnItem,
  checkBulletItemCollisions,
  applyCurveDamageToItems,
  resolveItemPickupsForAll,
  applyItemReward,
  type ItemKill,
  type ItemPickup,
} from './items'

// 設定ファイルが無い場合に使うデフォルト設定。
// 旧来の mathXMax=10 / mathYMax=5 → pixelsPerUnit=40 相当
const DEFAULT_SETTINGS: GameSettings = {
  bulletRadius: BULLET_SIZE,
  playerRadius: PLAYER_SIZE,
  moveDistance: MOVE_DISTANCE,
  wallReflectionBonus: WALL_REFLECTION_BONUS,
  mathXMax: 10,
  mathYMax: 5,
  pixelsPerUnit: 40,
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

export const initializeGameState = (settings: GameSettings = DEFAULT_SETTINGS): GameState => ({
  phase: 'waiting',
  turn: 0,
  players: {},
  bullets: [],
  curves: [],
  items: [],
  fieldSize: { width: FIELD_WIDTH, height: FIELD_HEIGHT },
  settings,
})

export const addPlayer = (
  state: GameState,
  id: string,
  name: string,
  isFirst: boolean
): GameState => {
  const player: PlayerState = {
    id,
    name,
    hp: INITIAL_HP,
    position: { x: isFirst ? P1_START_X : P2_START_X, y: START_Y },
    facing: isFirst ? 'right' : 'left',
    hand: [],
    drawCounts: {},
    nextDraw: [],
  }
  return {
    ...state,
    players: { ...state.players, [id]: player },
  }
}

export interface StartGameResult {
  state: GameState
  // 初期手札として配られたカードの newCardEvent (player → events)
  newCardEvents: Record<string, NewCardEvent[]>
  // 初期手札の HandLog (player → entries)
  handLogEvents: Record<string, HandLogEntry[]>
}

// ゲーム開始 (2人揃った時に呼ぶ):
// 1. 各プレイヤーに初期手札 (settings.initialSlots) を配り、drawCounts を加算
// 2. 続いて「ターン1で配られる nextDraw」も事前抽選してロックする
// 初期手札は同じプールから抽選され、drawCounts にも反映される (確率低下が効く)。
export const startGame = (state: GameState): StartGameResult => {
  const newPlayers: Record<string, PlayerState> = { ...state.players }
  const newCardEvents: Record<string, NewCardEvent[]> = {}
  const handLogEvents: Record<string, HandLogEntry[]> = {}
  const maxHandSize = state.settings.maxHandSize

  for (const [id, player] of Object.entries(newPlayers)) {
    // 1. 初期手札を抽選
    const initial = drawInitialHand(state.settings, player.drawCounts)
    // 手札上限を超える分は静かにスキップ
    const room = Math.max(0, maxHandSize - player.hand.length)
    const incoming = initial.cards.slice(0, room)
    const handAfter = [...player.hand, ...incoming]

    // HandLog: 初期手札の追加イベント (枠ごとに reason を振り分け)
    // initial.perSlot を使うと枠ごとの内訳が分かるが、配列順序は drawForSlots の SLOT_ORDER 通り
    const logs: HandLogEntry[] = []
    let cursor = 0
    for (const slot of ['operator', 'number', 'other'] as const) {
      for (const card of initial.perSlot[slot]) {
        if (cursor >= incoming.length) break
        if (incoming[cursor] !== card) {
          // 念のため安全策: incoming に乗ったかどうかで判定
          cursor++
          continue
        }
        logs.push({
          kind: 'add',
          cardLabel: handItemLabel(card),
          reason: slot === 'operator' ? 'draw_op' : slot === 'number' ? 'draw_num' : 'draw_other',
        })
        cursor++
      }
    }
    if (logs.length > 0) handLogEvents[id] = logs

    // 玉飛行演出 (プール発信)
    if (incoming.length > 0) {
      const indices: number[] = []
      for (let i = 0; i < incoming.length; i++) indices.push(player.hand.length + i)
      newCardEvents[id] = [{ kind: 'pool', targetIndices: indices }]
    }

    // 2. ターン1用の nextDraw を抽選 (初期手札分が drawCounts に加算済みなので確率低下が効く)
    const next = drawForTurn(state.settings, initial.drawCounts)

    newPlayers[id] = {
      ...player,
      hand: handAfter,
      nextDraw: next.cards,
      drawCounts: next.drawCounts,
    }
  }

  return {
    state: { ...state, phase: 'draw', turn: 1, players: newPlayers },
    newCardEvents,
    handLogEvents,
  }
}

// SlotKind → HandLog の理由コードに変換
const reasonForSlot = (slot: SlotKind): HandLogReason => {
  if (slot === 'operator') return 'draw_op'
  if (slot === 'number') return 'draw_num'
  return 'draw_other'
}

export interface ExecuteDrawResult {
  state: GameState
  pickups: ItemPickup[]
  // 演出用: per-player に「プールから配られた」カードのインデックス情報
  // (アイテム拾得分は pickups 側に originPosition + targetIndices として入っている)
  newCardEvents: Record<string, NewCardEvent[]>
  // 手札ログ (補充された各カードの追加イベント)。viewerId → entries
  handLogEvents: Record<string, HandLogEntry[]>
}

// ターン開始の補充処理。
// 各プレイヤー:
//   1. 既に nextDraw にロック済みのカードを手札に追加 (handLog: add)
//   2. 次ターン用に drawForTurn で新しい nextDraw を抽選 (drawCounts も加算)
//   3. アイテムをスポーン + 接触拾得を解決
export const executeDraw = (state: GameState): ExecuteDrawResult => {
  const newPlayers: Record<string, PlayerState> = { ...state.players }
  const newCardEvents: Record<string, NewCardEvent[]> = {}
  const handLogEvents: Record<string, HandLogEntry[]> = {}
  const maxHandSize = state.settings.maxHandSize

  for (const [id, player] of Object.entries(newPlayers)) {
    const handBefore = player.hand
    // ロック済み nextDraw を手札に追加 (上限を超えた分は捨てられる = 静かにスキップ)
    const roomAvailable = Math.max(0, maxHandSize - handBefore.length)
    const incoming = player.nextDraw.slice(0, roomAvailable)
    const handAfter = [...handBefore, ...incoming]

    // 補充の HandLog 追加イベント
    const logs: HandLogEntry[] = []
    for (const card of incoming) {
      const slot = card.type === 'token' ? 'number' : inferSlotOfCard(card)
      logs.push({
        kind: 'add',
        cardLabel: handItemLabel(card),
        reason: reasonForSlot(slot),
      })
    }
    if (logs.length > 0) handLogEvents[id] = logs

    // 新規カード演出 (玉飛行) — 追加された連続インデックスを送る
    if (incoming.length > 0) {
      const indices: number[] = []
      for (let i = 0; i < incoming.length; i++) indices.push(handBefore.length + i)
      newCardEvents[id] = [{ kind: 'pool', targetIndices: indices }]
    } else {
      newCardEvents[id] = []
    }

    // 次ターン用の nextDraw を抽選
    const { cards: nextCards, drawCounts: nextCounts } = drawForTurn(state.settings, player.drawCounts)

    newPlayers[id] = {
      ...player,
      hand: handAfter,
      nextDraw: nextCards,
      drawCounts: nextCounts,
    }
  }

  // アイテムスポーン + 接触拾得
  const spawned = trySpawnItem(state.items, state.fieldSize, state.settings)
  let newItems = spawned ? [...state.items, spawned] : state.items

  const pickupRes = resolveItemPickupsForAll(newPlayers, newItems, state.settings)
  newItems = pickupRes.items
  Object.assign(newPlayers, pickupRes.players)
  for (const pk of pickupRes.pickups) {
    if (pk.targetIndices.length === 0) continue
    if (!newCardEvents[pk.pickerId]) newCardEvents[pk.pickerId] = []
    newCardEvents[pk.pickerId].push({
      kind: 'item',
      targetIndices: pk.targetIndices,
      originPosition: pk.originPosition,
      itemKind: pk.kind,
    })
  }

  return {
    state: { ...state, phase: 'action', players: newPlayers, items: newItems },
    pickups: pickupRes.pickups,
    newCardEvents,
    handLogEvents,
  }
}

const clampPosition = (
  x: number,
  y: number,
  fieldSize: { width: number; height: number },
  playerRadius: number
) => ({
  x: Math.max(playerRadius, Math.min(fieldSize.width - playerRadius, x)),
  y: Math.max(playerRadius, Math.min(fieldSize.height - playerRadius, y)),
})

const dirArrow = (d: Direction): string => ({ up: '↑', down: '↓', left: '←', right: '→' }[d])

const describeAction = (action: Action, player: PlayerState): string => {
  switch (action.type) {
    case 'use_move_card': {
      const item = player.hand[action.handIndex]
      const dir = item?.type === 'move' ? dirArrow(item.direction) : '?'
      return `${player.name} が ${dir} に移動`
    }
    case 'calculate':
      return `${player.name} が計算を実行`
    case 'attack': {
      const item = player.hand[action.handIndex]
      const raw = item?.type === 'number' ? item.value : item?.type === 'token' ? item.value : null
      const val = raw === null ? '?' : Number.isFinite(raw) ? raw : raw > 0 ? '∞' : '-∞'
      return `${player.name} が ${val} で攻撃`
    }
    case 'function':
      return `${player.name} が関数カードを使用`
    case 'discard': {
      const item = player.hand[action.handIndex]
      const lab = item ? handItemLabel(item) : '?'
      return `${player.name} が ${lab} を捨てた`
    }
    case 'skip':
      return `${player.name} はスキップ`
  }
}

// 移動カードを使用した即時移動。
// - 指定された手札インデックスが移動カードでなければ null
// - 該当カードの方向に moveDistance だけ動かして手札から消費する
// - 移動先のアイテムに触れたら即時拾得 (pickups に記録)
// - handLog: 移動カードを消費した remove イベント
export const applyImmediateMove = (
  state: GameState,
  playerId: string,
  handIndex: number
): { state: GameState; pickups: ItemPickup[]; handLog: HandLogEntry[] } | null => {
  const player = state.players[playerId]
  if (!player) return null
  const card = player.hand[handIndex]
  if (!card || card.type !== 'move') return null

  let { x, y } = player.position
  const dist = state.settings.moveDistance
  switch (card.direction) {
    case 'up': y -= dist; break
    case 'down': y += dist; break
    case 'left': x -= dist; break
    case 'right': x += dist; break
  }
  const clamped = clampPosition(x, y, state.fieldSize, state.settings.playerRadius)

  // 移動カード消費
  const consumed = [...player.hand]
  consumed.splice(handIndex, 1)
  const movedPlayer: PlayerState = { ...player, position: clamped, hand: consumed }

  const handLog: HandLogEntry[] = [
    { kind: 'remove', cardLabel: handItemLabel(card), reason: 'use_move' },
  ]

  // 移動後の状態で全プレイヤー一括の接触判定 (相手が既にアイテムに乗っていれば co-pickup)
  const playersAfterMove: Record<string, PlayerState> = {
    ...state.players,
    [playerId]: movedPlayer,
  }
  const pickupRes = resolveItemPickupsForAll(playersAfterMove, state.items, state.settings)

  return {
    state: {
      ...state,
      items: pickupRes.items,
      players: pickupRes.players,
    },
    pickups: pickupRes.pickups,
    handLog,
  }
}

// 関数カードを使った関数アクションの即時適用。
// functionCardIndex の関数カードと cardIndices の式構成カードを消費し、
// FunctionCurve をフィールドに追加する。
// 戻り値: 成功時は新しい state + 同ターン中に発生した曲線打ち消しイベント + HandLog
//          失敗時は null。
export const applyFunctionImmediate = (
  state: GameState,
  playerId: string,
  functionCardIndex: number,
  cardIndices: number[],
  xPositions: number[]
): { state: GameState; handLog: HandLogEntry[]; curveEvents: string[] } | null => {
  const player = state.players[playerId]
  if (!player) return null

  const handBefore = player.hand
  const result = applyFunction(handBefore, functionCardIndex, cardIndices, xPositions, playerId)
  if (!result) return null

  // HandLog: 関数カード本体 + 式構成カードの消費
  const handLog: HandLogEntry[] = []
  const fc = handBefore[functionCardIndex]
  if (fc) {
    handLog.push({ kind: 'remove', cardLabel: handItemLabel(fc), reason: 'function' })
  }
  for (const idx of cardIndices) {
    const item = handBefore[idx]
    if (!item) continue
    handLog.push({ kind: 'remove', cardLabel: handItemLabel(item), reason: 'function' })
  }

  // 既存の曲線と打ち消し判定: 同じ式が既にある (相手所有) なら両者消滅
  const existingCurves = [...state.curves]
  let nextCurves = [...existingCurves, result.curve]
  const curveEvents: string[] = []
  const newKey = expressionKey(result.curve.expression)
  const matchIdx = existingCurves.findIndex(
    (c) => c.owner !== playerId && expressionKey(c.expression) === newKey
  )
  if (matchIdx >= 0) {
    const matched = existingCurves[matchIdx]
    nextCurves = existingCurves.filter((c) => c.id !== matched.id)
    // 新しい曲線は追加せず、両者を打ち消した状態
    const nameA = player.name
    const nameB = state.players[matched.owner]?.name ?? matched.owner
    curveEvents.push(`🎯 ${nameA} と ${nameB} の ${result.curve.displayString} が打ち消し合い`)
  }

  return {
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: { ...player, hand: result.newHand },
      },
      curves: nextCurves,
    },
    handLog,
    curveEvents,
  }
}

// 手札から1枚を捨てる即時アクション。
// 成功時: 該当カードを除いた手札に置き換え、削除ログを返す。
// 失敗時: null (インデックス不正)
export const applyDiscard = (
  state: GameState,
  playerId: string,
  handIndex: number
): { state: GameState; handLog: HandLogEntry[] } | null => {
  const player = state.players[playerId]
  if (!player) return null
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= player.hand.length) return null

  const card = player.hand[handIndex]
  const newHand = [...player.hand]
  newHand.splice(handIndex, 1)
  const handLog: HandLogEntry[] = [
    { kind: 'remove', cardLabel: handItemLabel(card), reason: 'discard' },
  ]
  return {
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: { ...player, hand: newHand },
      },
    },
    handLog,
  }
}

export const resolveActions = (
  state: GameState,
  actions: Record<string, Action>
): { state: GameState; turnResult: TurnResult; handLogsByPlayer: Record<string, HandLogEntry[]> } => {
  let players = { ...state.players }
  let bullets = [...state.bullets]
  let curves = [...state.curves]
  let items = [...state.items]
  const bulletSnapshots: BulletSnapshot[] = []
  const itemKillsAccum: ItemKill[] = []
  const turnResult: TurnResult = {
    actions: {},
    damages: {},
    bulletEvents: [],
    bulletSnapshots: [],
    playerPositions: {},
    curveDamages: {},
    primeSynthesis: {},
    itemKills: [],
    curveEvents: [],
    heals: {},
  }
  // 解決処理中に発生した手札変化を viewer ごとに記録する。
  const handLogsByPlayer: Record<string, HandLogEntry[]> = {}
  const pushLog = (pid: string, entry: HandLogEntry) => {
    if (!handLogsByPlayer[pid]) handLogsByPlayer[pid] = []
    handLogsByPlayer[pid].push(entry)
  }

  // アクション解決
  for (const [id, action] of Object.entries(actions)) {
    const player = players[id]
    if (!player) continue

    turnResult.actions[id] = {
      type: action.type,
      description: describeAction(action, player),
    }

    switch (action.type) {
      case 'use_move_card':
      case 'discard':
      case 'function': {
        // 即時適用済み (server 側で applyImmediateMove / applyDiscard / applyFunctionImmediate を呼んでいる)。
        // ここでは何もしない (handLog も既に pendingHandEvents として server 側にある)。
        break
      }
      case 'skip': {
        break
      }
      case 'calculate': {
        // calculate は即時実行 (server 側) なので、resolveActions で再実行はしない。
        break
      }
      case 'attack': {
        const item = player.hand[action.handIndex]
        if (!item) break
        const value = item.type === 'number' ? item.value : item.type === 'token' ? item.value : null
        if (value === null) break

        const bullet = createBullet(id, player.position, player.facing, value)
        bullets.push(bullet)

        const newHand = [...player.hand]
        newHand.splice(action.handIndex, 1)
        players[id] = { ...player, hand: newHand }
        pushLog(id, { kind: 'remove', cardLabel: handItemLabel(item), reason: 'attack' })
        break
      }
    }
  }

  // 注: 関数カーブの打ち消しは applyFunctionImmediate で発動時に行う (即時化されたため)。
  // resolveActions では追加の打ち消し判定は不要。

  // 弾の初期スナップショット (アクション解決直後)
  bulletSnapshots.push({ bullets: bullets.map((b) => ({ ...b, position: { ...b.position }, velocity: { ...b.velocity } })) })

  // プレイヤー位置を記録
  for (const [id, p] of Object.entries(players)) {
    turnResult.playerPositions[id] = { ...p.position }
  }

  // 弾の物理シミュレーション
  const totalDamages: Record<string, number> = {}
  const totalHeals: Record<string, number> = {}

  for (let tick = 0; tick < PHYSICS_TICKS_PER_TURN; tick++) {
    const prevPositions = new Map<string, Position>(
      bullets.map((b) => [b.id, { ...b.position }])
    )
    bullets = tickBullets(bullets, state.fieldSize, state.settings)
    bullets = checkBulletCollisions(bullets, prevPositions, state.settings)
    const { bullets: remaining, damages } = checkPlayerHits(bullets, prevPositions, players, state.settings)
    bullets = remaining

    const itemHit = checkBulletItemCollisions(bullets, prevPositions, items, state.settings)
    bullets = itemHit.bullets
    items = itemHit.items
    if (itemHit.kills.length > 0) itemKillsAccum.push(...itemHit.kills)

    bulletSnapshots.push({ bullets: bullets.map((b) => ({ ...b, position: { ...b.position }, velocity: { ...b.velocity } })) })

    // 弾ダメージ。負値は回復として totalHeals に蓄積する (正の値のみ)。
    for (const [id, dmg] of Object.entries(damages)) {
      if (dmg >= 0) {
        totalDamages[id] = (totalDamages[id] ?? 0) + dmg
      } else {
        totalHeals[id] = (totalHeals[id] ?? 0) + -dmg
      }
    }
  }

  // 曲線ダメージ判定 (プレイヤー)
  const curveDmgs = checkCurveDamages(curves, players, FUNCTION_DAMAGE, state.settings)
  for (const [id, dmg] of Object.entries(curveDmgs)) {
    totalDamages[id] = (totalDamages[id] ?? 0) + dmg
    turnResult.curveDamages[id] = dmg
  }

  // 曲線ダメージ判定 (アイテム)
  const curveItemRes = applyCurveDamageToItems(curves, items, FUNCTION_DAMAGE, state.settings)
  items = curveItemRes.items
  if (curveItemRes.kills.length > 0) itemKillsAccum.push(...curveItemRes.kills)

  // アイテム撃破 → killer に報酬を適用
  const recordedKills: NonNullable<TurnResult['itemKills']> = []
  const killCountByItem = new Map<string, number>()
  for (const kill of itemKillsAccum) {
    killCountByItem.set(kill.itemId, (killCountByItem.get(kill.itemId) ?? 0) + 1)
  }
  for (const kill of itemKillsAccum) {
    const killer = players[kill.killerId]
    if (!killer) {
      recordedKills.push({ ...kill, awardedCount: 0 })
      continue
    }
    const handLenBefore = killer.hand.length
    const { player: nextKiller, awardedCount } = applyItemReward(killer, kill.kind, state.settings)
    if (awardedCount > 0) {
      players[kill.killerId] = nextKiller
      if (kill.kind === 'heal') {
        // applyItemReward 内で HP は既に加算済み → turnResult.heals だけ記録 (二重適用しない)
        turnResult.heals![kill.killerId] = (turnResult.heals![kill.killerId] ?? 0) + awardedCount
      } else {
        // 演算子/pack: 手札に追加されたカードを HandLog に
        const handAfter = players[kill.killerId].hand
        for (let i = handLenBefore; i < handAfter.length; i++) {
          const c = handAfter[i]
          if (!c) continue
          pushLog(kill.killerId, { kind: 'add', cardLabel: handItemLabel(c), reason: 'item_kill' })
        }
      }
    }
    recordedKills.push({ ...kill, awardedCount })
  }
  turnResult.itemKills = recordedKills

  // 同時撃破ログ
  const loggedCoKill = new Set<string>()
  for (const kill of itemKillsAccum) {
    if (loggedCoKill.has(kill.itemId)) continue
    if ((killCountByItem.get(kill.itemId) ?? 0) < 2) continue
    loggedCoKill.add(kill.itemId)
    const label = kill.kind === 'pack' ? '🎁 PACK' : kill.kind === 'heal' ? '❤️ HEAL' : kill.kind
    turnResult.bulletEvents.push(`🤝 ${label} を同時撃破! 両者が獲得`)
  }

  // ダメージ適用 (純ダメージは applyDamage、回復は clamp して加算)
  for (const [id, dmg] of Object.entries(totalDamages)) {
    if (!players[id]) continue
    players[id] = applyDamage(players[id], dmg)
    turnResult.damages[id] = dmg
  }
  // 弾の負ダメージ由来の回復 (アイテム回復は applyItemReward で既に適用済み)
  for (const [id, heal] of Object.entries(totalHeals)) {
    if (!players[id]) continue
    if (heal <= 0) continue
    const newHp = Math.min(INITIAL_HP, players[id].hp + heal)
    const actual = newHp - players[id].hp
    if (actual > 0) {
      players[id] = { ...players[id], hp: newHp }
      turnResult.heals![id] = (turnResult.heals![id] ?? 0) + actual
    }
  }

  turnResult.bulletSnapshots = bulletSnapshots

  const { gameOver } = checkGameOver(players)

  return {
    state: {
      ...state,
      phase: gameOver ? 'gameover' : 'result',
      players,
      bullets,
      curves,
      items,
    },
    turnResult,
    handLogsByPlayer,
  }
}

export interface SanitizeOptions {
  // 相手の視覚的な位置を上書きする (action フェーズ中に「相手の即時移動」を隠すために使用)
  opponentVisiblePosition?: Position
  // 演出用: 自プレイヤーの newCardEvents を me に載せる (プール/アイテムからの玉飛行アニメ)
  newCardEvents?: NewCardEvent[]
  // action フェーズ中に「相手が新規定義した関数曲線」を秘匿するための許可リスト。
  // ここに ID がある曲線か、または viewer 自身が所有する曲線だけが見える。
  // 通常は「ターン開始時点で存在した曲線の ID 集合」を渡す。
  visibleCurveIds?: Set<string>
}

export const sanitizeStateForPlayer = (
  state: GameState,
  playerId: string,
  turnResult?: TurnResult,
  opts?: SanitizeOptions
): ClientGameState => {
  const me = state.players[playerId]
  const opponentEntry = Object.entries(state.players).find(([id]) => id !== playerId)

  const opponent: SanitizedPlayerState = opponentEntry
    ? {
        id: opponentEntry[1].id,
        name: opponentEntry[1].name,
        hp: opponentEntry[1].hp,
        position: opts?.opponentVisiblePosition ?? opponentEntry[1].position,
        facing: opponentEntry[1].facing,
        handCount: opponentEntry[1].hand.length,
        nextDraw: opponentEntry[1].nextDraw,
      }
    : {
        id: '',
        name: '???',
        hp: INITIAL_HP,
        position: { x: 0, y: 0 },
        facing: 'left',
        handCount: 0,
        nextDraw: [],
      }

  const meOut = opts?.newCardEvents && opts.newCardEvents.length > 0
    ? { ...me, newCardEvents: opts.newCardEvents }
    : me

  // 関数曲線のフィルタ: action フェーズ中、相手が新規定義した曲線は viewer に見せない。
  // 「viewer 自身が所有する曲線」 または 「visibleCurveIds (ターン開始時に存在した) に含まれる曲線」
  // のみを表示する。
  const visibleCurves =
    state.phase === 'action' && opts?.visibleCurveIds
      ? state.curves.filter((c) => c.owner === playerId || opts.visibleCurveIds!.has(c.id))
      : state.curves

  return {
    phase: state.phase,
    turn: state.turn,
    me: meOut,
    opponent,
    bullets: state.bullets,
    curves: visibleCurves,
    items: state.items,
    fieldSize: state.fieldSize,
    settings: state.settings,
    turnResult,
  }
}
