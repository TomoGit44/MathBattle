import type { SanitizedPlayerState } from '@/lib/types'

interface OpponentInfoProps {
  opponent: SanitizedPlayerState
}

export const OpponentInfo = ({ opponent }: OpponentInfoProps) => {
  return (
    <div className="flex gap-4 text-sm text-gray-400">
      <span>手札: {opponent.handCount}枚</span>
      <span>デッキ残: {opponent.deckRemaining}枚</span>
      <span>関数残: {opponent.functionUsesRemaining}回</span>
    </div>
  )
}
