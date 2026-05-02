// 開発用 P2 ボット: 全ターン「移動スキップ → アクションスキップ」で待つだけ。
// preview の単一タブで P1 を操作したいときに、2人目を埋めて対戦を進めるための補助。
// 使い方: node scripts/dev-bot.mjs <roomId> [name]

import { WebSocket } from 'ws'

const roomId = process.argv[2]
const name = process.argv[3] ?? 'BOT'

if (!roomId) {
  console.error('Usage: node scripts/dev-bot.mjs <roomId> [name]')
  process.exit(1)
}

const url = `ws://localhost:1999/room/${roomId}`
const ws = new WebSocket(url)

let phase = ''
let myId = null
let hasMoved = false

ws.on('open', () => {
  console.log('[bot] connected, joining', roomId, 'as', name)
  ws.send(JSON.stringify({ type: 'join', name }))
})

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString())
  if (msg.type === 'gameState' || msg.type === 'gameOver') {
    const s = msg.state
    if (!myId) myId = s.me.id
    phase = s.phase
    hasMoved = !!s.me.hasMovedThisTurn
    console.log('[bot] phase=', phase, 'turn=', s.turn, 'hp=', s.me.hp)

    if (phase === 'action') {
      // 移動 → アクションを順次スキップ。少し遅らせて UI 観察しやすく。
      if (!hasMoved) {
        setTimeout(() => {
          console.log('[bot] -> skip_move')
          ws.send(JSON.stringify({ type: 'action', action: { type: 'skip_move' } }))
        }, 300)
      } else {
        setTimeout(() => {
          console.log('[bot] -> skip')
          ws.send(JSON.stringify({ type: 'action', action: { type: 'skip' } }))
        }, 600)
      }
    }
  } else if (msg.type === 'error') {
    console.error('[bot] server error:', msg.message)
  } else if (msg.type === 'waiting') {
    console.log('[bot] waiting...')
  }
})

ws.on('close', () => {
  console.log('[bot] closed')
  process.exit(0)
})
ws.on('error', (e) => {
  console.error('[bot] ws error:', e.message)
})
