'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BackgroundGrid } from '@/components/game/BackgroundGrid'
import { DeckBuilder } from '@/components/lobby/DeckBuilder'
import { createDefaultDeck, validateDeck } from '@/lib/deck'
import type { Card } from '@/lib/types'

const DECK_STORAGE_KEY = 'mathbattle:deck'
const PENDING_DECK_KEY = 'mathbattle:pendingDeck'

const Home = () => {
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [deck, setDeck] = useState<Card[]>(() => createDefaultDeck())
  const router = useRouter()

  // 保存済みデッキを復元 (初回マウント時のみ)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DECK_STORAGE_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (validateDeck(parsed) === null) {
        setDeck(parsed as Card[])
      }
    } catch {
      // 破損時は無視 (デフォルトのまま)
    }
  }, [])

  // 変更のたびに保存 (検証通過時のみ)
  useEffect(() => {
    if (validateDeck(deck) !== null) return
    try {
      localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deck))
    } catch {
      // 容量超過などは無視
    }
  }, [deck])

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  // 検証通過時のみ送る (失敗時はサーバーがデフォルトに差し替える)
  const stashDeckForGame = () => {
    if (validateDeck(deck) !== null) {
      sessionStorage.removeItem(PENDING_DECK_KEY)
      return
    }
    try {
      sessionStorage.setItem(PENDING_DECK_KEY, JSON.stringify(deck))
    } catch {
      // ignore
    }
  }

  const handleCreate = () => {
    if (!name.trim()) return
    const id = generateRoomId()
    stashDeckForGame()
    router.push(`/game/${id}?name=${encodeURIComponent(name.trim())}`)
  }

  const handleJoin = () => {
    if (!name.trim() || !roomId.trim()) return
    stashDeckForGame()
    router.push(`/game/${roomId.trim().toUpperCase()}?name=${encodeURIComponent(name.trim())}`)
  }

  const deckValid = validateDeck(deck) === null
  const canStart = name.trim().length > 0 && deckValid

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <BackgroundGrid />

      <div className="relative text-center">
        <h1
          className="text-5xl font-bold mb-2 mb-tabular"
          style={{
            color: 'var(--color-text)',
            textShadow: [
              '-1.5px 0 0 rgba(56, 189, 248, 0.55)',
              '1.5px 0 0 rgba(251, 113, 133, 0.45)',
              '0 0 12px rgba(56, 189, 248, 0.55)',
              '0 0 28px rgba(56, 189, 248, 0.30)',
            ].join(', '),
            animation: 'mb-title-in 700ms var(--ease-out-quart) both',
          }}
        >
          Math Battle
        </h1>
        <p
          className="text-text-dim text-lg"
          style={{ animation: 'mb-title-in 700ms var(--ease-out-quart) 120ms both' }}
        >
          数字を弾として撃ち合え!
        </p>
      </div>

      <div
        className="relative w-full max-w-md space-y-5"
        style={{ animation: 'mb-title-in 700ms var(--ease-out-quart) 240ms both' }}
      >
        <div>
          <label className="block text-sm text-text-dim mb-1">プレイヤー名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名前を入力..."
            maxLength={12}
            className="w-full px-4 py-3 bg-bg-mid border border-line rounded-lg text-text focus:outline-none focus:border-p1 transition-colors duration-[var(--dur-fast)]"
          />
        </div>

        <DeckBuilder deck={deck} onChange={setDeck} />

        <button
          onClick={handleCreate}
          disabled={!canStart}
          className="w-full py-3 bg-p1-bg hover:bg-p1-deep disabled:bg-bg-elev disabled:text-text-mute border border-p1-border/50 disabled:border-line text-text rounded-lg font-bold text-lg transition-colors duration-[var(--dur-fast)]"
        >
          ルームを作成
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-line" />
          <span className="text-text-faint text-sm">または</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="ルームID"
            maxLength={6}
            className="flex-1 px-4 py-3 bg-bg-mid border border-line rounded-lg text-text focus:outline-none focus:border-success uppercase font-mono mb-tabular transition-colors duration-[var(--dur-fast)]"
          />
          <button
            onClick={handleJoin}
            disabled={!canStart || !roomId.trim()}
            className="px-6 py-3 bg-op-add-bg hover:bg-op-add-bg/70 disabled:bg-bg-elev disabled:text-text-mute border border-op-add-border/50 disabled:border-line text-op-add rounded-lg font-bold transition-colors duration-[var(--dur-fast)]"
          >
            参加
          </button>
        </div>
      </div>
    </div>
  )
}

export default Home
