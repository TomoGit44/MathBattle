import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import type { GameState, Action, ClientMessage, ServerMessage, Position, NewCardEvent, HandLogEntry, TurnResult } from '../lib/types'
import { handItemLabel } from '../lib/types'
import {
  initializeGameState,
  addPlayer,
  startGame,
  executeDraw,
  resolveActions,
  sanitizeStateForPlayer,
  applyImmediateMove,
  applyDiscard,
  applyFunctionImmediate,
} from '../lib/game-logic'
import { checkGameOver } from '../lib/damage'
import { tryApplyCalculation, calcErrorMessage } from '../lib/calc-engine'
import { isPrimeBullet } from '../lib/prime'
import { loadConfig, isUnlimited, toGameSettings } from '../lib/config'
import { encodeMessage, decodeMessage } from '../lib/json-codec'
import type { ItemPickup } from '../lib/items'

const CONFIG = loadConfig()
const GAME_SETTINGS = toGameSettings(CONFIG)
// 次ターン開始までの遅延 = アニメーション再生時間 + 1秒の余白
const TURN_DELAY_MS = GAME_SETTINGS.animationDurationMs + 1000

interface PlayerConnection {
  ws: WebSocket
  id: string
  name: string
}

interface Room {
  id: string
  gameState: GameState
  pendingActions: Map<string, Action>
  playerOrder: string[]
  players: Map<string, PlayerConnection>
  actionTimer: ReturnType<typeof setTimeout> | null
  // ターン開始時の各プレイヤー位置 (action フェーズ中の即時移動を相手に対して秘匿するため)
  turnStartPositions: Map<string, Position>
  // 即時アクション (移動・ドロー直後) で発生したアイテム拾得を蓄積し、次の TurnResult で公開する
  pendingItemPickups: ItemPickup[]
  // 直近のドロー/拾得で「新規カードを玉飛行で表示する」イベント。1度送ったらクリア。
  pendingNewCardEvents: Map<string, NewCardEvent[]>
  // 手札変動ログを viewer ごとにバッファ。
  // 補充 / 即時アクション (calc/move/discard) / 解決時 (attack/function) の追加・削除を蓄積し、
  // 次のターン結果送信時に TurnResult.handLog として viewer ごとに配信する。
  pendingHandEvents: Map<string, HandLogEntry[]>
}

const rooms = new Map<string, Room>()

const createRoom = (roomId: string): Room => ({
  id: roomId,
  gameState: initializeGameState(GAME_SETTINGS),
  pendingActions: new Map(),
  playerOrder: [],
  players: new Map(),
  actionTimer: null,
  turnStartPositions: new Map(),
  pendingItemPickups: [],
  pendingNewCardEvents: new Map(),
  pendingHandEvents: new Map(),
})

const captureTurnStartPositions = (room: Room) => {
  room.turnStartPositions.clear()
  for (const [id, p] of Object.entries(room.gameState.players)) {
    room.turnStartPositions.set(id, { ...p.position })
  }
}

const sanitizeOptsFor = (room: Room, viewerId: string) => {
  const opts: { opponentVisiblePosition?: Position; newCardEvents?: NewCardEvent[] } = {}

  if (room.gameState.phase === 'action') {
    const opponentEntry = Object.entries(room.gameState.players).find(([id]) => id !== viewerId)
    if (opponentEntry) {
      const [oppId] = opponentEntry
      const original = room.turnStartPositions.get(oppId)
      if (original) opts.opponentVisiblePosition = original
    }
  }

  const events = room.pendingNewCardEvents.get(viewerId)
  if (events && events.length > 0) opts.newCardEvents = events

  return Object.keys(opts).length > 0 ? opts : undefined
}

const getOrCreateRoom = (roomId: string): Room => {
  let room = rooms.get(roomId)
  if (!room) {
    room = createRoom(roomId)
    rooms.set(roomId, room)
  }
  return room
}

const send = (ws: WebSocket, msg: ServerMessage) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(encodeMessage(msg))
  }
}

// HandLog バッファに追記
const pushHandEvent = (room: Room, viewerId: string, entry: HandLogEntry) => {
  const arr = room.pendingHandEvents.get(viewerId) ?? []
  arr.push(entry)
  room.pendingHandEvents.set(viewerId, arr)
}

const pushHandEvents = (room: Room, viewerId: string, entries: HandLogEntry[]) => {
  if (entries.length === 0) return
  const arr = room.pendingHandEvents.get(viewerId) ?? []
  arr.push(...entries)
  room.pendingHandEvents.set(viewerId, arr)
}

// TurnResult を viewer ごとに「自分の handLog のみ」付与した形に変換して送る。
const sendStateToAll = (room: Room, turnResult?: TurnResult) => {
  for (const [playerId, pc] of room.players) {
    if (!room.gameState.players[playerId]) continue

    let personalResult: TurnResult | undefined = turnResult
    if (turnResult) {
      personalResult = {
        ...turnResult,
        handLog: room.pendingHandEvents.get(playerId) ?? [],
      }
    }

    if (room.gameState.phase === 'gameover') {
      const { winnerId } = checkGameOver(room.gameState.players)
      send(pc.ws, {
        type: 'gameOver',
        winnerId,
        state: sanitizeStateForPlayer(room.gameState, playerId, personalResult, sanitizeOptsFor(room, playerId)),
      })
    } else {
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, playerId, personalResult, sanitizeOptsFor(room, playerId)),
      })
    }
  }
}

const startActionTimer = (room: Room) => {
  if (room.actionTimer) clearTimeout(room.actionTimer)
  if (isUnlimited(CONFIG)) {
    room.actionTimer = null
    return
  }
  room.actionTimer = setTimeout(() => {
    for (const id of room.playerOrder) {
      if (!room.pendingActions.has(id)) {
        room.pendingActions.set(id, { type: 'skip' })
      }
    }
    resolveRound(room)
  }, CONFIG.actionTimeoutSec * 1000)
}

const startNewTurn = (room: Room) => {
  room.gameState = { ...room.gameState, turn: room.gameState.turn + 1 }
  const result = executeDraw(room.gameState)
  room.gameState = result.state
  room.pendingActions.clear()
  if (result.pickups.length > 0) {
    room.pendingItemPickups.push(...result.pickups)
  }
  room.pendingNewCardEvents.clear()
  for (const [pid, evts] of Object.entries(result.newCardEvents)) {
    if (evts.length > 0) room.pendingNewCardEvents.set(pid, evts)
  }
  // 補充ログをバッファに加える (次回 resolveRound で TurnResult.handLog として送る)
  for (const [pid, entries] of Object.entries(result.handLogEvents)) {
    pushHandEvents(room, pid, entries)
  }
  captureTurnStartPositions(room)
  sendStateToAll(room)
  room.pendingNewCardEvents.clear()
  startActionTimer(room)
}

const resolveRound = (room: Room) => {
  if (room.actionTimer) {
    clearTimeout(room.actionTimer)
    room.actionTimer = null
  }

  room.gameState = { ...room.gameState, phase: 'resolving' }

  const actions = Object.fromEntries(room.pendingActions)
  const { state, turnResult, handLogsByPlayer } = resolveActions(room.gameState, actions)
  room.gameState = state

  // resolveActions 内で発生した hand 変動 (attack/function/item-kill) を viewer ごとにバッファへ追加
  for (const [pid, entries] of Object.entries(handLogsByPlayer)) {
    pushHandEvents(room, pid, entries)
  }

  if (room.pendingItemPickups.length > 0) {
    turnResult.itemPickups = [
      ...(turnResult.itemPickups ?? []),
      ...room.pendingItemPickups,
    ]

    room.pendingNewCardEvents.clear()
    for (const pk of room.pendingItemPickups) {
      if (pk.targetIndices.length === 0) continue
      const evts = room.pendingNewCardEvents.get(pk.pickerId) ?? []
      evts.push({
        kind: 'item',
        targetIndices: pk.targetIndices,
        originPosition: pk.originPosition,
        itemKind: pk.kind,
      })
      room.pendingNewCardEvents.set(pk.pickerId, evts)
    }

    room.pendingItemPickups = []
  }

  if (turnResult.itemPickups && turnResult.itemPickups.length >= 2) {
    const countByItem = new Map<string, number>()
    for (const p of turnResult.itemPickups) {
      countByItem.set(p.itemId, (countByItem.get(p.itemId) ?? 0) + 1)
    }
    const logged = new Set<string>()
    for (const p of turnResult.itemPickups) {
      if (logged.has(p.itemId)) continue
      if ((countByItem.get(p.itemId) ?? 0) < 2) continue
      logged.add(p.itemId)
      const label = p.kind === 'pack' ? '🎁 PACK' : p.kind === 'heal' ? '❤️ HEAL' : p.kind
      turnResult.bulletEvents.push(`🤝 ${label} を同時拾得! 両者が獲得`)
    }
  }

  sendStateToAll(room, turnResult)
  room.pendingNewCardEvents.clear()
  // handLog はこのターン分で消費。次ターンは新たな補充ログから始まる。
  room.pendingHandEvents.clear()

  if (room.gameState.phase === 'gameover') return

  setTimeout(() => {
    startNewTurn(room)
  }, TURN_DELAY_MS)
}

const handleJoin = (room: Room, ws: WebSocket, connId: string, name: string) => {
  if (room.playerOrder.includes(connId)) return
  if (room.playerOrder.length >= 2) {
    send(ws, { type: 'error', message: 'ルームが満員です' })
    return
  }

  const isFirst = room.playerOrder.length === 0
  room.playerOrder.push(connId)
  room.players.set(connId, { ws, id: connId, name })
  room.gameState = addPlayer(room.gameState, connId, name, isFirst)

  if (room.playerOrder.length < 2) {
    send(ws, { type: 'waiting', roomId: room.id })
    return
  }

  // 2人揃った → ゲーム開始 (初期手札を配り、turn=1 用の nextDraw を事前抽選)
  const started = startGame(room.gameState)
  room.gameState = started.state

  // 初期手札の演出・HandLog をバッファに登録
  room.pendingNewCardEvents.clear()
  for (const [pid, evts] of Object.entries(started.newCardEvents)) {
    if (evts.length > 0) room.pendingNewCardEvents.set(pid, evts)
  }
  for (const [pid, entries] of Object.entries(started.handLogEvents)) {
    pushHandEvents(room, pid, entries)
  }

  // 初回ドロー (turn=1 の補充)。
  // 初期手札の orb 演出と turn=1 の補充演出を同時に飛ばすため、
  // newCardEvents をマージする (初期手札 [0..N-1] のあと turn 1 補充 [N..N+M-1])。
  const drawn = executeDraw(room.gameState)
  room.gameState = drawn.state
  if (drawn.pickups.length > 0) {
    room.pendingItemPickups.push(...drawn.pickups)
  }
  for (const [pid, evts] of Object.entries(drawn.newCardEvents)) {
    if (evts.length === 0) continue
    const existing = room.pendingNewCardEvents.get(pid) ?? []
    room.pendingNewCardEvents.set(pid, [...existing, ...evts])
  }
  for (const [pid, entries] of Object.entries(drawn.handLogEvents)) {
    pushHandEvents(room, pid, entries)
  }

  captureTurnStartPositions(room)
  sendStateToAll(room)
  room.pendingNewCardEvents.clear()
  startActionTimer(room)
}

const handleAction = (room: Room, ws: WebSocket, connId: string, action: Action) => {
  if (room.gameState.phase !== 'action') {
    send(ws, { type: 'error', message: 'アクション選択フェーズではありません' })
    return
  }

  if (!room.playerOrder.includes(connId)) return

  // 移動カード使用は即時処理 (回数制限なし)
  if (action.type === 'use_move_card') {
    const next = applyImmediateMove(room.gameState, connId, action.handIndex)
    if (!next) {
      send(ws, { type: 'error', message: '移動カードが選択されていません' })
      return
    }
    room.gameState = next.state
    if (next.pickups.length > 0) {
      room.pendingItemPickups.push(...next.pickups)
    }
    pushHandEvents(room, connId, next.handLog)

    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, connId, undefined, sanitizeOptsFor(room, connId)),
    })
    return
  }

  // 計算アクションは即時処理 (1ターンに何度でも可能)
  if (action.type === 'calculate') {
    const player = room.gameState.players[connId]
    if (!player) return

    if (!Array.isArray(action.cardIndices)) {
      send(ws, { type: 'error', message: '計算リクエストが不正です' })
      return
    }

    const handBefore = player.hand
    const result = tryApplyCalculation(handBefore, action.cardIndices)
    if (!result.ok) {
      send(ws, { type: 'error', message: calcErrorMessage(result.reason) })
      return
    }
    const newHand = result.newHand

    room.gameState = {
      ...room.gameState,
      players: {
        ...room.gameState.players,
        [connId]: { ...player, hand: newHand },
      },
    }

    // HandLog: 消費したカード (remove × N) + 結果トークン (add)
    for (const idx of action.cardIndices) {
      const item = handBefore[idx]
      if (!item) continue
      pushHandEvent(room, connId, { kind: 'remove', cardLabel: handItemLabel(item), reason: 'calc' })
    }
    const last = newHand[newHand.length - 1]
    if (last) {
      pushHandEvent(room, connId, { kind: 'add', cardLabel: handItemLabel(last), reason: 'calc_result' })
    }

    // 素数合成検出 → PRIME演出用の TurnResult を即時送信
    let primeResult: TurnResult | undefined
    if (last && last.type === 'token' && isPrimeBullet(last.value)) {
      primeResult = {
        actions: {},
        damages: {},
        bulletEvents: [],
        bulletSnapshots: [],
        playerPositions: {},
        curveDamages: {},
        primeSynthesis: { [connId]: last.value },
      }
    }

    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, connId, primeResult, sanitizeOptsFor(room, connId)),
    })

    // 相手にも handCount 更新を反映 (TurnResult は付けない)
    for (const [otherId, pc] of room.players) {
      if (otherId === connId) continue
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, otherId, undefined, sanitizeOptsFor(room, otherId)),
      })
    }
    return
  }

  // 関数カードを使った関数定義は即時処理 (関数カード 1 枚を消費)
  if (action.type === 'function') {
    if (
      !Number.isInteger(action.functionCardIndex) ||
      !Array.isArray(action.cardIndices) ||
      !Array.isArray(action.xPositions)
    ) {
      send(ws, { type: 'error', message: '関数リクエストが不正です' })
      return
    }
    const next = applyFunctionImmediate(
      room.gameState,
      connId,
      action.functionCardIndex,
      action.cardIndices,
      action.xPositions
    )
    if (!next) {
      send(ws, { type: 'error', message: '関数式が不正です (式の長さ・x の有無を確認してください)' })
      return
    }
    room.gameState = next.state
    pushHandEvents(room, connId, next.handLog)

    // 打ち消しイベントを bulletEvents 風に両者へ配信するため、専用 TurnResult を作る
    let extraResult: TurnResult | undefined
    if (next.curveEvents.length > 0) {
      extraResult = {
        actions: {},
        damages: {},
        bulletEvents: [],
        bulletSnapshots: [],
        playerPositions: {},
        curveDamages: {},
        curveEvents: next.curveEvents,
      }
    }

    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, connId, extraResult, sanitizeOptsFor(room, connId)),
    })
    for (const [otherId, pc] of room.players) {
      if (otherId === connId) continue
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, otherId, extraResult, sanitizeOptsFor(room, otherId)),
      })
    }
    return
  }

  // 捨て札は即時処理 (回数制限なし)
  if (action.type === 'discard') {
    const next = applyDiscard(room.gameState, connId, action.handIndex)
    if (!next) {
      send(ws, { type: 'error', message: '捨てるカードが不正です' })
      return
    }
    room.gameState = next.state
    pushHandEvents(room, connId, next.handLog)

    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, connId, undefined, sanitizeOptsFor(room, connId)),
    })
    for (const [otherId, pc] of room.players) {
      if (otherId === connId) continue
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, otherId, undefined, sanitizeOptsFor(room, otherId)),
      })
    }
    return
  }

  if (room.pendingActions.has(connId)) {
    send(ws, { type: 'error', message: 'すでにアクションを送信済みです' })
    return
  }

  room.pendingActions.set(connId, action)

  if (room.pendingActions.size >= 2) {
    resolveRound(room)
  }
}

const handleDisconnect = (room: Room, connId: string) => {
  if (!room.playerOrder.includes(connId)) return

  if (room.gameState.phase !== 'waiting' && room.gameState.phase !== 'gameover') {
    const player = room.gameState.players[connId]
    if (player) {
      room.gameState.players[connId] = { ...player, hp: 0 }
      room.gameState = { ...room.gameState, phase: 'gameover' }
      sendStateToAll(room)
    }
  }

  room.players.delete(connId)

  if (room.players.size === 0) {
    if (room.actionTimer) clearTimeout(room.actionTimer)
    room.pendingNewCardEvents.clear()
    room.pendingHandEvents.clear()
    rooms.delete(room.id)
  }
}

// --- HTTP + WebSocket サーバー起動 ---
const PORT = Number(process.env.PORT) || 1999
let connCounter = 0

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('MathBattle WebSocket Server')
})

const wss = new WebSocketServer({ server: httpServer })

const HEARTBEAT_INTERVAL_MS = 30_000
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    const alive = (ws as WebSocket & { isAlive?: boolean }).isAlive
    if (alive === false) {
      ws.terminate()
      continue
    }
    ;(ws as WebSocket & { isAlive?: boolean }).isAlive = false
    ws.ping()
  }
}, HEARTBEAT_INTERVAL_MS)

wss.on('close', () => {
  clearInterval(heartbeat)
})

wss.on('connection', (ws, req) => {
  ;(ws as WebSocket & { isAlive?: boolean }).isAlive = true
  ws.on('pong', () => {
    ;(ws as WebSocket & { isAlive?: boolean }).isAlive = true
  })

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const roomId = pathParts[pathParts.length - 1] ?? 'default'
  const connId = `conn-${Date.now()}-${connCounter++}`

  const room = getOrCreateRoom(roomId)

  console.log(`[${roomId}] Player connected: ${connId}`)

  if (room.playerOrder.length >= 2) {
    send(ws, { type: 'error', message: 'ルームが満員です' })
    ws.close()
    return
  }

  send(ws, { type: 'waiting', roomId })

  ws.on('message', (data) => {
    let parsed: ClientMessage
    try {
      parsed = decodeMessage<ClientMessage>(data.toString())
    } catch {
      send(ws, { type: 'error', message: '無効なメッセージ形式' })
      return
    }

    try {
      switch (parsed.type) {
        case 'join':
          if (typeof parsed.name === 'string') {
            handleJoin(room, ws, connId, parsed.name)
          }
          break
        case 'action':
          if (parsed.action && typeof parsed.action === 'object') {
            handleAction(room, ws, connId, parsed.action)
          }
          break
      }
    } catch (err) {
      console.error(`[${roomId}] handler error for ${connId}:`, err)
      send(ws, { type: 'error', message: 'サーバー内部エラー' })
    }
  })

  ws.on('close', () => {
    console.log(`[${roomId}] Player disconnected: ${connId}`)
    handleDisconnect(room, connId)
  })
})

process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason)
})

httpServer.listen(PORT, () => {
  console.log(`🎮 MathBattle server running on ws://localhost:${PORT}`)
})
