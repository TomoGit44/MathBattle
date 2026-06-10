/**
 * GA4 のイベント送信ヘルパー。
 * GA未設定環境では何もしない。
 *
 * 使い方:
 *   import { track } from '@/components/analytics/track'
 *   track('room_create', { method: 'random' })
 */

type GtagFn = (
  command: 'event' | 'config' | 'js',
  targetOrAction: string,
  params?: Record<string, unknown>
) => void

declare global {
  interface Window {
    gtag?: GtagFn
    dataLayer?: unknown[]
  }
}

export const track = (eventName: string, params: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') return
  try {
    window.gtag('event', eventName, params)
  } catch {
    // GAエラーはサイト動作に影響させない
  }
}

// 主要イベントのプリセット
export const trackEvent = {
  roomCreate: () => track('room_create'),
  roomJoin: () => track('room_join'),
  gameStart: () => track('game_start'),
  gameEnd: (won: boolean, turns: number) => track('game_end', { won, turns }),
  shareClick: (channel: 'twitter' | 'line' | 'copy' | 'native') =>
    track('share_click', { channel }),
  supportClick: (channel: 'bmc' | 'other') => track('support_click', { channel }),
}
