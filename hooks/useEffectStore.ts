'use client'

import { useSyncExternalStore } from 'react'
import {
  getEffectSnapshot,
  subscribeEffects,
  type EffectStore,
} from '@/lib/effects'

/**
 * lib/effects.ts のシングルトンストアを React で購読するフック。
 * SSR 安全: サーバー側ではデフォルトのスナップショットを返す。
 *
 * セレクタを渡すと、戻り値の参照安定性を保つ (例: shakeIntensity だけ取り出す)。
 */
export function useEffectStore(): EffectStore
export function useEffectStore<T>(selector: (s: EffectStore) => T): T
export function useEffectStore<T>(
  selector?: (s: EffectStore) => T,
): T | EffectStore {
  return useSyncExternalStore(
    subscribeEffects,
    () => (selector ? selector(getEffectSnapshot()) : getEffectSnapshot()),
    () => {
      // SSR フォールバック (副作用ゼロの初期値)
      const initial: EffectStore = {
        shakeIntensity: 0,
        hitstopUntil: 0,
        flashColor: null,
        flashUntil: 0,
      }
      return selector ? selector(initial) : initial
    },
  )
}
