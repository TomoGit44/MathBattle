import type { Bullet } from '@/lib/types'

interface BulletDisplayProps {
  bullet: Bullet
  isOwn: boolean
  bulletRadius: number
  fieldSize: { width: number; height: number }
}

export const BulletDisplay = ({ bullet, isOwn, bulletRadius, fieldSize }: BulletDisplayProps) => {
  const left = (bullet.position.x / fieldSize.width) * 100
  const top = (bullet.position.y / fieldSize.height) * 100
  // 当たり判定 (円・半径 bulletRadius) と一致させる
  const widthPct = ((bulletRadius * 2) / fieldSize.width) * 100
  const heightPct = ((bulletRadius * 2) / fieldSize.height) * 100

  const color = isOwn
    ? 'bg-blue-900 border-blue-400 text-blue-300'
    : 'bg-red-900 border-red-400 text-red-300'

  return (
    <div
      className={`absolute ${color} border rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
      }}
    >
      {bullet.value}
    </div>
  )
}
