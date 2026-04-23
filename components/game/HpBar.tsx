import { INITIAL_HP } from '@/lib/constants'

interface HpBarProps {
  name: string
  hp: number
  isMe: boolean
}

export const HpBar = ({ name, hp, isMe }: HpBarProps) => {
  const percent = Math.max(0, (hp / INITIAL_HP) * 100)
  const color =
    percent > 50 ? 'bg-green-500' : percent > 25 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className={`flex items-center gap-2 ${isMe ? '' : 'flex-row-reverse'}`}>
      <span className={`text-sm font-bold ${isMe ? 'text-blue-400' : 'text-red-400'}`}>
        {name}
      </span>
      <div className="w-40 h-4 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500 rounded-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-8 text-center">{hp}</span>
    </div>
  )
}
