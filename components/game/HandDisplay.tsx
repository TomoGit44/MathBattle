import type { HandItem } from '@/lib/types'
import { isPrimeBullet } from '@/lib/prime'

interface HandDisplayProps {
  hand: HandItem[]
  selectedIndices: Set<number>
  onToggle: (index: number) => void
  selectable: boolean
  disabledIndices?: Set<number>
}

const getLabel = (item: HandItem): string => {
  switch (item.type) {
    case 'number': return String(item.value)
    case 'operator': return item.operator
    case 'token': return String(item.value)
  }
}

const getStyle = (item: HandItem, selected: boolean): string => {
  // タッチターゲット最小 44px (Apple HIG / Material Guidelines)
  const base = 'w-11 h-14 sm:w-12 sm:h-16 rounded-lg border-2 flex items-center justify-center font-bold text-base sm:text-lg cursor-pointer transition-all touch-manipulation'

  if (selected) {
    return `${base} border-yellow-400 bg-yellow-900 text-yellow-200 scale-110`
  }

  switch (item.type) {
    case 'number':
      return `${base} border-blue-500 bg-blue-950 text-blue-200 hover:border-blue-400`
    case 'operator':
      return `${base} border-purple-500 bg-purple-950 text-purple-200 hover:border-purple-400`
    case 'token':
      return `${base} border-green-500 bg-green-950 text-green-200 hover:border-green-400`
  }
}

export const HandDisplay = ({ hand, selectedIndices, onToggle, selectable, disabledIndices }: HandDisplayProps) => {
  return (
    <div className="flex gap-1.5 sm:gap-2 justify-center flex-wrap">
      {hand.map((item, index) => {
        const isDisabled = !selectable || disabledIndices?.has(index)
        const isPrime =
          (item.type === 'token' || item.type === 'number') && isPrimeBullet(item.value)
        return (
          <div key={index} className="relative">
            {isPrime && (
              <>
                {/* 素数オーラ: 持続的なグロー */}
                <span className="pointer-events-none absolute -inset-1 rounded-lg bg-gradient-to-r from-purple-500 via-fuchsia-400 to-blue-500 opacity-60 blur-md animate-pulse" />
                {/* 回転する外輪 */}
                <span className="pointer-events-none absolute -inset-0.5 rounded-lg ring-2 ring-fuchsia-300/70 animate-[spin_4s_linear_infinite]" />
              </>
            )}
            <button
              className={`relative ${getStyle(item, selectedIndices.has(index))} ${isDisabled ? 'opacity-40' : ''} ${isPrime ? 'shadow-[0_0_12px_rgba(217,70,239,0.9)]' : ''}`}
              onClick={() => !isDisabled && onToggle(index)}
              disabled={!!isDisabled}
            >
              {getLabel(item)}
            </button>
          </div>
        )
      })}
      {hand.length === 0 && (
        <span className="text-gray-500 text-sm">手札がありません</span>
      )}
    </div>
  )
}
