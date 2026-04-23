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
} from './types'
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  INITIAL_HP,
  MOVE_DISTANCE,
  DRAW_COUNT,
  MAX_HAND_SIZE,
  PHYSICS_TICKS_PER_TURN,
  P1_START_X,
  P2_START_X,
  START_Y,
  MAX_FUNCTION_USES,
  FUNCTION_DAMAGE,
  NUMBER_REPLENISH_THRESHOLD,
} from './constants'
import { shuffleDeck, drawCards, createDefaultDeck } from './deck'
import { applyCalculation } from './calc-engine'
import { applyFunction } from './func-engine'
import { createBullet, tickBullets, checkBulletCollisions, checkPlayerHits } from './physics'
import { applyDamage, checkGameOver } from './damage'
import { checkCurveDamages } from './curve-collision'
import { isPrimeBullet } from './prime'

export const initializeGameState = (): GameState => ({
  phase: 'waiting',
  turn: 0,
  players: {},
  bullets: [],
  curves: [],
  fieldSize: { width: FIELD_WIDTH, height: FIELD_HEIGHT },
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

const replenishNumbers = (hand: HandItem[]): { hand: HandItem[]; added: HandItem[] } => {
  if (countNumberCards(hand) > NUMBER_REPLENISH_THRESHOLD) {
    return { hand, added: [] }
  }
  const added: HandItem[] = []
  for (let v = 1; v <= 9; v++) {
    if (hand.length + added.length >= MAX_HAND_SIZE) break
    added.push({ type: 'number', value: v })
  }
  return { hand: [...hand, ...added], added }
}

export const executeDraw = (
  state: GameState,
  decks: Map<string, Card[]>
): { state: GameState; decks: Map<string, Card[]>; drawnCards: Record<string, HandItem[]> } => {
  const newPlayers = { ...state.players }
  const newDecks = new Map(decks)
  const drawnCards: Record<string, HandItem[]> = {}

  for (const [id, player] of Object.entries(newPlayers)) {
    let deck = newDecks.get(id) ?? []
    // デッキが空なら新しいシャッフル済みデフォルトデッキで補充
    if (deck.length === 0) {
      deck = shuffleDeck(createDefaultDeck())
      newDecks.set(id, deck)
    }
    const canDraw = Math.min(DRAW_COUNT, deck.length, MAX_HAND_SIZE - player.hand.length)
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
    const { hand: replenishedHand, added } = replenishNumbers(handAfter)

    drawnCards[id] = [...drawnList, ...added]

    newPlayers[id] = {
      ...player,
      hand: replenishedHand,
      deckRemaining: remainingDeck.length,
    }
  }

  return {
    state: { ...state, phase: 'action', players: newPlayers },
    decks: newDecks,
    drawnCards,
  }
}

const clampPosition = (
  x: number,
  y: number,
  fieldSize: { width: number; height: number }
) => ({
  x: Math.max(24, Math.min(fieldSize.width - 24, x)),
  y: Math.max(24, Math.min(fieldSize.height - 24, y)),
})

const describeAction = (action: Action, player: PlayerState): string => {
  switch (action.type) {
    case 'move':
      return `${player.name} が ${action.direction} に移動`
    case 'calculate':
      return `${player.name} が計算を実行`
    case 'attack': {
      const item = player.hand[action.handIndex]
      const val = item?.type === 'number' ? item.value : item?.type === 'token' ? item.value : '?'
      return `${player.name} が ${val} で攻撃`
    }
    case 'function':
      return `${player.name} が関数を定義`
  }
}

export const resolveActions = (
  state: GameState,
  actions: Record<string, Action>
): { state: GameState; turnResult: TurnResult } => {
  let players = { ...state.players }
  let bullets = [...state.bullets]
  let curves = [...state.curves]
  const bulletSnapshots: BulletSnapshot[] = []
  const turnResult: TurnResult = { actions: {}, damages: {}, bulletEvents: [], bulletSnapshots: [], playerPositions: {}, curveDamages: {}, primeSynthesis: {} }

  // アクション解決
  for (const [id, action] of Object.entries(actions)) {
    const player = players[id]
    if (!player) continue

    turnResult.actions[id] = {
      type: action.type,
      description: describeAction(action, player),
    }

    switch (action.type) {
      case 'move': {
        let { x, y } = player.position
        switch (action.direction) {
          case 'up': y -= MOVE_DISTANCE; break
          case 'down': y += MOVE_DISTANCE; break
          case 'left': x -= MOVE_DISTANCE; break
          case 'right': x += MOVE_DISTANCE; break
        }
        const clamped = clampPosition(x, y, state.fieldSize)
        players[id] = { ...player, position: clamped }
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

  // 弾の初期スナップショット (アクション解決直後)
  bulletSnapshots.push({ bullets: bullets.map((b) => ({ ...b, position: { ...b.position }, velocity: { ...b.velocity } })) })

  // プレイヤー位置を記録
  for (const [id, p] of Object.entries(players)) {
    turnResult.playerPositions[id] = { ...p.position }
  }

  // 弾の物理シミュレーション
  const totalDamages: Record<string, number> = {}

  for (let tick = 0; tick < PHYSICS_TICKS_PER_TURN; tick++) {
    bullets = tickBullets(bullets, state.fieldSize)
    bullets = checkBulletCollisions(bullets)
    const { bullets: remaining, damages } = checkPlayerHits(bullets, players)
    bullets = remaining

    // 各tickのスナップショットを保存
    bulletSnapshots.push({ bullets: bullets.map((b) => ({ ...b, position: { ...b.position }, velocity: { ...b.velocity } })) })

    for (const [id, dmg] of Object.entries(damages)) {
      totalDamages[id] = (totalDamages[id] ?? 0) + dmg
    }
  }

  // 曲線ダメージ判定
  const curveDmgs = checkCurveDamages(curves, players, FUNCTION_DAMAGE)
  for (const [id, dmg] of Object.entries(curveDmgs)) {
    totalDamages[id] = (totalDamages[id] ?? 0) + dmg
    turnResult.curveDamages[id] = dmg
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
    },
    turnResult,
  }
}

export const sanitizeStateForPlayer = (
  state: GameState,
  playerId: string,
  turnResult?: TurnResult
): ClientGameState => {
  const me = state.players[playerId]
  const opponentEntry = Object.entries(state.players).find(([id]) => id !== playerId)

  const opponent: SanitizedPlayerState = opponentEntry
    ? {
        id: opponentEntry[1].id,
        name: opponentEntry[1].name,
        hp: opponentEntry[1].hp,
        position: opponentEntry[1].position,
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
    fieldSize: state.fieldSize,
    turnResult,
  }
}
