'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Action, Card, ClientGameState, ServerMessage } from '@/lib/types'
import { encodeMessage, decodeMessage } from '@/lib/json-codec'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export const useGameSocket = (roomId: string, playerName: string, deck?: Card[]) => {
  const [gameState, setGameState] = useState<ClientGameState | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [isWaiting, setIsWaiting] = useState(false)
  const [gameOverWinnerId, setGameOverWinnerId] = useState<string | null | undefined>(undefined)
  const socketRef = useRef<WebSocket | null>(null)
  // open ハンドラ内で参照する用。再接続を防ぐため deps には入れない。
  const deckRef = useRef<Card[] | undefined>(deck)
  deckRef.current = deck

  useEffect(() => {
    // 接続URL解決の優先順位:
    //   1. NEXT_PUBLIC_WS_URL (例: "wss://mathbattle-ws.onrender.com")
    //   2. NEXT_PUBLIC_PARTYKIT_HOST (例: "mathbattle.example.com")
    //   3. localhost:1999 (ローカル開発時)
    const wsUrlBase = process.env.NEXT_PUBLIC_WS_URL
    let url: string
    if (wsUrlBase) {
      // 末尾スラッシュを除去
      const trimmed = wsUrlBase.replace(/\/+$/, '')
      url = `${trimmed}/room/${roomId}`
    } else {
      const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? 'localhost:1999'
      const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'ws' : 'wss'
      url = `${protocol}://${host}/room/${roomId}`
    }

    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.addEventListener('open', () => {
      setStatus('connected')
      socket.send(encodeMessage({ type: 'join', name: playerName, deck: deckRef.current }))
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
      setStatus('disconnected')
    })

    socket.addEventListener('error', () => {
      setStatus('disconnected')
    })

    return () => {
      socket.close()
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
