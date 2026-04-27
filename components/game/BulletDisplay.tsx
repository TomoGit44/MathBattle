import type { MouseEvent } from 'react'
import type { Bullet } from '@/lib/types'
import { isPrimeBullet } from '@/lib/prime'

interface BulletDisplayProps {
  bullet: Bullet
  isOwn: boolean
  bulletRadius: number
  fieldSize: { width: number; height: number }
  onClick?: (bullet: Bullet, e: MouseEvent) => void
}

export const BulletDisplay = ({ bullet, isOwn, bulletRadius, fieldSize, onClick }: BulletDisplayProps) => {
  const left = (bullet.position.x / fieldSize.width) * 100
  const top = (bullet.position.y / fieldSize.height) * 100
  // 当たり判定 (円・半径 bulletRadius) と一致させる
  const widthPct = ((bulletRadius * 2) / fieldSize.width) * 100
  const heightPct = ((bulletRadius * 2) / fieldSize.height) * 100

  const isPrime = isPrimeBullet(bullet.value)

  // 素数弾は紫〜青の素数カラーで上書き、通常弾は所有者カラー
  const color = isPrime
    ? 'bg-fuchsia-900 border-fuchsia-300 text-fuchsia-100'
    : isOwn
    ? 'bg-blue-900 border-blue-400 text-blue-300'
    : 'bg-red-900 border-red-400 text-red-300'

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
      }}
      onClick={onClick ? (e) => onClick(bullet, e) : undefined}
    >
      {isPrime && (
        <>
          {/* 素数オーラ: 持続的なグロー (HandDisplay と同テイスト) */}
          <span className="pointer-events-none absolute -inset-[60%] rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-400 to-blue-500 opacity-60 blur-md animate-pulse" />
          {/* 回転する外輪 */}
          <span className="pointer-events-none absolute -inset-[20%] rounded-full ring-2 ring-fuchsia-300/70 animate-[spin_4s_linear_infinite]" />
        </>
      )}
      <div
        className={`relative w-full h-full ${color} border rounded-full flex items-center justify-center text-[10px] font-bold ${
          isPrime ? 'shadow-[0_0_12px_rgba(217,70,239,0.9)]' : ''
        }`}
      >
        {bullet.value}
      </div>
    </div>
  )
}
