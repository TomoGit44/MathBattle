import type { Position } from '@/lib/types'
import { FIELD_WIDTH, FIELD_HEIGHT, PLAYER_SIZE } from '@/lib/constants'

interface PlayerProps {
  position: Position
  facing: 'left' | 'right'
  isMe: boolean
  animating?: boolean
}

export const Player = ({ position, facing, isMe, animating = false }: PlayerProps) => {
  const left = (position.x / FIELD_WIDTH) * 100
  const top = (position.y / FIELD_HEIGHT) * 100
  // 当たり判定 (円・半径 PLAYER_SIZE) と一致させる
  const widthPct = ((PLAYER_SIZE * 2) / FIELD_WIDTH) * 100
  const heightPct = ((PLAYER_SIZE * 2) / FIELD_HEIGHT) * 100
  const color = isMe ? 'bg-blue-500 border-blue-300' : 'bg-red-500 border-red-300'

  // animating 中は3秒かけてスムーズ移動、通常は即座に移動
  const duration = animating ? 'duration-[3000ms]' : 'duration-0'

  return (
    <div
      className={`absolute ${color} border-2 rounded-full transition-all ${duration} ease-in-out flex items-center justify-center -translate-x-1/2 -translate-y-1/2`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
      }}
    >
      <span className="text-xs font-bold">
        {facing === 'right' ? '>' : '<'}
      </span>
    </div>
  )
}
