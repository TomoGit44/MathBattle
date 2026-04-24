import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import type { GameState, Card, Action, ClientMessage, ServerMessage } from '../lib/types'
import {
  initializeGameState,
  addPlayer,
  startGame,
  executeDraw,
  resolveActions,
  sanitizeStateForPlayer,
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
})

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
        state: sanitizeStateForPlayer(room.gameState, playerId, turnResult),
      })
    } else {
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, playerId, turnResult),
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
        room.pendingActions.set(id, { type: 'move', direction: 'up' })
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

  sendStateToAll(room)
  startActionTimer(room)
}

const handleAction = (room: Room, ws: WebSocket, connId: string, action: Action) => {
  if (room.gameState.phase !== 'action') {
    send(ws, { type: 'error', message: 'アクション選択フェーズではありません' })
    return
  }

  if (!room.playerOrder.includes(connId)) return

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
      state: sanitizeStateForPlayer(room.gameState, connId, primeResult),
    })

    // 相手にも opponent.handCount の更新を反映
    for (const [otherId, pc] of room.players) {
      if (otherId === connId) continue
      send(pc.ws, {
        type: 'gameState',
        state: sanitizeStateForPlayer(room.gameState, otherId),
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

wss.on('connection', (ws, req) => {
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
