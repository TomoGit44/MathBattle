import type { HandLogEntry, HandLogReason, TurnResult } from '@/lib/types'

const reasonLabel = (reason: HandLogReason): string => {
  switch (reason) {
    case 'draw_op': return '演算子枠 補充'
    case 'draw_num': return '数字枠 補充'
    case 'draw_other': return 'その他枠 補充'
    case 'attack': return '攻撃で発射'
    case 'function': return '関数で消費'
    case 'calc': return '計算で消費'
    case 'calc_result': return '計算結果'
    case 'use_move': return '移動で使用'
    case 'discard': return '捨てた'
    case 'item_kill': return 'アイテム撃破で獲得'
    case 'item_pickup': return 'アイテム拾得で獲得'
  }
}

const HandLogSection = ({ entries }: { entries: HandLogEntry[] }) => {
  if (!entries || entries.length === 0) return null
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-text-faint">
        手札の変動
      </div>
      {entries.map((e, i) => (
        <div key={i} className="text-xs leading-snug mb-tabular">
          <span className={e.kind === 'add' ? 'text-op-add' : 'text-error'}>
            {e.kind === 'add' ? '＋' : '−'}
          </span>{' '}
          <span className="font-bold text-text">{e.cardLabel}</span>
          <span className="text-text-faint"> ({reasonLabel(e.reason)})</span>
        </div>
      ))}
    </div>
  )
}

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
  const itemPickups = result.itemPickups ?? []
  const handLog = result.handLog ?? []
  const healEntries = Object.entries(result.heals ?? {})

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

      {/* 手札の変動 (自分分のみ) */}
      <HandLogSection entries={handLog} />

      {/* 回復イベント */}
      {healEntries.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            回復
          </div>
          {healEntries.map(([pid, hp]) => (
            <div key={pid} className="text-xs leading-snug mb-tabular text-op-add">
              ❤️ {nameOf(pid)} <span className="font-bold">+{hp}</span> HP
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

      {/* アイテム撃破 / 拾得 */}
      {(itemKills.length > 0 || itemPickups.length > 0) && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            アイテム
          </div>
          {itemKills.map((k) => {
            const isPack = k.kind === 'pack'
            const isHeal = k.kind === 'heal'
            const label = isPack ? '演算子パック' : isHeal ? '回復アイテム' : `「${k.kind}」`
            const awardLabel = isPack
              ? k.awardedCount === 4
                ? '(4枚獲得)'
                : k.awardedCount > 0
                  ? `(${k.awardedCount}/4獲得)`
                  : '(満杯)'
              : isHeal
                ? k.awardedCount > 0 ? `(+${k.awardedCount} HP)` : '(HP満タン)'
                : k.awardedCount > 0 ? '(獲得)' : '(満杯)'
            return (
              <div key={`kill-${k.itemId}`} className="text-xs text-op-sub leading-snug">
                🎁 {nameOf(k.killerId)} が{label}を撃破 {awardLabel}
              </div>
            )
          })}
          {itemPickups.map((p) => {
            const isPack = p.kind === 'pack'
            const isHeal = p.kind === 'heal'
            const label = isPack ? '演算子パック' : isHeal ? '回復アイテム' : `「${p.kind}」`
            const awardLabel = isPack && p.awardedCount > 0
              ? p.awardedCount === 4 ? ' (4枚獲得)' : ` (${p.awardedCount}/4獲得)`
              : isHeal && p.awardedCount > 0
                ? ` (+${p.awardedCount} HP)`
                : ''
            return (
              <div key={`pick-${p.itemId}`} className="text-xs text-op-sub leading-snug">
                ✋ {nameOf(p.pickerId)} が{label}を拾得{awardLabel}
              </div>
            )
          })}
        </div>
      )}
    </li>
  )
}
