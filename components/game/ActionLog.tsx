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
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-bg-overlay"
      style={{
        animation: 'mb-overlay-in var(--dur-fast) var(--ease-out-quart) both',
      }}
      onClick={onClose}
    >
      <div
        className="bg-bg-mid border-l border-line-strong w-full sm:w-[420px] h-full overflow-y-auto"
        style={{
          boxShadow: '-4px 0 32px rgba(2,4,12,0.6)',
          animation:
            'mb-slide-in-right var(--dur-base) var(--ease-glide) both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-bg-mid border-b border-line-soft px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-text">📜 アクションログ</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-bg-elev hover:bg-bg-deep border border-line text-text flex items-center justify-center transition-colors duration-[var(--dur-fast)]"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {log.length === 0 ? (
          <div className="p-6 text-center text-text-faint text-sm">
            まだログがありません
          </div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {[...log].reverse().map((entry, idx) => (
              <LogEntryItem
                key={entry.turn}
                entry={entry}
                staggerIndex={Math.min(idx, 8)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const LogEntryItem = ({
  entry,
  staggerIndex = 0,
}: {
  entry: LogEntry
  staggerIndex?: number
}) => {
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
    <li
      className="px-4 py-3 space-y-2"
      style={{
        animation: 'mb-result-row var(--dur-base) var(--ease-out-quart) both',
        animationDelay: `${staggerIndex * 40}ms`,
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-warn font-bold text-sm mb-tabular">Turn {turn}</span>
      </div>

      {/* アクション */}
      {actionEntries.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            アクション
          </div>
          {actionEntries.map(([pid, a]) => (
            <div key={pid} className="text-xs text-text leading-snug">
              <span className="text-text-dim">▸</span> {a.description}
            </div>
          ))}
        </div>
      )}

      {/* ダメージ内訳 */}
      {damageBreakdown.some((d) => d.total > 0) && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            ダメージ
          </div>
          {damageBreakdown.map(({ pid, total, bullet, curve }) =>
            total > 0 ? (
              <div key={pid} className="text-xs leading-snug mb-tabular">
                <span className="text-text-mid">{nameOf(pid)}</span>
                <span className="text-error font-bold"> -{total}</span>
                <span className="text-text-faint">
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
          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            弾イベント
          </div>
          {result.bulletEvents.map((ev, i) => (
            <div key={i} className="text-xs text-warn/90 leading-snug">
              {ev}
            </div>
          ))}
        </div>
      )}

      {/* 素数合成 */}
      {primeEntries.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            素数合成
          </div>
          {primeEntries.map(([pid, value]) => (
            <div key={pid} className="text-xs text-prime-edge leading-snug">
              ✨ {nameOf(pid)} が PRIME {value} を生成
            </div>
          ))}
        </div>
      )}

      {/* アイテム撃破 */}
      {itemKills.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            アイテム
          </div>
          {itemKills.map((k) => (
            <div key={k.itemId} className="text-xs text-op-sub leading-snug">
              🎁 {nameOf(k.killerId)} が「{k.kind}」を撃破{' '}
              {k.awarded ? '(獲得)' : '(満杯)'}
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
