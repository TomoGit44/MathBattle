import type { TurnResult as TurnResultType } from '@/lib/types'

interface TurnResultProps {
  turnResult: TurnResultType
}

export const TurnResult = ({ turnResult }: TurnResultProps) => {
  const primeEntries = Object.entries(turnResult.primeSynthesis ?? {})
  const hasContent =
    Object.values(turnResult.actions).length > 0 ||
    Object.entries(turnResult.damages).length > 0 ||
    Object.entries(turnResult.curveDamages).length > 0 ||
    turnResult.bulletEvents.length > 0

  return (
    <>
    {hasContent && (
    <div className="relative bg-gray-800/80 rounded-lg p-3 text-sm space-y-1">
      {Object.values(turnResult.actions).map((action, i) => (
        <div key={i} className="text-gray-300">{action.description}</div>
      ))}
      {Object.entries(turnResult.damages).map(([id, dmg]) => (
        <div key={id} className="text-red-400">
          {dmg} ダメージ!
        </div>
      ))}
      {Object.entries(turnResult.curveDamages).map(([id, dmg]) => (
        <div key={id} className="text-emerald-400">
          📐 曲線ダメージ: {dmg}
        </div>
      ))}
      {turnResult.bulletEvents.map((event, i) => (
        <div key={i} className="text-yellow-400">{event}</div>
      ))}
    </div>
    )}

      {/* 素数合成演出: フェードアウトする "PRIME!" テキスト */}
      {primeEntries.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          {primeEntries.map(([id, value]) => (
            <div
              key={id}
              className="flex flex-col items-center animate-[primeFlash_2.5s_ease-out_forwards]"
            >
              <div className="text-7xl font-black tracking-widest bg-gradient-to-r from-fuchsia-400 via-purple-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(217,70,239,0.9)]">
                PRIME!
              </div>
              <div className="mt-2 text-3xl font-bold text-fuchsia-200 drop-shadow-[0_0_12px_rgba(217,70,239,0.9)]">
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* キーフレーム定義 */}
      <style jsx global>{`
        @keyframes primeFlash {
          0% {
            opacity: 0;
            transform: scale(0.6);
          }
          20% {
            opacity: 1;
            transform: scale(1.2);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.4);
          }
        }
      `}</style>
    </>
  )
}
