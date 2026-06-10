'use client'

import { useState } from 'react'
import { env } from '@/lib/env'
import { trackEvent } from '@/components/analytics/track'

interface ShareButtonsProps {
  /** シェアする本文(ハッシュタグ込みでOK) */
  text?: string
  /** シェアURL。省略時はサイトURL */
  url?: string
  /** レイアウト */
  layout?: 'row' | 'col'
}

const DEFAULT_TEXT = '数字を弾として撃ち合う対戦ゲーム「Math Battle」で遊ぼう! #MathBattle'

/**
 * シェアボタン群。Twitter / LINE / URLコピー / Web Share API(モバイル) を提供。
 *
 * 使い方:
 *   <ShareButtons text="○○に勝った!" url={`${siteUrl}/?ref=result`} />
 */
export const ShareButtons = ({
  text = DEFAULT_TEXT,
  url,
  layout = 'row',
}: ShareButtonsProps) => {
  const [copied, setCopied] = useState(false)
  const shareUrl = url || env.siteUrl
  const encodedText = encodeURIComponent(text)
  const encodedUrl = encodeURIComponent(shareUrl)

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedText}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${shareUrl}`)
      setCopied(true)
      trackEvent.shareClick('copy')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボード拒否環境ではフォールバックなし
    }
  }

  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return
    try {
      await navigator.share({ title: 'Math Battle', text, url: shareUrl })
      trackEvent.shareClick('native')
    } catch {
      // ユーザーキャンセル等
    }
  }

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const containerClass =
    layout === 'col' ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2 items-center'

  const btn =
    'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150'

  return (
    <div className={containerClass}>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent.shareClick('twitter')}
        className={`${btn} bg-sky-600 hover:bg-sky-500 text-white`}
        aria-label="Twitterでシェア"
      >
        <span aria-hidden="true">𝕏</span>
        <span>Xでシェア</span>
      </a>

      <a
        href={lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent.shareClick('line')}
        className={`${btn} bg-green-600 hover:bg-green-500 text-white`}
        aria-label="LINEでシェア"
      >
        <span>LINE</span>
      </a>

      <button
        type="button"
        onClick={handleCopy}
        className={`${btn} bg-bg-mid border border-line hover:border-p1 text-text`}
        aria-label="リンクをコピー"
      >
        {copied ? '✓ コピー済み' : '🔗 URLコピー'}
      </button>

      {canNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          className={`${btn} bg-bg-mid border border-line hover:border-p1 text-text`}
          aria-label="共有メニュー"
        >
          ⇗ 共有
        </button>
      )}
    </div>
  )
}
