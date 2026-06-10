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
// 両プレイヤーが切断したままのルームを破棄するまでの猶予 (5分)
const ROOM_CLEANUP_DELAY_MS = 5 * 60 * 1000

interface PlayerConnection {
  ws: WebSocket | null   // null = 一時切断中。再接続で復帰する
  token: string          // 永続プレイヤートークン (= PlayerState.id)
  name: string
}

interface Room {
  id: string
  gameState: GameState
  pendingActions: Map<string, Action>
  playerOrder: string[]                       // playerToken[]
  players: Map<string, PlayerConnection>      // playerToken -> connection
  actionTimer: ReturnType<typeof setTimeout> | null
  // 両者が切断したとき、5 分で破棄するためのタイマー
  cleanupTimer: ReturnType<typeof setTimeout> | null
  // ターン開始時の各プレイヤー位置 (action フェーズ中の即時移動を相手に対して秘匿するため)
  turnStartPositions: Map<string, Position>
  // ターン開始時に存在した曲線の ID 集合 (action フェーズ中に相手が新規定義した曲線を秘匿するため)
  turnStartCurveIds: Set<string>
  // 即時アクション (移動・ドロー直後) で発生したアイテム拾得を蓄積し、次の TurnResult で公開する
  pendingItemPickups: ItemPickup[]
  // 直近のドロー/拾得で「新規カードを玉飛行で表示する」イベント。1度送ったらクリア。
  pendingNewCardEvents: Map<string, NewCardEvent[]>
  // 手札変動ログを viewer ごとにバッファ。
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
  cleanupTimer: null,
  turnStartPositions: new Map(),
  turnStartCurveIds: new Set(),
  pendingItemPickups: [],
  pendingNewCardEvents: new Map(),
  pendingHandEvents: new Map(),
})

const captureTurnStartPositions = (room: Room) => {
  room.turnStartPositions.clear()
  for (const [id, p] of Object.entries(room.gameState.players)) {
    room.turnStartPositions.set(id, { ...p.position })
  }
  room.turnStartCurveIds.clear()
  for (const c of room.gameState.curves) {
    room.turnStartCurveIds.add(c.id)
  }
}

const sanitizeOptsFor = (room: Room, viewerId: string) => {
  const opts: {
    opponentVisiblePosition?: Position
    newCardEvents?: NewCardEvent[]
    visibleCurveIds?: Set<string>
  } = {}

  if (room.gameState.phase === 'action') {
    const opponentEntry = Object.entries(room.gameState.players).find(([id]) => id !== viewerId)
    if (opponentEntry) {
      const [oppId] = opponentEntry
      const original = room.turnStartPositions.get(oppId)
      if (original) opts.opponentVisiblePosition = original
    }
    opts.visibleCurveIds = room.turnStartCurveIds
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

const send = (ws: WebSocket | null, msg: ServerMessage) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(encodeMessage(msg))
  }
}

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

const isOnline = (conn: PlayerConnection): boolean =>
  conn.ws !== null && conn.ws.readyState === WebSocket.OPEN

const hasAnyOnline = (room: Room): boolean => {
  for (const conn of room.players.values()) {
    if (isOnline(conn)) return true
  }
  return false
}

const cancelCleanupTimer = (room: Room) => {
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
  }
}

const scheduleRoomCleanup = (room: Room) => {
  cancelCleanupTimer(room)
  room.cleanupTimer = setTimeout(() => {
    console.log(`[${room.id}] room cleanup (all players offline for ${ROOM_CLEANUP_DELAY_MS / 1000}s)`)
    if (room.actionTimer) clearTimeout(room.actionTimer)
    room.pendingNewCardEvents.clear()
    room.pendingHandEvents.clear()
    rooms.delete(room.id)
  }, ROOM_CLEANUP_DELAY_MS)
}

// プレイヤーの disconnected フラグを更新し、必要なら相手に状態を再送する。
const setPlayerDisconnected = (room: Room, token: string, disconnected: boolean) => {
  const ps = room.gameState.players[token]
  if (!ps) return
  if ((ps.disconnected ?? false) === disconnected) return
  room.gameState = {
    ...room.gameState,
    players: {
      ...room.gameState.players,
      [token]: { ...ps, disconnected },
    },
  }
}

const sendStateToAll = (room: Room, turnResult?: TurnResult) => {
  for (const [playerId, pc] of room.players) {
    if (!isOnline(pc)) continue
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

// 切断中のプレイヤーがいる場合、彼らの pendingAction を自動で skip に埋める。
// (オプション A: 試合は止めず、切断者は skip 連打扱いで進行する)
// 両者とも切断中なら何もしない (cleanup タイマーが進行)。
const autoSkipDisconnectedPlayers = (room: Room): boolean => {
  if (room.gameState.phase !== 'action') return false
  if (!hasAnyOnline(room)) return false
  let changed = false
  for (const token of room.playerOrder) {
    const conn = room.players.get(token)
    if (!conn || isOnline(conn)) continue
    if (room.pendingActions.has(token)) continue
    room.pendingActions.set(token, { type: 'skip' })
    changed = true
  }
  return changed
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
  for (const [pid, entries] of Object.entries(result.handLogEvents)) {
    pushHandEvents(room, pid, entries)
  }
  captureTurnStartPositions(room)
  sendStateToAll(room)
  room.pendingNewCardEvents.clear()
  startActionTimer(room)

  // 切断中プレイヤーは自動 skip。相手が動けば即 resolveRound に進む。
  autoSkipDisconnectedPlayers(room)
  if (room.pendingActions.size >= 2 && room.gameState.phase === 'action') {
    resolveRound(room)
  }
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
  room.pendingHandEvents.clear()

  if (room.gameState.phase === 'gameover') return

  setTimeout(() => {
    startNewTurn(room)
  }, TURN_DELAY_MS)
}

// 再接続: 既存の PlayerState に新しい WebSocket を再アタッチして、現在の state を再送する。
const handleReconnect = (room: Room, ws: WebSocket, token: string, name: string) => {
  const conn = room.players.get(token)
  if (!conn) return false

  // 既に別接続が生きている場合は古い方を閉じる (同一ブラウザでタブ複製などの保護)
  if (conn.ws && conn.ws !== ws && conn.ws.readyState === WebSocket.OPEN) {
    try { conn.ws.close() } catch { /* noop */ }
  }
  conn.ws = ws
  if (name && name !== conn.name) conn.name = name

  setPlayerDisconnected(room, token, false)
  cancelCleanupTimer(room)

  console.log(`[${room.id}] player reconnected: ${token}`)

  // 状態を再送 (waiting / 対戦中)
  if (room.gameState.phase === 'waiting' || room.playerOrder.length < 2) {
    send(ws, { type: 'waiting', roomId: room.id })
  } else if (room.gameState.phase === 'gameover') {
    const { winnerId } = checkGameOver(room.gameState.players)
    send(ws, {
      type: 'gameOver',
      winnerId,
      state: sanitizeStateForPlayer(room.gameState, token, undefined, sanitizeOptsFor(room, token)),
    })
  } else {
    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, token, undefined, sanitizeOptsFor(room, token)),
    })
  }

  // 相手側 UI に「切断中バッジ解除」を反映するため再送
  for (const [otherToken, otherConn] of room.players) {
    if (otherToken === token) continue
    if (!isOnline(otherConn)) continue
    send(otherConn.ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, otherToken, undefined, sanitizeOptsFor(room, otherToken)),
    })
  }
  return true
}

const handleJoin = (room: Room, ws: WebSocket, token: string, name: string) => {
  // 既存トークンなら再接続として扱う
  if (room.players.has(token)) {
    handleReconnect(room, ws, token, name)
    return
  }

  if (room.playerOrder.length >= 2) {
    send(ws, { type: 'error', message: 'ルームが満員です' })
    try { ws.close() } catch { /* noop */ }
    return
  }

  const isFirst = room.playerOrder.length === 0
  room.playerOrder.push(token)
  room.players.set(token, { ws, token, name })
  room.gameState = addPlayer(room.gameState, token, name, isFirst)
  cancelCleanupTimer(room)

  if (room.playerOrder.length < 2) {
    send(ws, { type: 'waiting', roomId: room.id })
    return
  }

  // 2人揃った → ゲーム開始
  const started = startGame(room.gameState)
  room.gameState = started.state

  room.pendingNewCardEvents.clear()
  for (const [pid, evts] of Object.entries(started.newCardEvents)) {
    if (evts.length > 0) room.pendingNewCardEvents.set(pid, evts)
  }
  for (const [pid, entries] of Object.entries(started.handLogEvents)) {
    pushHandEvents(room, pid, entries)
  }

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

const handleAction = (room: Room, ws: WebSocket, token: string, action: Action) => {
  if (room.gameState.phase !== 'action') {
    send(ws, { type: 'error', message: 'アクション選択フェーズではありません' })
    return
  }

  if (!room.playerOrder.includes(token)) return

  if (action.type === 'use_move_card') {
    const next = applyImmediateMove(room.gameState, token, action.handIndex)
    if (!next) {
      send(ws, { type: 'error', message: '移動カードが選択されていません' })
      return
    }
    room.gameState = next.state
    if (next.pickups.length > 0) {
      room.pendingItemPickups.push(...next.pickups)
    }
    pushHandEvents(room, token, next.handLog)

    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, token, undefined, sanitizeOptsFor(room, token)),
    })
    return
  }

  if (action.type === 'calculate') {
    const player = room.gameState.players[token]
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
        [token]: { ...player, hand: newHand },
      },
    }

    for (const idx of action.cardIndices) {
      const item = handBefore[idx]
      if (!item) continue
      pushHandEvent(room, token, { kind: 'remove', cardLabel: handItemLabel(item), reason: 'calc' })
    }
    const last = newHand[newHand.length - 1]
    if (last) {
      pushHandEvent(room, token, { kind: 'add', cardLabel: handItemLabel(last), reason: 'calc_result' })
    }

    let primeResult: TurnResult | undefined
    if (last && last.type === 'token' && isPrimeBullet(last.value)) {
      primeResult = {
        actions: {},
        damages: {},
        bulletEvents: [],
        bulletSnapshots: [],
        playerPositions: {},
        curveDamages: {},
        primeSynthesis: { [token]: last.value },
      }
    }

    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, token, primeResult, sanitizeOptsFor(room, token)),
    })

    for (const [otherId, pc] of room.players) {
      if (otherId === token) continue
      if (!isOnline(pc)) continue
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, otherId, undefined, sanitizeOptsFor(room, otherId)),
      })
    }
    return
  }

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
      token,
      action.functionCardIndex,
      action.cardIndices,
      action.xPositions
    )
    if (!next) {
      send(ws, { type: 'error', message: '関数式が不正です (式の長さ・x の有無を確認してください)' })
      return
    }
    room.gameState = next.state
    pushHandEvents(room, token, next.handLog)

    let selfResult: TurnResult | undefined
    if (next.curveEvents.length > 0) {
      selfResult = {
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
      state: sanitizeStateForPlayer(room.gameState, token, selfResult, sanitizeOptsFor(room, token)),
    })
    for (const [otherId, pc] of room.players) {
      if (otherId === token) continue
      if (!isOnline(pc)) continue
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, otherId, undefined, sanitizeOptsFor(room, otherId)),
      })
    }
    return
  }

  if (action.type === 'discard') {
    const next = applyDiscard(room.gameState, token, action.handIndex)
    if (!next) {
      send(ws, { type: 'error', message: '捨てるカードが不正です' })
      return
    }
    room.gameState = next.state
    pushHandEvents(room, token, next.handLog)

    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, token, undefined, sanitizeOptsFor(room, token)),
    })
    for (const [otherId, pc] of room.players) {
      if (otherId === token) continue
      if (!isOnline(pc)) continue
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, otherId, undefined, sanitizeOptsFor(room, otherId)),
      })
    }
    return
  }

  if (room.pendingActions.has(token)) {
    send(ws, { type: 'error', message: 'すでにアクションを送信済みです' })
    return
  }

  room.pendingActions.set(token, action)

  if (room.pendingActions.size >= 2) {
    resolveRound(room)
  }
}

// 切断時の処理 (オプション A):
// - waiting フェーズで対戦相手未到着 → playerOrder から外して即座に空きを戻す
// - 対戦中 → 即 gameover にせず、disconnected=true でマークし、action フェーズ中なら自動 skip
// - 両者切断 → 5 分後にルーム破棄
const handleDisconnect = (room: Room, token: string, ws: WebSocket) => {
  const conn = room.players.get(token)
  if (!conn) return
  // 既に別の ws に張り替え済みなら何もしない (古い ws の close イベントを無視)
  if (conn.ws !== ws) return

  conn.ws = null

  // どのフェーズでもプレイヤー情報は残す (再接続で復帰できるように)。
  // gameover/waiting/対戦中いずれも、ルームは cleanup タイマー (5 分) で破棄される。
  setPlayerDisconnected(room, token, true)
  console.log(`[${room.id}] player disconnected (kept, phase=${room.gameState.phase}): ${token}`)

  // 相手に「切断中バッジ表示」を通知
  for (const [otherToken, otherConn] of room.players) {
    if (otherToken === token) continue
    if (!isOnline(otherConn)) continue
    send(otherConn.ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, otherToken, undefined, sanitizeOptsFor(room, otherToken)),
    })
  }

  // action フェーズ中なら、切断者のメインアクションを skip で代行 → 相手が動けば解決へ
  if (room.gameState.phase === 'action' && hasAnyOnline(room)) {
    autoSkipDisconnectedPlayers(room)
    if (room.pendingActions.size >= 2) {
      resolveRound(room)
    }
  }

  // 両者切断 → 5 分後に破棄
  if (!hasAnyOnline(room)) {
    if (room.actionTimer) clearTimeout(room.actionTimer)
    scheduleRoomCleanup(room)
  }
}

// --- HTTP + WebSocket サーバー起動 ---
const PORT = Number(process.env.PORT) || 1999
let tokenCounter = 0
const generateFallbackToken = (): string => `srv-${Date.now()}-${tokenCounter++}`

const SERVER_START_TIME = Date.now()

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // ヘルスチェックエンドポイント (UptimeRobot / Render用)
  // 監視サービスはここに対してGETを送り、200が返れば「稼働中」と判定する
  if (req.url === '/health') {
    const uptimeSec = Math.floor((Date.now() - SERVER_START_TIME) / 1000)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        uptime: uptimeSec,
        rooms: rooms.size,
        connections: wss?.clients.size ?? 0,
        timestamp: new Date().toISOString(),
      })
    )
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

  const room = getOrCreateRoom(roomId)
  // このソケットに紐づく playerToken (join 後に確定)
  let myToken: string | null = null

  console.log(`[${roomId}] socket connected (awaiting join)`)

  // 受信時に join を待つ。満員判定は join 時に行う (= 切断中プレイヤーの再接続を許可するため)。
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
        case 'join': {
          if (typeof parsed.name !== 'string') return
          const token =
            typeof parsed.playerToken === 'string' && parsed.playerToken.length > 0
              ? parsed.playerToken
              : generateFallbackToken()
          myToken = token
          handleJoin(room, ws, token, parsed.name)
          break
        }
        case 'action':
          if (!myToken) {
            send(ws, { type: 'error', message: 'まだ join していません' })
            return
          }
          if (parsed.action && typeof parsed.action === 'object') {
            handleAction(room, ws, myToken, parsed.action)
          }
          break
      }
    } catch (err) {
      console.error(`[${roomId}] handler error:`, err)
      send(ws, { type: 'error', message: 'サーバー内部エラー' })
    }
  })

  ws.on('close', () => {
    if (myToken) {
      console.log(`[${roomId}] socket closed (token=${myToken})`)
      handleDisconnect(room, myToken, ws)
    } else {
      console.log(`[${roomId}] socket closed (pre-join)`)
    }
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
