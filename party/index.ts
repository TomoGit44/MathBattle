import type { Party, Connection, ConnectionContext } from 'partykit/server'
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
import { ACTION_TIMEOUT_MS } from '../lib/constants'

export default class MathBattleServer {
  gameState: GameState
  decks: Map<string, Card[]> = new Map()
  pendingActions: Map<string, Action> = new Map()
  playerNames: Map<string, string> = new Map()
  playerOrder: string[] = []
  actionTimer: ReturnType<typeof setTimeout> | null = null

  constructor(readonly room: Party) {
    this.gameState = initializeGameState()
  }

  private send(conn: Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg))
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg))
  }

  private sendStateToAll(turnResult?: ReturnType<typeof resolveActions>['turnResult']) {
    for (const conn of this.room.getConnections()) {
      const playerId = conn.id
      if (!this.gameState.players[playerId]) continue

      if (this.gameState.phase === 'gameover') {
        const { winnerId } = checkGameOver(this.gameState.players)
        this.send(conn, {
          type: 'gameOver',
          winnerId,
          state: sanitizeStateForPlayer(this.gameState, playerId, turnResult),
        })
      } else {
        this.send(conn, {
          type: 'gameState',
          state: sanitizeStateForPlayer(this.gameState, playerId, turnResult),
        })
      }
    }
  }

  private startNewTurn() {
    this.gameState = { ...this.gameState, turn: this.gameState.turn + 1 }
    const result = executeDraw(this.gameState, this.decks)
    this.gameState = result.state
    this.decks = result.decks
    this.pendingActions.clear()
    this.sendStateToAll()
    this.startActionTimer()
  }

  private startActionTimer() {
    if (this.actionTimer) clearTimeout(this.actionTimer)
    this.actionTimer = setTimeout(() => {
      this.resolveWithDefaults()
    }, ACTION_TIMEOUT_MS)
  }

  private resolveWithDefaults() {
    // タイムアウト: アクション未提出のプレイヤーはスキップ扱い
    for (const id of this.playerOrder) {
      if (!this.pendingActions.has(id)) {
        this.pendingActions.set(id, { type: 'skip' })
      }
    }
    this.resolveRound()
  }

  private resolveRound() {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer)
      this.actionTimer = null
    }

    this.gameState = { ...this.gameState, phase: 'resolving' }

    const actions = Object.fromEntries(this.pendingActions)
    const { state, turnResult } = resolveActions(this.gameState, actions)
    this.gameState = state

    this.sendStateToAll(turnResult)

    if (this.gameState.phase === 'gameover') return

    // 結果表示後に次ターンへ
    setTimeout(() => {
      this.startNewTurn()
    }, 2000)
  }

  async onConnect(conn: Connection, ctx: ConnectionContext) {
    if (this.playerOrder.length >= 2) {
      this.send(conn, { type: 'error', message: 'ルームが満員です' })
      conn.close()
      return
    }

    this.send(conn, { type: 'waiting', roomId: this.room.id })
  }

  async onMessage(message: string, sender: Connection) {
    let parsed: ClientMessage
    try {
      parsed = JSON.parse(message as string)
    } catch {
      this.send(sender, { type: 'error', message: '無効なメッセージ形式' })
      return
    }

    switch (parsed.type) {
      case 'join':
        this.handleJoin(sender, parsed.name)
        break
      case 'action':
        this.handleAction(sender, parsed.action)
        break
    }
  }

  private handleJoin(conn: Connection, name: string) {
    if (this.playerOrder.includes(conn.id)) return
    if (this.playerOrder.length >= 2) {
      this.send(conn, { type: 'error', message: 'ルームが満員です' })
      return
    }

    const isFirst = this.playerOrder.length === 0
    this.playerOrder.push(conn.id)
    this.playerNames.set(conn.id, name)
    this.decks.set(conn.id, createDefaultDeck())
    this.gameState = addPlayer(this.gameState, conn.id, name, isFirst)

    if (this.playerOrder.length < 2) {
      this.send(conn, { type: 'waiting', roomId: this.room.id })
      return
    }

    // 2人揃った → ゲーム開始
    const started = startGame(this.gameState, this.decks)
    this.gameState = started.state
    this.decks = started.decks

    const drawn = executeDraw(this.gameState, this.decks)
    this.gameState = drawn.state
    this.decks = drawn.decks

    this.sendStateToAll()
    this.startActionTimer()
  }

  private handleAction(conn: Connection, action: Action) {
    if (this.gameState.phase !== 'action') {
      this.send(conn, { type: 'error', message: 'アクション選択フェーズではありません' })
      return
    }

    if (!this.playerOrder.includes(conn.id)) return
    if (this.pendingActions.has(conn.id)) {
      this.send(conn, { type: 'error', message: 'すでにアクションを送信済みです' })
      return
    }

    this.pendingActions.set(conn.id, action)

    // 両者揃ったら解決
    if (this.pendingActions.size >= 2) {
      this.resolveRound()
    }
  }

  async onClose(conn: Connection) {
    if (!this.playerOrder.includes(conn.id)) return

    // 対戦中に切断 → 相手の勝利
    if (this.gameState.phase !== 'waiting' && this.gameState.phase !== 'gameover') {
      const player = this.gameState.players[conn.id]
      if (player) {
        this.gameState.players[conn.id] = { ...player, hp: 0 }
        this.gameState = { ...this.gameState, phase: 'gameover' }
        this.sendStateToAll()
      }
    }
  }
}
