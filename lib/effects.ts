/*
 * lib/effects.ts — ビジュアルエフェクト用のシングルトンストア
 *
 * ゲームロジック層 (game-logic / physics / calc-engine / func-engine / server)
 * からは独立した、純粋に演出のための副作用ハブ。
 *
 * P1 以降で実装される shake / hitstop / flash 等の API はここで管理する。
 * 本ファイルは P0 段階の雛形:
 *   - シングルトンストア (subscribe/getSnapshot)
 *   - shake / hitstop / flash の minimum viable API
 *   - prefers-reduced-motion 対応 (reduced 時は no-op もしくは duration=0)
 *   - すべて transform / opacity ベースで GPU レイヤを離脱しない
 */

export type EffectStore = {
  /** 現フレームのシェイク振幅 (px)。ScreenShake 等が transform: translate に反映 */
  shakeIntensity: number
  /** ヒットストップ解除時刻 (performance.now() ベース)。0 なら停止していない */
  hitstopUntil: number
  /** 全画面フラッシュ色 (CSS string)。null ならフラッシュなし */
  flashColor: string | null
  /** フラッシュ解除時刻 (performance.now() ベース) */
  flashUntil: number
}

// --- internal state ---
const state: EffectStore = {
  shakeIntensity: 0,
  hitstopUntil: 0,
  flashColor: null,
  flashUntil: 0,
}

const listeners = new Set<() => void>()
const emit = () => {
  for (const cb of listeners) cb()
}

// --- prefers-reduced-motion 検出 (lazy / SSR safe) ---
const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// --- public API ---

/** 現在のスナップショットを取得 (useSyncExternalStore 用) */
export const getEffectSnapshot = (): EffectStore => state

/** 変更通知を購読 (useSyncExternalStore 用) */
export const subscribeEffects = (cb: () => void): (() => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * スクリーンシェイクを発生させる。
 * @param intensity 振幅 (px)。reduced-motion 時は 0 に強制
 * @param durationMs 振幅が 0 に減衰するまでの時間
 */
export const shake = (intensity: number, durationMs: number): void => {
  if (prefersReducedMotion() || intensity <= 0 || durationMs <= 0) return
  state.shakeIntensity = Math.max(state.shakeIntensity, intensity)
  emit()

  const start = performance.now()
  const initial = intensity

  const tick = () => {
    const elapsed = performance.now() - start
    const progress = elapsed / durationMs
    if (progress >= 1) {
      // 他のシェイク呼び出しが上書きしていなければ 0 に戻す
      if (state.shakeIntensity <= initial + 0.01) {
        state.shakeIntensity = 0
        emit()
      }
      return
    }
    // ease-out 減衰
    const remaining = initial * (1 - progress) * (1 - progress)
    if (remaining < state.shakeIntensity) {
      state.shakeIntensity = remaining
      emit()
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/**
 * ヒットストップ (短時間アニメーション停止) を発生させる。
 * @param durationMs 停止時間。reduced-motion 時は 0
 */
export const hitstop = (durationMs: number): void => {
  if (prefersReducedMotion() || durationMs <= 0) return
  state.hitstopUntil = Math.max(state.hitstopUntil, performance.now() + durationMs)
  emit()

  const tick = () => {
    if (performance.now() >= state.hitstopUntil) {
      // 他の呼び出しが延長していないか確認
      if (state.hitstopUntil <= performance.now() + 1) {
        state.hitstopUntil = 0
        emit()
      } else {
        requestAnimationFrame(tick)
      }
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/**
 * 現在ヒットストップ中かどうか。
 * 弾物理リプレイなどがフレームを進めるか判断する用。
 */
export const isHitStopped = (): boolean => {
  return state.hitstopUntil > performance.now()
}

/**
 * 全画面フラッシュを発生させる。
 * @param color CSS 色文字列
 * @param durationMs フラッシュ持続時間。reduced-motion 時は no-op
 */
export const flash = (color: string, durationMs: number): void => {
  if (prefersReducedMotion() || durationMs <= 0) return
  state.flashColor = color
  state.flashUntil = performance.now() + durationMs
  emit()

  const tick = () => {
    if (performance.now() >= state.flashUntil) {
      state.flashColor = null
      state.flashUntil = 0
      emit()
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/** すべての演出をリセット (画面遷移時等に呼ぶ) */
export const resetEffects = (): void => {
  state.shakeIntensity = 0
  state.hitstopUntil = 0
  state.flashColor = null
  state.flashUntil = 0
  emit()
}
