import type { Bullet } from '@/lib/types'
import { FIELD_WIDTH, FIELD_HEIGHT } from '@/lib/constants'

interface BulletDisplayProps {
  bullet: Bullet
  isOwn: boolean
}

export const BulletDisplay = ({ bullet, isOwn }: BulletDisplayProps) => {
  const left = (bullet.position.x / FIELD_WIDTH) * 100
  const top = (bullet.position.y / FIELD_HEIGHT) * 100

  const color = isOwn
    ? 'bg-blue-900 border-blue-400 text-blue-300'
    : 'bg-red-900 border-red-400 text-red-300'

  return (
    <div
      className={`absolute w-6 h-6 ${color} border rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold`}
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      {bullet.value}
    </div>
  )
}
