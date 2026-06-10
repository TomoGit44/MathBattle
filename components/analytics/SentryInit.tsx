'use client'

import { useEffect } from 'react'
import { env, isEnabled } from '@/lib/env'

/**
 * Sentry の軽量初期化。
 *
 * 公式SDK (@sentry/nextjs) は便利だが、バンドルサイズが大きい (約100KB)。
 * バズ初動では「最小工数で動作監視を入れる」のが目的なので、
 * window.onerror と unhandledrejection を直接Sentryのingest APIに送る軽量版にする。
 *
 * 後から本格的に使いたくなったら以下に置き換える:
 *   npm install @sentry/nextjs
 *   npx @sentry/wizard@latest -i nextjs
 */

type SentryPayload = {
  message: string
  level: 'error' | 'warning'
  platform: 'javascript'
  timestamp: number
  exception?: {
    values: Array<{ type: string; value: string; stacktrace?: { frames: unknown[] } }>
  }
  tags?: Record<string, string>
}

const parseDsn = (dsn: string): { ingestUrl: string; publicKey: string } | null => {
  try {
    const url = new URL(dsn)
    const publicKey = url.username
    const projectId = url.pathname.replace(/^\//, '')
    if (!publicKey || !projectId) return null
    const ingestUrl = `${url.protocol}//${url.host}/api/${projectId}/store/?sentry_version=7&sentry_key=${publicKey}`
    return { ingestUrl, publicKey }
  } catch {
    return null
  }
}

const sendToSentry = (payload: SentryPayload, ingestUrl: string) => {
  try {
    // navigator.sendBeacon はページ遷移中にも送れる
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(ingestUrl, blob)
    } else {
      fetch(ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // 監視ツール由来のエラーで本体を壊さない
  }
}

export const SentryInit = () => {
  useEffect(() => {
    if (!isEnabled.sentry()) return
    const parsed = parseDsn(env.sentryDsn)
    if (!parsed) {
      console.warn('[Sentry] DSN形式が不正です')
      return
    }

    const onError = (ev: ErrorEvent) => {
      sendToSentry(
        {
          message: ev.message,
          level: 'error',
          platform: 'javascript',
          timestamp: Date.now() / 1000,
          exception: {
            values: [
              {
                type: ev.error?.name || 'Error',
                value: ev.message,
              },
            ],
          },
          tags: { source: 'window.onerror' },
        },
        parsed.ingestUrl
      )
    }

    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason
      const message =
        typeof reason === 'string'
          ? reason
          : reason?.message || String(reason)
      sendToSentry(
        {
          message,
          level: 'error',
          platform: 'javascript',
          timestamp: Date.now() / 1000,
          exception: {
            values: [{ type: 'UnhandledPromiseRejection', value: message }],
          },
          tags: { source: 'unhandledrejection' },
        },
        parsed.ingestUrl
      )
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
