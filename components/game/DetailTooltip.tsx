import type { Bullet, FunctionCurve, FieldItem } from '@/lib/types'
import { isPrimeBullet } from '@/lib/prime'
import {
  BASE_BULLET_SPEED,
  SPEED_DECAY_FACTOR,
  MAX_REFLECTIONS,
  FUNCTION_DAMAGE,
} from '@/lib/constants'

export type DetailTarget =
  | { kind: 'bullet'; data: Bullet; isOwn: boolean }
  | { kind: 'curve'; data: FunctionCurve; isOwn: boolean }
  | { kind: 'item'; data: FieldItem }

interface DetailTooltipProps {
  target: DetailTarget
  anchor: { leftPct: number; topPct: number }
  onClose: () => void
}

const calcBulletSpeed = (value: number): number =>
  BASE_BULLET_SPEED / (1 + Math.abs(value) * SPEED_DECAY_FACTOR)

const speedQualitative = (value: number): string => {
  if (Math.abs(value) <= 3) return '速い'
  if (Math.abs(value) <= 9) return '普通'
  return '遅い'
}

export const DetailTooltip = ({ target, anchor, onClose }: DetailTooltipProps) => {
  // 縦方向: アンカーが下半分なら上に出す、上半分なら下に出す
  const placeAbove = anchor.topPct > 50
  // 横方向: 左端/右端でクランプ (ツールチップ中心をアンカー中心に合わせるが端で押し戻す)
  const clampedLeft = Math.max(15, Math.min(85, anchor.leftPct))

  return (
    <div
      className="absolute z-30 w-[180px] bg-bg-mid/95 border border-line-strong rounded-md p-2 text-xs text-text-mid pointer-events-auto"
      style={{
        left: `${clampedLeft}%`,
        top: `${anchor.topPct}%`,
        transform: placeAbove
          ? 'translate(-50%, calc(-100% - 14px))'
          : 'translate(-50%, 14px)',
        boxShadow: '0 4px 24px rgba(2,4,12,0.6), 0 0 0 1px var(--color-line-soft)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-bg-elev border border-line text-text hover:bg-bg-mid text-sm leading-none flex items-center justify-center transition-colors duration-[var(--dur-fast)]"
        onClick={onClose}
        aria-label="閉じる"
      >
        ×
      </button>

      {target.kind === 'bullet' && <BulletDetail bullet={target.data} isOwn={target.isOwn} />}
      {target.kind === 'curve' && <CurveDetail curve={target.data} isOwn={target.isOwn} />}
      {target.kind === 'item' && <ItemDetail item={target.data} />}
    </div>
  )
}

const BulletDetail = ({ bullet, isOwn }: { bullet: Bullet; isOwn: boolean }) => {
  const isPrime = isPrimeBullet(bullet.value)
  const speed = calcBulletSpeed(bullet.value)
  const qual = speedQualitative(bullet.value)

  return (
    <div className="space-y-1 pr-2 mb-tabular">
      <div className="font-bold text-sm border-b border-line-soft pb-1 mb-1">
        {isPrime ? (
          <span className="text-prime">素数弾 ({bullet.value})</span>
        ) : (
          <span className={isOwn ? 'text-p1' : 'text-p2'}>
            {isOwn ? '自分の弾' : '相手の弾'}
          </span>
        )}
      </div>
      <div>
        ダメージ: <span className="font-bold text-warn">{bullet.value}</span>
      </div>
      <div>
        速度:{' '}
        <span className="font-bold">{speed.toFixed(1)}</span>
        <span className="text-text-dim"> px/tick</span>
        <span className="text-text-mid"> ({qual})</span>
      </div>
      <div>
        反射: {bullet.reflections} / {MAX_REFLECTIONS}
      </div>
      {isPrime && (
        <div className="text-[10px] text-prime-edge leading-tight">
          通常弾を貫通・素数弾同士もすり抜ける
        </div>
      )}
    </div>
  )
}

const CurveDetail = ({ curve, isOwn }: { curve: FunctionCurve; isOwn: boolean }) => {
  return (
    <div className="space-y-1 pr-2">
      <div className="font-bold text-sm border-b border-line-soft pb-1 mb-1">
        <span className={isOwn ? 'text-p1' : 'text-p2'}>
          {isOwn ? '自分の関数' : '相手の関数'}
        </span>
      </div>
      <div className="font-mono text-[11px] break-all bg-bg-deep/60 border border-line-soft px-1.5 py-1 rounded">
        {curve.displayString}
      </div>
      <div className="mb-tabular">
        ダメージ: <span className="font-bold text-warn">{FUNCTION_DAMAGE}</span>
        <span className="text-text-dim"> / ターン</span>
      </div>
      <div className="text-[10px] text-text-dim leading-tight">
        曲線上にいる敵プレイヤーへ毎ターン判定
      </div>
    </div>
  )
}

const ItemDetail = ({ item }: { item: FieldItem }) => {
  const hpPct = Math.max(0, Math.min(100, (item.hp / item.maxHp) * 100))
  const operatorLabel: Record<string, string> = {
    '+': '加算 (+)',
    '-': '減算 (-)',
    '×': '乗算 (×)',
    '÷': '除算 (÷)',
  }
  return (
    <div className="space-y-1 pr-2">
      <div className="font-bold text-sm border-b border-line-soft pb-1 mb-1">
        <span className="text-success">アイテム「{item.kind}」</span>
      </div>
      <div className="mb-tabular">
        HP: <span className="font-bold text-warn">{item.hp}</span>
        <span className="text-text-dim"> / {item.maxHp}</span>
      </div>
      <div className="h-1.5 bg-bg-deep border border-line-soft rounded overflow-hidden">
        <div
          className="h-full bg-warn transition-[width] duration-[var(--dur-fast)]"
          style={{ width: `${hpPct}%` }}
        />
      </div>
      <div className="text-[10px] text-success leading-tight">
        破壊で「{operatorLabel[item.kind] ?? item.kind}」演算子カードをゲット
      </div>
    </div>
  )
}
