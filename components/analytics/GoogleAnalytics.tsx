import Script from 'next/script'
import { env, isEnabled } from '@/lib/env'

/**
 * Google Analytics 4 のスクリプト読み込み。
 * NEXT_PUBLIC_GA_ID が未設定なら何も出力しない (本番のみで動く)。
 *
 * gtag によるイベント送信は components/analytics/track.ts を参照。
 */
export const GoogleAnalytics = () => {
  if (!isEnabled.ga()) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${env.gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${env.gaId}', { send_page_view: true });
        `}
      </Script>
    </>
  )
}
