import type {
  GameState,
  PlayerState,
  Action,
  Card,
  HandItem,
  ClientGameState,
  SanitizedPlayerState,
  TurnResult,
  BulletSnapshot,
  Bullet,
  GameSettings,
  Position,
  Direction,
} from './types'
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  INITIAL_HP,
  DRAW_COUNT,
  MAX_HAND_SIZE,
  MIN_DECK_SIZE,
  MAX_DECK_SIZE,
  PHYSICS_TICKS_PER_TURN,
  P1_START_X,
  P2_START_X,
  START_Y,
  MAX_FUNCTION_USES,
  FUNCTION_DAMAGE,
  NUMBER_REPLENISH_THRESHOLD,
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
} from './constants'
import { shuffleDeck, drawCards, createDefaultDeck } from './deck'
import { applyCalculation } from './calc-engine'
import { applyFunction } from './func-engine'
import { createBullet, tickBullets, checkBulletCollisions, checkPlayerHits } from './physics'
import { applyDamage, checkGameOver } from './damage'
import { checkCurveDamages } from './curve-collision'
import { expressionKey } from './func-engine'
import { isPrimeBullet } from './prime'
import { trySpawnItem, checkBulletItemCollisions, applyCurveDamageToItems, resolveItemPickupsForAll, applyItemReward, type ItemKill, type ItemPickup } from './items'

// 設定ファイルが無い場合に使うデフォルト設定 (既存の constants と同等)
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
  drawCount: DRAW_COUNT,
  maxHandSize: MAX_HAND_SIZE,
  minDeckSize: MIN_DECK_SIZE,
  maxDeckSize: MAX_DECK_SIZE,
  animationDurationMs: ANIMATION_DURATION_MS,
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
    deckRemaining: 0,
    functionUsesRemaining: MAX_FUNCTION_USES,
  }
  return {
    ...state,
    players: { ...state.players, [id]: player },
  }
}

export const startGame = (
  state: GameState,
  decks: Map<string, Card[]>
): { state: GameState; decks: Map<string, Card[]> } => {
  const shuffledDecks = new Map<string, Card[]>()
  const newPlayers = { ...state.players }

  for (const [id, deck] of decks) {
    shuffledDecks.set(id, shuffleDeck(deck))
    newPlayers[id] = { ...newPlayers[id], deckRemaining: deck.length }
  }

  return {
    state: { ...state, phase: 'draw', turn: 1, players: newPlayers },
    decks: shuffledDecks,
  }
}

const countNumberCards = (hand: HandItem[]): number =>
  hand.filter((item) => item.type === 'number' || item.type === 'token').length

const replenishNumbers = (
  hand: HandItem[],
  maxHandSize: number
): { hand: HandItem[]; added: HandItem[] } => {
  if (countNumberCards(hand) > NUMBER_REPLENISH_THRESHOLD) {
    return { hand, added: [] }
  }
  const added: HandItem[] = []
  for (let v = 1; v <= 9; v++) {
    if (hand.length + added.length >= maxHandSize) break
    added.push({ type: 'number', value: v })
  }
  return { hand: [...hand, ...added], added }
}

// 移動カードの自動補充: 各方向ごとに手札に1枚もなければ補充する。
// これによりプレイヤーが移動できなくなる詰みを防ぐ (CLAUDE.md: 自動供給)。
const ALL_DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']
const replenishMoves = (
  hand: HandItem[],
  maxHandSize: number
): { hand: HandItem[]; added: HandItem[] } => {
  const owned = new Set<Direction>()
  for (const item of hand) {
    if (item.type === 'move') owned.add(item.direction)
  }
  const added: HandItem[] = []
  for (const dir of ALL_DIRECTIONS) {
    if (owned.has(dir)) continue
    if (hand.length + added.length >= maxHandSize) break
    added.push({ type: 'move', direction: dir })
  }
  return { hand: [...hand, ...added], added }
}

export const executeDraw = (
  state: GameState,
  decks: Map<string, Card[]>
): { state: GameState; decks: Map<string, Card[]>; drawnCards: Record<string, HandItem[]>; pickups: ItemPickup[] } => {
  const newPlayers = { ...state.players }
  const newDecks = new Map(decks)
  const drawnCards: Record<string, HandItem[]> = {}
  const drawCount = state.settings.drawCount
  const maxHandSize = state.settings.maxHandSize

  for (const [id, player] of Object.entries(newPlayers)) {
    let deck = newDecks.get(id) ?? []
    // デッキが空なら新しいシャッフル済みデフォルトデッキで補充
    if (deck.length === 0) {
      deck = shuffleDeck(createDefaultDeck())
      newDecks.set(id, deck)
    }
    const canDraw = Math.min(drawCount, deck.length, maxHandSize - player.hand.length)
    let handAfter = player.hand
    let drawnList: HandItem[] = []
    let remainingDeck = deck

    if (canDraw > 0) {
      const { drawn, remaining } = drawCards(deck, canDraw)
      newDecks.set(id, remaining)
      drawnList = drawn
      handAfter = [...handAfter, ...drawn]
      remainingDeck = remaining
    }

    // 数字カードが閾値以下なら 1-9 を補充
    const { hand: numReplenished, added: numAdded } = replenishNumbers(handAfter, maxHandSize)
    // 各方向の移動カードがなければ補充
    const { hand: replenishedHand, added: moveAdded } = replenishMoves(numReplenished, maxHandSize)

    drawnCards[id] = [...drawnList, ...numAdded, ...moveAdded]

    newPlayers[id] = {
      ...player,
      hand: replenishedHand,
      deckRemaining: remainingDeck.length,
    }
  }

  // ターン開始時にアイテムをランダム生成 (settings.itemSpawnRate, settings.maxItems を使用)
  const spawned = trySpawnItem(state.items, state.fieldSize, state.settings)
  let newItems = spawned ? [...state.items, spawned] : state.items

  // スポーン直後にプレイヤーの上に重なっていれば即時拾得 (両者が同時に重なれば co-pickup)
  const pickupRes = resolveItemPickupsForAll(newPlayers, newItems, state.settings)
  newItems = pickupRes.items
  Object.assign(newPlayers, pickupRes.players)

  return {
    state: { ...state, phase: 'action', players: newPlayers, items: newItems },
    decks: newDecks,
    drawnCards,
    pickups: pickupRes.pickups,
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
      const val = raw === null ? '?' : Number.isFinite(raw) ? raw : '∞'
      return `${player.name} が ${val} で攻撃`
    }
    case 'function':
      return `${player.name} が関数を定義`
    case 'skip':
      return `${player.name} はスキップ`
  }
}

// 移動カードを使用した即時移動。
// - 指定された手札インデックスが移動カードでなければ null
// - 該当カードの方向に moveDistance だけ動かして手札から消費する
// - 移動先のアイテムに触れたら即時拾得 (pickups に記録)
export const applyImmediateMove = (
  state: GameState,
  playerId: string,
  handIndex: number
): { state: GameState; pickups: ItemPickup[] } | null => {
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
  }
}

export const resolveActions = (
  state: GameState,
  actions: Record<string, Action>
): { state: GameState; turnResult: TurnResult } => {
  let players = { ...state.players }
  let bullets = [...state.bullets]
  let curves = [...state.curves]
  let items = [...state.items]
  const bulletSnapshots: BulletSnapshot[] = []
  const itemKillsAccum: ItemKill[] = []
  const turnResult: TurnResult = { actions: {}, damages: {}, bulletEvents: [], bulletSnapshots: [], playerPositions: {}, curveDamages: {}, primeSynthesis: {}, itemKills: [], curveEvents: [] }

  // アクション解決
  for (const [id, action] of Object.entries(actions)) {
    const player = players[id]
    if (!player) continue

    turnResult.actions[id] = {
      type: action.type,
      description: describeAction(action, player),
    }

    switch (action.type) {
      case 'use_move_card': {
        // 移動カードは action フェーズ中に即時適用済み。ここでは何もしない
        break
      }
      case 'skip': {
        // スキップ: 何もしない
        break
      }
      case 'calculate': {
        const newHand = applyCalculation(player.hand, action.cardIndices)
        if (newHand) {
          players[id] = { ...player, hand: newHand }
          // 末尾に追加された結果トークンを取り出して素数判定
          const last = newHand[newHand.length - 1]
          if (last && last.type === 'token' && isPrimeBullet(last.value)) {
            turnResult.primeSynthesis![id] = last.value
            turnResult.actions[id].description += ` (PRIME! ${last.value})`
          }
        } else {
          turnResult.actions[id].description += ' (失敗)'
        }
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
        break
      }
      case 'function': {
        const result = applyFunction(
          player.hand,
          action.cardIndices,
          action.xPositions,
          id,
          player.functionUsesRemaining
        )
        if (result) {
          curves.push(result.curve)
          players[id] = {
            ...player,
            hand: result.newHand,
            functionUsesRemaining: player.functionUsesRemaining - 1,
          }
          turnResult.actions[id].description += ` (${result.curve.displayString})`
        } else {
          turnResult.actions[id].description += ' (失敗)'
        }
        break
      }
    }
  }

  // 関数カーブの打ち消し処理: このターン新たに定義された曲線が、既存・同ターン内の
  // 相手の曲線と式が一致する場合、両者をフィールドから取り除く (1対1ペアリング)。
  // 同じプレイヤーの重複は damage 集計時に dedupe するのでここでは除去しない。
  {
    const preexistingIds = new Set(state.curves.map((c) => c.id))
    const newCurves = curves.filter((c) => !preexistingIds.has(c.id))
    const removeIds = new Set<string>()
    for (const newCurve of newCurves) {
      if (removeIds.has(newCurve.id)) continue
      const match = curves.find(
        (c) =>
          c.id !== newCurve.id &&
          c.owner !== newCurve.owner &&
          !removeIds.has(c.id) &&
          expressionKey(c.expression) === expressionKey(newCurve.expression)
      )
      if (match) {
        removeIds.add(newCurve.id)
        removeIds.add(match.id)
        const nameA = players[newCurve.owner]?.name ?? newCurve.owner
        const nameB = players[match.owner]?.name ?? match.owner
        turnResult.curveEvents!.push(
          `🎯 ${nameA} と ${nameB} の ${newCurve.displayString} が打ち消し合い`
        )
      }
    }
    if (removeIds.size > 0) curves = curves.filter((c) => !removeIds.has(c.id))
  }

  // 弾の初期スナップショット (アクション解決直後)
  bulletSnapshots.push({ bullets: bullets.map((b) => ({ ...b, position: { ...b.position }, velocity: { ...b.velocity } })) })

  // プレイヤー位置を記録
  for (const [id, p] of Object.entries(players)) {
    turnResult.playerPositions[id] = { ...p.position }
  }

  // 弾の物理シミュレーション
  const totalDamages: Record<string, number> = {}

  for (let tick = 0; tick < PHYSICS_TICKS_PER_TURN; tick++) {
    // tick前の位置を保存 (連続衝突判定用)
    const prevPositions = new Map<string, Position>(
      bullets.map((b) => [b.id, { ...b.position }])
    )
    bullets = tickBullets(bullets, state.fieldSize, state.settings)
    bullets = checkBulletCollisions(bullets, prevPositions, state.settings)
    const { bullets: remaining, damages } = checkPlayerHits(bullets, prevPositions, players, state.settings)
    bullets = remaining

    // 弾 vs アイテム衝突 (プレイヤーヒット後の生き残り弾で判定)
    const itemHit = checkBulletItemCollisions(bullets, prevPositions, items, state.settings)
    bullets = itemHit.bullets
    items = itemHit.items
    if (itemHit.kills.length > 0) itemKillsAccum.push(...itemHit.kills)

    // 各tickのスナップショットを保存
    bulletSnapshots.push({ bullets: bullets.map((b) => ({ ...b, position: { ...b.position }, velocity: { ...b.velocity } })) })

    for (const [id, dmg] of Object.entries(damages)) {
      totalDamages[id] = (totalDamages[id] ?? 0) + dmg
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

  // アイテム撃破 → killer に報酬を適用 (演算子カード追加 / heal なら HP 回復)
  // pack の場合は4種演算子を一括付与 (空きが足りなければ入る分だけ)
  // 同一アイテムIDが複数 (=co-kill) の場合は全員にそれぞれ報酬を付与する
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
    const { player: nextKiller, awardedCount } = applyItemReward(killer, kill.kind, state.settings)
    if (awardedCount > 0) {
      players[kill.killerId] = nextKiller
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

  // ダメージ適用
  for (const [id, dmg] of Object.entries(totalDamages)) {
    if (players[id]) {
      players[id] = applyDamage(players[id], dmg)
      turnResult.damages[id] = dmg
    }
  }

  turnResult.bulletSnapshots = bulletSnapshots

  const { gameOver, winnerId } = checkGameOver(players)

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
  }
}

export interface SanitizeOptions {
  // 相手の視覚的な位置を上書きする (action フェーズ中に「相手の即時移動」を隠すために使用)
  opponentVisiblePosition?: Position
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
        deckRemaining: opponentEntry[1].deckRemaining,
        functionUsesRemaining: opponentEntry[1].functionUsesRemaining,
      }
    : {
        id: '',
        name: '???',
        hp: INITIAL_HP,
        position: { x: 0, y: 0 },
        facing: 'left',
        handCount: 0,
        deckRemaining: 0,
        functionUsesRemaining: MAX_FUNCTION_USES,
      }

  return {
    phase: state.phase,
    turn: state.turn,
    me,
    opponent,
    bullets: state.bullets,
    curves: state.curves,
    items: state.items,
    fieldSize: state.fieldSize,
    settings: state.settings,
    turnResult,
  }
}
