import type { MouseEvent } from 'react'
import type { FieldItem } from '@/lib/types'

interface ItemDisplayProps {
  item: FieldItem
  fieldSize: { width: number; height: number }
  onClick?: (item: FieldItem, e: MouseEvent) => void
}

// 演算子別カラーリング (token 経由)。pack はレア演出として全演算子の色を象徴する金色寄り。
// heal は回復を象徴する success 系の緑。
const colorOf = (kind: FieldItem['kind']): string => {
  switch (kind) {
    case '+': return 'bg-op-add-bg/80 border-op-add-border text-op-add'
    case '-': return 'bg-op-sub-bg/80 border-op-sub-border text-op-sub'
    case '×': return 'bg-op-mul-bg/80 border-op-mul-border text-op-mul'
    case '÷': return 'bg-op-div-bg/80 border-op-div-border text-op-div'
    case 'pack': return 'bg-warn/20 border-warn text-warn'
    case 'heal': return 'bg-success/20 border-success text-success'
  }
}

const labelOf = (kind: FieldItem['kind']): string => {
  switch (kind) {
    case 'pack': return '±×÷'
    case 'heal': return '♥'
    default: return kind
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
      {/* 本体 (角丸正方形)。pack はラベルが長いので少し小さめに。 */}
      <div
        className={`w-full h-full ${colorOf(item.kind)} border-2 rounded-md flex items-center justify-center font-bold shadow-lg ${item.kind === 'pack' ? 'text-[10px] sm:text-xs tracking-tighter' : 'text-lg sm:text-xl'}`}
      >
        {labelOf(item.kind)}
      </div>
      {/* HP バー (上部に重ねる) */}
      <div className="absolute -top-2 left-0 right-0 h-1 bg-bg-mid/80 rounded overflow-hidden border border-line-soft">
        <div
          className="h-full bg-warn transition-[width] duration-[var(--dur-fast)]"
          style={{ width: `${hpPct}%` }}
        />
      </div>
      {/* HP 数値 (右下) */}
      <div className="absolute -bottom-3 right-0 text-[9px] text-warn leading-none bg-bg-overlay px-1 rounded mb-tabular">
        {item.hp}
      </div>
    </div>
  )
}
