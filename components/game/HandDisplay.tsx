import type { HandItem } from '@/lib/types'
import { isPrimeBullet } from '@/lib/prime'
import { PrimeAura } from './PrimeAura'

interface HandDisplayProps {
  hand: HandItem[]
  selectedIndices: Set<number>
  onToggle: (index: number) => void
  selectable: boolean
  disabledIndices?: Set<number>
  /** 玉が飛行中で、まだ手札に「現れていない」インデックス。opacity:0 で隠す */
  pendingIndices?: Set<number>
  /** 玉が着地し、入場アニメーションを再生中のインデックス */
  arrivingIndices?: Set<number>
}

const dirArrow = (d: 'up' | 'down' | 'left' | 'right'): string =>
  ({ up: '↑', down: '↓', left: '←', right: '→' }[d])

const getLabel = (item: HandItem): string => {
  switch (item.type) {
    case 'number': return Number.isFinite(item.value) ? String(item.value) : '∞'
    case 'operator': return item.operator
    case 'token': return Number.isFinite(item.value) ? String(item.value) : '∞'
    case 'move': return dirArrow(item.direction)
  }
}

const getStyle = (item: HandItem, selected: boolean): string => {
  // タッチターゲット最小 44px (Apple HIG / Material Guidelines)
  // 触感: hover で持ち上げ + ボーダー強調、active で押し込み、selected でスケール+リング
  const base =
    'w-11 h-14 sm:w-12 sm:h-16 rounded-lg border-2 flex items-center justify-center font-bold text-base sm:text-lg cursor-pointer touch-manipulation mb-tabular ' +
    'transition-[transform,border-color,background-color,box-shadow] duration-[var(--dur-fast)] [transition-timing-function:var(--ease-glide)] ' +
    'hover:-translate-y-[2px] active:translate-y-[1px] active:scale-[0.97] will-change-transform'

  if (selected) {
    return `${base} border-axis-origin bg-bg-elev text-axis-origin scale-110 -translate-y-[3px] shadow-[0_0_0_3px_rgba(103,232,249,0.18),0_8px_18px_-6px_rgba(103,232,249,0.55)]`
  }

  switch (item.type) {
    case 'number':
      return `${base} border-p1-deep bg-p1-bg text-p1 hover:border-p1 hover:shadow-[0_6px_14px_-6px_var(--color-p1-glow)]`
    case 'operator':
      return `${base} border-op-mul-border bg-op-mul-bg text-op-mul hover:border-op-mul hover:shadow-[0_6px_14px_-6px_rgba(192,132,252,0.5)]`
    case 'token':
      return `${base} border-success bg-op-add-bg text-op-add hover:border-op-add hover:shadow-[0_6px_14px_-6px_rgba(74,222,128,0.5)]`
    case 'move':
      return `${base} border-axis-origin/50 bg-bg-elev text-axis-origin text-2xl hover:border-axis-origin hover:shadow-[0_6px_14px_-6px_rgba(103,232,249,0.5)]`
  }
}

export const HandDisplay = ({
  hand,
  selectedIndices,
  onToggle,
  selectable,
  disabledIndices,
  pendingIndices,
  arrivingIndices,
}: HandDisplayProps) => {
  return (
    <div className="flex gap-1.5 sm:gap-2 justify-center flex-wrap">
      {hand.map((item, index) => {
        const isDisabled = !selectable || disabledIndices?.has(index)
        const isPrime =
          (item.type === 'token' || item.type === 'number') && isPrimeBullet(item.value)
        const isInfinity =
          (item.type === 'token' || item.type === 'number') && !Number.isFinite(item.value)
        const isPending = pendingIndices?.has(index) ?? false
        const isArriving = arrivingIndices?.has(index) ?? false

        // 既存カード (新規ではない) は静的表示 — 毎レンダーの mb-card-in を廃止して
        // 「動いたカード = 新規」と分かるようにする
        const wrapperStyle: React.CSSProperties = isPending
          ? { opacity: 0, pointerEvents: 'none' }
          : isArriving
          ? {
              animation: 'mb-card-arrival var(--dur-base) var(--ease-glide) both',
              willChange: 'transform, opacity',
            }
          : {}

        return (
          <div
            key={index}
            data-hand-card-index={index}
            className="relative"
            style={wrapperStyle}
          >
            {isPrime && <PrimeAura shape="rounded" />}
            <button
              className={`relative ${getStyle(item, selectedIndices.has(index))} ${isDisabled ? 'opacity-40' : ''} ${
                isInfinity
                  ? 'border-warn !text-warn !bg-bg-deep [text-shadow:0_0_10px_var(--color-warn),0_0_22px_var(--color-warn)]'
                  : ''
              }`}
              style={
                isPrime
                  ? { boxShadow: 'var(--shadow-prime)' }
                  : isInfinity
                  ? { boxShadow: '0 0 14px 2px var(--color-warn), inset 0 0 10px rgba(0,0,0,0.6)' }
                  : undefined
              }
              onClick={() => !isDisabled && !isPending && onToggle(index)}
              disabled={!!isDisabled || isPending}
            >
              {getLabel(item)}
            </button>
          </div>
        )
      })}
      {hand.length === 0 && (
        <span className="text-text-faint text-sm">手札がありません</span>
      )}
    </div>
  )
}
