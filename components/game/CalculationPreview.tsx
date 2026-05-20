import type { HandItem } from '@/lib/types'
import { evaluateCalculation, validateCalculation } from '@/lib/calc-engine'
import { isPrimeBullet } from '@/lib/prime'

interface CalculationPreviewProps {
  hand: HandItem[]
  selectedIndices: number[]
}

const getItemLabel = (item: HandItem | undefined): string => {
  if (!item) return '?'
  switch (item.type) {
    case 'number': return Number.isFinite(item.value) ? String(item.value) : '∞'
    case 'operator': return item.operator
    case 'token': return Number.isFinite(item.value) ? String(item.value) : '∞'
    case 'move': return '?'
    case 'function': return 'ƒ'
  }
}

const getItemStyle = (item: HandItem | undefined): string => {
  const base =
    'inline-flex items-center justify-center w-8 h-10 rounded border-2 font-bold text-sm mb-tabular'
  if (!item) return `${base} border-line bg-bg-elev text-text-dim`
  switch (item.type) {
    case 'number':
      return `${base} border-p1-deep bg-p1-bg text-p1`
    case 'operator':
      return `${base} border-op-mul-border bg-op-mul-bg text-op-mul`
    case 'token':
      return `${base} border-success bg-op-add-bg text-op-add`
    case 'move':
      return `${base} border-line bg-bg-elev text-text-mute`
    case 'function':
      return `${base} border-op-add-border bg-op-add-bg text-op-add italic`
  }
}

const formatResult = (value: number): string => {
  if (!Number.isFinite(value)) return '∞'
  return String(value)
}

export const CalculationPreview = ({ hand, selectedIndices }: CalculationPreviewProps) => {
  const isValid = selectedIndices.length > 0 && validateCalculation(hand, selectedIndices) === null
  const result = isValid
    ? evaluateCalculation(selectedIndices.map((i) => hand[i]))
    : null
  const isPrimeResult = result !== null && isPrimeBullet(result)

  return (
    <div className="flex items-center gap-1 justify-center flex-wrap">
      {selectedIndices.length === 0 && (
        <span className="text-text-faint text-sm">カードを選んでください...</span>
      )}
      {selectedIndices.map((handIndex, i) => {
        const item = hand[handIndex]
        return (
          <div key={i} className={getItemStyle(item)}>
            {getItemLabel(item)}
          </div>
        )
      })}
      {result !== null && (
        <>
          <span className="text-text-dim font-bold text-sm mx-1 font-mono">=</span>
          <div
            className={
              isPrimeResult
                ? 'inline-flex items-center justify-center min-w-8 h-10 px-2 rounded border-2 border-op-sub-border bg-op-sub-bg text-op-sub font-bold text-sm mb-tabular'
                : 'inline-flex items-center justify-center min-w-8 h-10 px-2 rounded border-2 border-success bg-op-add-bg text-op-add font-bold text-sm mb-tabular'
            }
          >
            {formatResult(result)}
          </div>
        </>
      )}
    </div>
  )
}
