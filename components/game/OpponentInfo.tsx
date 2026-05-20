import type { SanitizedPlayerState, GameSettings } from '@/lib/types'
import { NextDrawPreview } from './NextDrawPreview'

interface OpponentInfoProps {
  opponent: SanitizedPlayerState
  settings: GameSettings
}

export const OpponentInfo = ({ opponent, settings }: OpponentInfoProps) => {
  return (
    <div className="flex items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-text-dim justify-end mb-tabular flex-wrap">
      <span>手札: <span className={opponent.handCount >= settings.maxHandSize ? 'text-error font-bold' : ''}>{opponent.handCount}/{settings.maxHandSize}</span>枚</span>
      <NextDrawPreview cards={opponent.nextDraw} isMe={false} />
    </div>
  )
}
