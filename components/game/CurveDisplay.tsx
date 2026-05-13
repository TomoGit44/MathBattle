'use client'

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { FunctionCurve, GameSettings } from '@/lib/types'
import { evaluateFunction } from '@/lib/func-engine'
import { FIELD_WIDTH, FIELD_HEIGHT, CURVE_SAMPLE_COUNT } from '@/lib/constants'

interface CurveDisplayProps {
  curve: FunctionCurve
  isOwn: boolean
  settings: GameSettings
  onClick?: (curve: FunctionCurve, e: MouseEvent) => void
  /** 直近ターンで自分(=被弾側)に曲線ダメージが入ったか。foe 曲線を脈動させる */
  pulse?: boolean
}

export const CurveDisplay = ({
  curve,
  isOwn,
  settings,
  onClick,
  pulse = false,
}: CurveDisplayProps) => {
  const color = isOwn ? 'var(--color-curve-own)' : 'var(--color-curve-foe)'
  const dashArray = undefined
  const { mathXMax, mathYMax } = settings

  // 曲線をサンプリングしてSVGパスを生成
  const step = (2 * mathXMax) / CURVE_SAMPLE_COUNT
  const segments: string[] = []
  let inPath = false

  for (let i = 0; i <= CURVE_SAMPLE_COUNT; i++) {
    const mathX = -mathXMax + step * i
    const mathY = evaluateFunction(curve.expression, mathX)

    if (mathY === null || mathY < -mathYMax || mathY > mathYMax) {
      inPath = false
      continue
    }

    // 数学座標 → SVG viewBox 座標
    const px = ((mathX + mathXMax) / (2 * mathXMax)) * FIELD_WIDTH
    const py = ((mathYMax - mathY) / (2 * mathYMax)) * FIELD_HEIGHT

    if (!inPath) {
      segments.push(`M ${px} ${py}`)
      inPath = true
    } else {
      segments.push(`L ${px} ${py}`)
    }
  }

  const pathData = segments.join(' ')

  // 「初登場」の判定: マウント直後だけ draw-in アニメ。以降はブリージングへ。
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    // 600ms で描画完了とみなしてブリージングへ移行
    const t = setTimeout(() => setDrawn(true), 620)
    return () => clearTimeout(t)
  }, [curve.id])

  // ダメージパルス: pulse prop が立った瞬間に scale + opacity でパルス。
  // 同じ pulse 値で多重発火しないよう、ターン遷移検知は親側で。
  const [pulseKey, setPulseKey] = useState(0)
  const prevPulseRef = useRef(pulse)
  useEffect(() => {
    if (pulse && !prevPulseRef.current) {
      setPulseKey((k) => k + 1)
    }
    prevPulseRef.current = pulse
  }, [pulse])

  if (!pathData) return null

  // ラベル表示位置: x=0 での y 値
  const labelY = evaluateFunction(curve.expression, 0)
  const labelPx = FIELD_WIDTH / 2
  const labelPy =
    labelY !== null && labelY >= -mathYMax && labelY <= mathYMax
      ? ((mathYMax - labelY) / (2 * mathYMax)) * FIELD_HEIGHT
      : 20

  // 描画: 1本の SVG にまとめる。pathLength=1 にして dasharray=1, dashoffset を 1→0 で draw-in。
  // draw-in 完了後はブリージングのため g 要素に opacity アニメを掛ける。
  // ダメージパルスは pulseKey でフォース再生。
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <g
        key={pulseKey}
        style={{
          transformOrigin: 'center',
          transformBox: 'fill-box',
          // 描画完了後にブリージング、そうでなければ static (CSS animation は inert)
          animation: drawn
            ? 'mb-curve-breathe 4s var(--ease-in-out) infinite'
            : undefined,
          // ダメージパルス: 直近の pulseKey 切替で短時間だけ overlay として
          // (pulseKey で <g> 自体を再マウントするので keyframe が再生される)
        }}
      >
        {/* 描画する本体パス */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeOpacity="0.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={drawn ? dashArray : '1'}
          pathLength={drawn ? undefined : 1}
          pointerEvents="none"
          style={{
            filter: `drop-shadow(0 0 4px ${color})`,
            animation: drawn
              ? undefined
              : 'mb-curve-draw var(--dur-slow) var(--ease-out-quart) forwards',
          }}
        />
        {/* ダメージパルス: 同じパスを scale & opacity で被せる (transform/opacity のみ) */}
        {pulse && (
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeOpacity="0.55"
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
            style={{
              transformOrigin: 'center',
              transformBox: 'fill-box',
              animation: 'mb-curve-pulse 520ms var(--ease-out-quart)',
              filter: `drop-shadow(0 0 8px ${color})`,
            }}
          />
        )}
        <text
          x={labelPx + 5}
          y={Math.max(12, Math.min(FIELD_HEIGHT - 4, labelPy - 8))}
          fill={color}
          fontSize="10"
          fontWeight="bold"
          opacity="0.85"
          pointerEvents="none"
        >
          {curve.displayString}
        </text>
      </g>

      {/* タップ用の太い透明パス (描画演出後に独立配置、ヒット領域広め) */}
      {onClick && (
        <path
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="stroke"
          style={{ cursor: 'pointer' }}
          onClick={(e) => onClick(curve, e)}
        />
      )}
    </svg>
  )
}
