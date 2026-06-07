'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Action, ClientGameState, ServerMessage } from '@/lib/types'
import { encodeMessage, decodeMessage } from '@/lib/json-codec'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

// localStorage に保存する永続プレイヤートークン (ブラウザ単位)。
// サーバーは同じトークンでの再接続を「同じプレイヤー」として扱い、ゲーム状態を復帰させる。
const TOKEN_STORAGE_KEY = 'mathbattle:playerToken'

const getOrCreatePlayerToken = (): string => {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    if (existing && existing.length > 0) return existing
  } catch {
    // localStorage 利用不可 (プライベートモード等) → 都度生成
  }
  const fresh =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tok-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, fresh)
  } catch { /* noop */ }
  return fresh
}

const resolveWsUrl = (roomId: string): string => {
  const wsUrlBase = process.env.NEXT_PUBLIC_WS_URL
  if (wsUrlBase) {
    const trimmed = wsUrlBase.replace(/\/+$/, '')
    return `${trimmed}/room/${roomId}`
  }
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? 'localhost:1999'
  const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'ws' : 'wss'
  return `${protocol}://${host}/room/${roomId}`
}

export const useGameSocket = (roomId: string, playerName: string) => {
  const [gameState, setGameState] = useState<ClientGameState | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [isWaiting, setIsWaiting] = useState(false)
  const [gameOverWinnerId, setGameOverWinnerId] = useState<string | null | undefined>(undefined)

  const socketRef = useRef<WebSocket | null>(null)
  // 再接続ループを抜けるため (StrictMode のクリーンアップ・unmount 検知)
  const disposedRef = useRef(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  // playerToken は初回マウントで決定 (以降ブラウザ単位で永続)
  const playerTokenRef = useRef<string>('')
  if (playerTokenRef.current === '') {
    playerTokenRef.current = getOrCreatePlayerToken()
  }

  useEffect(() => {
    disposedRef.current = false
    const url = resolveWsUrl(roomId)

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (disposedRef.current) return
      clearReconnect()
      const attempt = reconnectAttemptsRef.current
      // 指数バックオフ: 0.5s, 1s, 2s, 4s, ... 上限 10s
      const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt, 5))
      reconnectAttemptsRef.current = attempt + 1
      reconnectTimerRef.current = setTimeout(() => {
        if (disposedRef.current) return
        connect()
      }, delay)
    }

    const connect = () => {
      if (disposedRef.current) return
      // 既に open / connecting なら何もしない
      const existing = socketRef.current
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return
      }

      setStatus('connecting')
      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.addEventListener('open', () => {
        if (disposedRef.current) {
          try { socket.close() } catch { /* noop */ }
          return
        }
        reconnectAttemptsRef.current = 0
        setStatus('connected')
        socket.send(
          encodeMessage({
            type: 'join',
            name: playerName,
            playerToken: playerTokenRef.current,
          })
        )
      })

      socket.addEventListener('message', (event) => {
        const msg = decodeMessage<ServerMessage>(event.data)
        switch (msg.type) {
          case 'waiting':
            setIsWaiting(true)
            break
          case 'gameState':
            setIsWaiting(false)
            setGameState(msg.state)
            break
          case 'gameOver':
            setIsWaiting(false)
            setGameState(msg.state)
            setGameOverWinnerId(msg.winnerId)
            break
          case 'error':
            setError(msg.message)
            break
        }
      })

      socket.addEventListener('close', () => {
        if (disposedRef.current) return
        setStatus('disconnected')
        scheduleReconnect()
      })

      socket.addEventListener('error', () => {
        // close が続けて呼ばれるので reconnect は close ハンドラで行う
        if (disposedRef.current) return
        setStatus('disconnected')
      })
    }

    // フォアグラウンド復帰時に切断していたら即座に再接続を試みる
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const s = socketRef.current
      if (!s || s.readyState === WebSocket.CLOSED || s.readyState === WebSocket.CLOSING) {
        reconnectAttemptsRef.current = 0
        clearReconnect()
        connect()
      }
    }

    // online イベントも同様 (ネットワーク復帰時)
    const onOnline = () => {
      reconnectAttemptsRef.current = 0
      clearReconnect()
      connect()
    }

    connect()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)

    return () => {
      disposedRef.current = true
      clearReconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      const s = socketRef.current
      if (s) {
        try { s.close() } catch { /* noop */ }
      }
      socketRef.current = null
    }
  }, [roomId, playerName])

  const sendAction = useCallback((action: Action) => {
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(encodeMessage({ type: 'action', action }))
    }
  }, [])

  return { gameState, status, error, isWaiting, gameOverWinnerId, sendAction }
}
