'use client'

import { useEffect, useState } from 'react'

/**
 * prefers-reduced-motion: reduce を React で監視するフック。
 *
 * SSR 安全。クライアントマウント後に matchMedia を購読し、
 * メディアクエリ変更にもリアクティブに追従する。
 *
 * 使用例:
 *   const reduce = useReducedMotion()
 *   const duration = reduce ? 0 : 600
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mql.matches)
    update()
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update)
      return () => mql.removeEventListener('change', update)
    }
    // 古い Safari 互換
    mql.addListener(update)
    return () => mql.removeListener(update)
  }, [])

  return reduced
}
