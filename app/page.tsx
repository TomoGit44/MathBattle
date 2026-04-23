'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-2">Math Battle</h1>
        <p className="text-gray-400 text-lg">数字を弾として撃ち合え!</p>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">プレイヤー名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名前を入力..."
            maxLength={12}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-bold text-lg transition-colors"
        >
          ルームを作成
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-gray-500 text-sm">または</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="ルームID"
            maxLength={6}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500 uppercase"
          />
          <button
            onClick={handleJoin}
            disabled={!name.trim() || !roomId.trim()}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-bold transition-colors"
          >
            参加
          </button>
        </div>
      </div>
    </div>
  )
}

export default Home
