import Script from 'next/script'
import { env, isEnabled } from '@/lib/env'

/**
 * Google AdSense のメインスクリプトを読み込む。
 * NEXT_PUBLIC_ADSENSE_CLIENT_ID が未設定なら何も出さない。
 *
 * 個別の広告枠は <AdSlot /> コンポーネントを各画面に配置する。
 */
export const AdSenseScript = () => {
  if (!isEnabled.adsense()) return null

  return (
    <Script
      id="adsense-script"
      async
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${env.adsense.clientId}`}
      crossOrigin="anonymous"
    />
  )
}
