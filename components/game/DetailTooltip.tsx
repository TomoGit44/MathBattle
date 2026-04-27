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
      className="absolute z-30 w-[180px] bg-gray-900/95 border border-gray-500 rounded-md shadow-2xl p-2 text-xs text-gray-200 pointer-events-auto"
      style={{
        left: `${clampedLeft}%`,
        top: `${anchor.topPct}%`,
        transform: placeAbove
          ? 'translate(-50%, calc(-100% - 14px))'
          : 'translate(-50%, 14px)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 border border-gray-500 text-gray-200 hover:bg-gray-600 text-sm leading-none flex items-center justify-center"
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
    <div className="space-y-1 pr-2">
      <div className="font-bold text-sm border-b border-gray-700 pb-1 mb-1">
        {isPrime ? (
          <span className="text-fuchsia-300">素数弾 ({bullet.value})</span>
        ) : (
          <span className={isOwn ? 'text-blue-300' : 'text-red-300'}>
            {isOwn ? '自分の弾' : '相手の弾'}
          </span>
        )}
      </div>
      <div>
        ダメージ: <span className="font-bold text-yellow-300">{bullet.value}</span>
      </div>
      <div>
        速度:{' '}
        <span className="font-bold">{speed.toFixed(1)}</span>
        <span className="text-gray-400"> px/tick</span>
        <span className="text-gray-300"> ({qual})</span>
      </div>
      <div>
        反射: {bullet.reflections} / {MAX_REFLECTIONS}
      </div>
      {isPrime && (
        <div className="text-[10px] text-fuchsia-400 leading-tight">
          通常弾を貫通・素数弾同士もすり抜ける
        </div>
      )}
    </div>
  )
}

const CurveDetail = ({ curve, isOwn }: { curve: FunctionCurve; isOwn: boolean }) => {
  return (
    <div className="space-y-1 pr-2">
      <div className="font-bold text-sm border-b border-gray-700 pb-1 mb-1">
        <span className={isOwn ? 'text-blue-300' : 'text-red-300'}>
          {isOwn ? '自分の関数' : '相手の関数'}
        </span>
      </div>
      <div className="font-mono text-[11px] break-all bg-black/40 px-1.5 py-1 rounded">
        {curve.displayString}
      </div>
      <div>
        ダメージ: <span className="font-bold text-yellow-300">{FUNCTION_DAMAGE}</span>
        <span className="text-gray-400"> / ターン</span>
      </div>
      <div className="text-[10px] text-gray-400 leading-tight">
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
      <div className="font-bold text-sm border-b border-gray-700 pb-1 mb-1">
        <span className="text-emerald-300">アイテム「{item.kind}」</span>
      </div>
      <div>
        HP: <span className="font-bold text-yellow-300">{item.hp}</span>
        <span className="text-gray-400"> / {item.maxHp}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full bg-yellow-400 transition-all"
          style={{ width: `${hpPct}%` }}
        />
      </div>
      <div className="text-[10px] text-emerald-300 leading-tight">
        破壊で「{operatorLabel[item.kind] ?? item.kind}」演算子カードをゲット
      </div>
    </div>
  )
}
