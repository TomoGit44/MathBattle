import type { Position } from '@/lib/types'

interface PlayerProps {
  position: Position
  facing: 'left' | 'right'
  isMe: boolean
  animating?: boolean
  playerRadius: number
  fieldSize: { width: number; height: number }
}

export const Player = ({
  position,
  facing,
  isMe,
  animating = false,
  playerRadius,
  fieldSize,
}: PlayerProps) => {
  const left = (position.x / fieldSize.width) * 100
  const top = (position.y / fieldSize.height) * 100
  // 当たり判定 (円・半径 playerRadius) と一致させる
  const widthPct = ((playerRadius * 2) / fieldSize.width) * 100
  const heightPct = ((playerRadius * 2) / fieldSize.height) * 100
  const color = isMe
    ? 'bg-p1-deep border-p1-border text-text'
    : 'bg-p2-deep border-p2-border text-text'

  // animating 中は3秒かけてスムーズ移動、通常は即座に移動
  // transition-all を避け、left/top のみ animate (GPU レイヤ離脱を抑制)
  const transitionStyle = animating
    ? {
        transitionProperty: 'left, top',
        transitionDuration: 'var(--dur-replay)',
        transitionTimingFunction: 'var(--ease-glide)',
      }
    : { transitionDuration: '0ms' }

  return (
    <div
      className={`absolute ${color} border-2 rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-1/2`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        boxShadow: isMe ? 'var(--shadow-p1)' : 'var(--shadow-p2)',
        ...transitionStyle,
      }}
    >
      <span className="text-xs font-bold">
        {facing === 'right' ? '>' : '<'}
      </span>
    </div>
  )
}
