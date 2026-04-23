'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Action, ClientGameState, ServerMessage } from '@/lib/types'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export const useGameSocket = (roomId: string, playerName: string) => {
  const [gameState, setGameState] = useState<ClientGameState | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [isWaiting, setIsWaiting] = useState(false)
  const [gameOverWinnerId, setGameOverWinnerId] = useState<string | null | undefined>(undefined)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? 'localhost:1999'
    const protocol = host.startsWith('localhost') ? 'ws' : 'wss'
    const url = `${protocol}://${host}/room/${roomId}`

    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.addEventListener('open', () => {
      setStatus('connected')
      socket.send(JSON.stringify({ type: 'join', name: playerName }))
    })

    socket.addEventListener('message', (event) => {
      const msg: ServerMessage = JSON.parse(event.data)

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
      socket.send(JSON.stringify({ type: 'action', action }))
    }
  }, [])

  return { gameState, status, error, isWaiting, gameOverWinnerId, sendAction }
}
