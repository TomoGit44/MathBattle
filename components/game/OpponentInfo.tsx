import type { SanitizedPlayerState } from '@/lib/types'

interface OpponentInfoProps {
  opponent: SanitizedPlayerState
}

export const OpponentInfo = ({ opponent }: OpponentInfoProps) => {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-400 justify-end">
      <span>手札: {opponent.handCount}枚</span>
      <span>デッキ残: {opponent.deckRemaining}枚</span>
      <span>関数残: {opponent.functionUsesRemaining}回</span>
    </div>
  )
}
