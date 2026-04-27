import type { MouseEvent } from 'react'
import type { FieldItem } from '@/lib/types'

interface ItemDisplayProps {
  item: FieldItem
  fieldSize: { width: number; height: number }
  onClick?: (item: FieldItem, e: MouseEvent) => void
}

// 演算子別カラーリング
const colorOf = (kind: FieldItem['kind']): string => {
  switch (kind) {
    case '+': return 'bg-green-900/80 border-green-400 text-green-200'
    case '-': return 'bg-orange-900/80 border-orange-400 text-orange-200'
    case '×': return 'bg-purple-900/80 border-purple-400 text-purple-200'
    case '÷': return 'bg-pink-900/80 border-pink-400 text-pink-200'
  }
}

export const ItemDisplay = ({ item, fieldSize, onClick }: ItemDisplayProps) => {
  const left = (item.position.x / fieldSize.width) * 100
  const top = (item.position.y / fieldSize.height) * 100
  const widthPct = ((item.size) / fieldSize.width) * 100
  const heightPct = ((item.size) / fieldSize.height) * 100
  const hpPct = Math.max(0, Math.min(100, (item.hp / item.maxHp) * 100))

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${onClick ? 'cursor-pointer' : 'pointer-events-none'}`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
      }}
      onClick={onClick ? (e) => onClick(item, e) : undefined}
    >
      {/* 本体 (角丸正方形) */}
      <div
        className={`w-full h-full ${colorOf(item.kind)} border-2 rounded-md flex items-center justify-center font-bold text-lg sm:text-xl shadow-lg`}
      >
        {item.kind}
      </div>
      {/* HP バー (上部に重ねる) */}
      <div className="absolute -top-2 left-0 right-0 h-1 bg-gray-800/80 rounded overflow-hidden">
        <div
          className="h-full bg-yellow-400 transition-all"
          style={{ width: `${hpPct}%` }}
        />
      </div>
      {/* HP 数値 (右下) */}
      <div className="absolute -bottom-3 right-0 text-[9px] text-yellow-300 leading-none bg-black/60 px-1 rounded">
        {item.hp}
      </div>
    </div>
  )
}
