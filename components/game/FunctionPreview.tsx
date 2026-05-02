import type { HandItem } from '@/lib/types'

interface FunctionSequenceItem {
  type: 'hand'
  index: number
}

interface FunctionSequenceX {
  type: 'x'
}

export type FunctionSequenceEntry = FunctionSequenceItem | FunctionSequenceX

interface FunctionPreviewProps {
  sequence: FunctionSequenceEntry[]
  hand: HandItem[]
}

const getItemLabel = (entry: FunctionSequenceEntry, hand: HandItem[]): string => {
  if (entry.type === 'x') return 'x'
  const item = hand[entry.index]
  if (!item) return '?'
  switch (item.type) {
    case 'number': return String(item.value)
    case 'operator': return item.operator
    case 'token': return String(item.value)
  }
}

const getItemStyle = (entry: FunctionSequenceEntry, hand: HandItem[]): string => {
  const base =
    'inline-flex items-center justify-center w-8 h-10 rounded border-2 font-bold text-sm mb-tabular'
  if (entry.type === 'x') {
    return `${base} border-op-sub-border bg-op-sub-bg text-op-sub`
  }
  const item = hand[entry.index]
  if (!item) return `${base} border-line bg-bg-elev text-text-dim`
  switch (item.type) {
    case 'number':
      return `${base} border-p1-deep bg-p1-bg text-p1`
    case 'operator':
      return `${base} border-op-mul-border bg-op-mul-bg text-op-mul`
    case 'token':
      return `${base} border-success bg-op-add-bg text-op-add`
  }
}

export const FunctionPreview = ({ sequence, hand }: FunctionPreviewProps) => {
  return (
    <div className="flex items-center gap-1 justify-center flex-wrap">
      <span className="text-success font-bold text-sm mr-1 font-mono">f(x) =</span>
      {sequence.length === 0 && (
        <span className="text-text-faint text-sm">...</span>
      )}
      {sequence.map((entry, i) => (
        <div key={i} className={getItemStyle(entry, hand)}>
          {getItemLabel(entry, hand)}
        </div>
      ))}
    </div>
  )
}
