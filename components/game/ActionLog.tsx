import type { TurnResult } from '@/lib/types'

export interface LogEntry {
  turn: number
  result: TurnResult
  playerNames: Record<string, string>
}

interface ActionLogProps {
  log: LogEntry[]
  open: boolean
  onClose: () => void
}

export const ActionLog = ({ log, open, onClose }: ActionLogProps) => {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border-l-2 border-gray-700 w-full sm:w-[420px] h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-100">📜 アクションログ</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center justify-center"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {log.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            まだログがありません
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {[...log].reverse().map((entry) => (
              <LogEntryItem key={entry.turn} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const LogEntryItem = ({ entry }: { entry: LogEntry }) => {
  const { turn, result, playerNames } = entry
  const nameOf = (id: string) => playerNames[id] ?? id

  // 各プレイヤーごとのダメージ内訳 (弾 vs 曲線)
  const playerIds = Array.from(
    new Set([
      ...Object.keys(result.damages),
      ...Object.keys(result.curveDamages),
    ])
  )

  const damageBreakdown = playerIds.map((pid) => {
    const total = result.damages[pid] ?? 0
    const curve = result.curveDamages[pid] ?? 0
    const bullet = Math.max(0, total - curve)
    return { pid, total, curve, bullet }
  })

  const actionEntries = Object.entries(result.actions)
  const primeEntries = Object.entries(result.primeSynthesis ?? {})
  const itemKills = result.itemKills ?? []

  return (
    <li className="px-4 py-3 space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-yellow-400 font-bold text-sm">Turn {turn}</span>
      </div>

      {/* アクション */}
      {actionEntries.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            アクション
          </div>
          {actionEntries.map(([pid, a]) => (
            <div key={pid} className="text-xs text-gray-200 leading-snug">
              <span className="text-gray-400">▸</span> {a.description}
            </div>
          ))}
        </div>
      )}

      {/* ダメージ内訳 */}
      {damageBreakdown.some((d) => d.total > 0) && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            ダメージ
          </div>
          {damageBreakdown.map(({ pid, total, bullet, curve }) =>
            total > 0 ? (
              <div key={pid} className="text-xs leading-snug">
                <span className="text-gray-300">{nameOf(pid)}</span>
                <span className="text-red-400 font-bold"> -{total}</span>
                <span className="text-gray-500">
                  {' '}
                  ({bullet > 0 && `弾 ${bullet}`}
                  {bullet > 0 && curve > 0 && ' / '}
                  {curve > 0 && `曲線 ${curve}`})
                </span>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* 弾イベント (衝突・反射など) */}
      {result.bulletEvents.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            弾イベント
          </div>
          {result.bulletEvents.map((ev, i) => (
            <div key={i} className="text-xs text-yellow-300/90 leading-snug">
              {ev}
            </div>
          ))}
        </div>
      )}

      {/* 素数合成 */}
      {primeEntries.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            素数合成
          </div>
          {primeEntries.map(([pid, value]) => (
            <div key={pid} className="text-xs text-fuchsia-300 leading-snug">
              ✨ {nameOf(pid)} が PRIME {value} を生成
            </div>
          ))}
        </div>
      )}

      {/* アイテム撃破 */}
      {itemKills.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            アイテム
          </div>
          {itemKills.map((k) => (
            <div key={k.itemId} className="text-xs text-amber-300 leading-snug">
              🎁 {nameOf(k.killerId)} が「{k.kind}」を撃破{' '}
              {k.awarded ? '(獲得)' : '(満杯)'}
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
