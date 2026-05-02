import type { SanitizedPlayerState } from '@/lib/types'
import { MAX_HAND_SIZE } from '@/lib/constants'

interface OpponentInfoProps {
  opponent: SanitizedPlayerState
}

export const OpponentInfo = ({ opponent }: OpponentInfoProps) => {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-text-dim justify-end mb-tabular">
      <span>手札: <span className={opponent.handCount >= MAX_HAND_SIZE ? 'text-error font-bold' : ''}>{opponent.handCount}/{MAX_HAND_SIZE}</span>枚</span>
      <span>デッキ残: {opponent.deckRemaining}枚</span>
      <span>関数残: {opponent.functionUsesRemaining}回</span>
    </div>
  )
}
