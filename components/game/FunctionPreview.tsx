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
  const base = 'inline-flex items-center justify-center w-8 h-10 rounded border-2 font-bold text-sm'
  if (entry.type === 'x') {
    return `${base} border-amber-400 bg-amber-900 text-amber-200`
  }
  const item = hand[entry.index]
  if (!item) return `${base} border-gray-500 bg-gray-800 text-gray-400`
  switch (item.type) {
    case 'number':
      return `${base} border-blue-500 bg-blue-950 text-blue-200`
    case 'operator':
      return `${base} border-purple-500 bg-purple-950 text-purple-200`
    case 'token':
      return `${base} border-green-500 bg-green-950 text-green-200`
  }
}

export const FunctionPreview = ({ sequence, hand }: FunctionPreviewProps) => {
  return (
    <div className="flex items-center gap-1 justify-center flex-wrap">
      <span className="text-emerald-400 font-bold text-sm mr-1">f(x) =</span>
      {sequence.length === 0 && (
        <span className="text-gray-500 text-sm">...</span>
      )}
      {sequence.map((entry, i) => (
        <div key={i} className={getItemStyle(entry, hand)}>
          {getItemLabel(entry, hand)}
        </div>
      ))}
    </div>
  )
}
