'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BackgroundGrid } from '@/components/game/BackgroundGrid'

const Home = () => {
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const router = useRouter()

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreate = () => {
    if (!name.trim()) return
    const id = generateRoomId()
    router.push(`/game/${id}?name=${encodeURIComponent(name.trim())}`)
  }

  const handleJoin = () => {
    if (!name.trim() || !roomId.trim()) return
    router.push(`/game/${roomId.trim().toUpperCase()}?name=${encodeURIComponent(name.trim())}`)
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <BackgroundGrid />

      <div className="relative text-center">
        <h1
          className="text-5xl font-bold mb-2 mb-tabular"
          style={{
            color: 'var(--color-text)',
            // クロマティックアバレーション: cyan と rose を 1〜2px ずらして重ねる
            textShadow: [
              '-1.5px 0 0 rgba(56, 189, 248, 0.55)',     // P1 (sky) を左へ
              '1.5px 0 0 rgba(251, 113, 133, 0.45)',      // P2 (rose) を右へ
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
        className="relative w-full max-w-sm space-y-6"
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

        <button
          onClick={handleCreate}
          disabled={!name.trim()}
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
            disabled={!name.trim() || !roomId.trim()}
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
