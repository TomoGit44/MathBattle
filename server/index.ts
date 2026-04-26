import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import type { GameState, Card, Action, ClientMessage, ServerMessage, Position } from '../lib/types'
import {
  initializeGameState,
  addPlayer,
  startGame,
  executeDraw,
  resolveActions,
  sanitizeStateForPlayer,
  applyImmediateMove,
  markMoveSkipped,
} from '../lib/game-logic'
import { createDefaultDeck } from '../lib/deck'
import { checkGameOver } from '../lib/damage'
import { tryApplyCalculation, calcErrorMessage } from '../lib/calc-engine'
import { isPrimeBullet } from '../lib/prime'
import { TURN_DELAY_MS } from '../lib/constants'
import { loadConfig, isUnlimited, toGameSettings } from '../lib/config'
import type { TurnResult } from '../lib/types'

const CONFIG = loadConfig()
const GAME_SETTINGS = toGameSettings(CONFIG)

interface PlayerConnection {
  ws: WebSocket
  id: string
  name: string
}

interface Room {
  id: string
  gameState: GameState
  decks: Map<string, Card[]>
  pendingActions: Map<string, Action>
  playerOrder: string[]
  players: Map<string, PlayerConnection>
  actionTimer: ReturnType<typeof setTimeout> | null
  // ターン開始時の各プレイヤー位置 (action フェーズ中の即時移動を相手に対して秘匿するため)
  turnStartPositions: Map<string, Position>
}

const rooms = new Map<string, Room>()

const createRoom = (roomId: string): Room => ({
  id: roomId,
  gameState: initializeGameState(GAME_SETTINGS),
  decks: new Map(),
  pendingActions: new Map(),
  playerOrder: [],
  players: new Map(),
  actionTimer: null,
  turnStartPositions: new Map(),
})

// ターン開始時の位置スナップショットを記録 (action フェーズ中の相手秘匿表示用)
const captureTurnStartPositions = (room: Room) => {
  room.turnStartPositions.clear()
  for (const [id, p] of Object.entries(room.gameState.players)) {
    room.turnStartPositions.set(id, { ...p.position })
  }
}

// 指定 viewerId 視点でサニタイズする際のオプションを構築する。
// action フェーズ中で、相手が今ターン移動済みなら、相手の位置をターン開始時のものに差し替える。
const sanitizeOptsFor = (room: Room, viewerId: string) => {
  if (room.gameState.phase !== 'action') return undefined
  const opponentEntry = Object.entries(room.gameState.players).find(([id]) => id !== viewerId)
  if (!opponentEntry) return undefined
  const [oppId, oppState] = opponentEntry
  if (!oppState.hasMovedThisTurn) return undefined
  const original = room.turnStartPositions.get(oppId)
  if (!original) return undefined
  return { opponentVisiblePosition: original, hideOpponentHasMoved: true }
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
    ws.send(JSON.stringify(msg))
  }
}

const sendStateToAll = (room: Room, turnResult?: ReturnType<typeof resolveActions>['turnResult']) => {
  for (const [playerId, pc] of room.players) {
    if (!room.gameState.players[playerId]) continue

    if (room.gameState.phase === 'gameover') {
      const { winnerId } = checkGameOver(room.gameState.players)
      send(pc.ws, {
        type: 'gameOver',
        winnerId,
        state: sanitizeStateForPlayer(room.gameState, playerId, turnResult, sanitizeOptsFor(room, playerId)),
      })
    } else {
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, playerId, turnResult, sanitizeOptsFor(room, playerId)),
      })
    }
  }
}

const startActionTimer = (room: Room) => {
  if (room.actionTimer) clearTimeout(room.actionTimer)
  // 設定で 0 以下なら時間制限なし → タイマーを起動しない
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
  const result = executeDraw(room.gameState, room.decks)
  room.gameState = result.state
  room.decks = result.decks
  room.pendingActions.clear()
  // ターン開始位置をスナップショット (相手側の移動秘匿表示用)
  captureTurnStartPositions(room)
  sendStateToAll(room)
  startActionTimer(room)
}

const resolveRound = (room: Room) => {
  if (room.actionTimer) {
    clearTimeout(room.actionTimer)
    room.actionTimer = null
  }

  room.gameState = { ...room.gameState, phase: 'resolving' }

  const actions = Object.fromEntries(room.pendingActions)
  const { state, turnResult } = resolveActions(room.gameState, actions)
  room.gameState = state

  sendStateToAll(room, turnResult)

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
  room.decks.set(connId, createDefaultDeck())
  room.gameState = addPlayer(room.gameState, connId, name, isFirst)

  if (room.playerOrder.length < 2) {
    send(ws, { type: 'waiting', roomId: room.id })
    return
  }

  // 2人揃った → ゲーム開始
  const started = startGame(room.gameState, room.decks)
  room.gameState = started.state
  room.decks = started.decks

  const drawn = executeDraw(room.gameState, room.decks)
  room.gameState = drawn.state
  room.decks = drawn.decks

  // ゲーム開始時のターン開始位置を記録
  captureTurnStartPositions(room)
  sendStateToAll(room)
  startActionTimer(room)
}

const handleAction = (room: Room, ws: WebSocket, connId: string, action: Action) => {
  if (room.gameState.phase !== 'action') {
    send(ws, { type: 'error', message: 'アクション選択フェーズではありません' })
    return
  }

  if (!room.playerOrder.includes(connId)) return

  // 移動アクションは即時処理 (1ターン1回)
  if (action.type === 'move') {
    const player = room.gameState.players[connId]
    if (!player) return
    if (player.hasMovedThisTurn) {
      send(ws, { type: 'error', message: '今ターンはすでに移動済みです' })
      return
    }
    const next = applyImmediateMove(room.gameState, connId, action.direction)
    if (!next) {
      send(ws, { type: 'error', message: '移動できません' })
      return
    }
    room.gameState = next

    // 移動した本人にだけ通知。相手には何も送らない (移動の有無自体を秘匿するため)。
    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, connId, undefined, sanitizeOptsFor(room, connId)),
    })
    return
  }

  // 移動フェーズでの「移動しない」: hasMovedThisTurn だけ立てる即時処理
  if (action.type === 'skip_move') {
    const player = room.gameState.players[connId]
    if (!player) return
    if (player.hasMovedThisTurn) {
      send(ws, { type: 'error', message: '今ターンはすでに移動処理済みです' })
      return
    }
    const next = markMoveSkipped(room.gameState, connId)
    if (!next) return
    room.gameState = next
    // 自分のクライアントには通知 (UI が phase 2 に進む)
    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, connId, undefined, sanitizeOptsFor(room, connId)),
    })
    // 相手には通知しない (移動フェーズの選択を秘匿)
    return
  }

  // メインアクションの前段として、必ず移動フェーズが完了している必要がある
  {
    const player = room.gameState.players[connId]
    if (player && !player.hasMovedThisTurn) {
      send(ws, { type: 'error', message: '先に移動フェーズを完了してください (移動 or 移動しない)' })
      return
    }
  }

  // 計算アクションは即時処理 (1ターンに何度でも可能)
  if (action.type === 'calculate') {
    const player = room.gameState.players[connId]
    if (!player) return

    // cardIndices の形を防御的に検証
    if (!Array.isArray(action.cardIndices)) {
      send(ws, { type: 'error', message: '計算リクエストが不正です' })
      return
    }

    const result = tryApplyCalculation(player.hand, action.cardIndices)
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

    // 素数合成検出 → PRIME演出用の TurnResult を即時送信
    const last = newHand[newHand.length - 1]
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

    // 当該プレイヤーにのみ更新後のstateを送信 (相手の手札増減は handCount で見える)
    send(ws, {
      type: 'gameState',
      state: sanitizeStateForPlayer(room.gameState, connId, primeResult, sanitizeOptsFor(room, connId)),
    })

    // 相手にも opponent.handCount の更新を反映 (相手の移動有無・新位置は秘匿)
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

  // ルームが空になったら削除
  if (room.players.size === 0) {
    if (room.actionTimer) clearTimeout(room.actionTimer)
    rooms.delete(room.id)
  }
}

// --- HTTP + WebSocket サーバー起動 ---
// Render等のホスティングは PORT 環境変数を渡してくる
const PORT = Number(process.env.PORT) || 1999
let connCounter = 0

const httpServer = createServer((req, res) => {
  // CORSヘッダー
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

// アイドル切断対策: 30秒ごとに ping を送り、pong が返らない接続は terminate する
// Render 等のホスティング側 LB が無通信の WebSocket を ~10分で切るのを回避する
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

  // URLからルームIDを取得: /room/ROOM_ID
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
      parsed = JSON.parse(data.toString())
    } catch {
      send(ws, { type: 'error', message: '無効なメッセージ形式' })
      return
    }

    // ハンドラ内で例外が出てもサーバーがクラッシュしないように包む
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

// 最終防衛線: 想定外の例外でもプロセスを落とさない
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason)
})

httpServer.listen(PORT, () => {
  console.log(`🎮 MathBattle server running on ws://localhost:${PORT}`)
})
