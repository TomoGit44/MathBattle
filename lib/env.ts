/**
 * 環境変数の一元管理。
 * NEXT_PUBLIC_* はクライアントに露出される。
 * 値が空文字の場合は機能無効として扱う。
 */

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  gaId: process.env.NEXT_PUBLIC_GA_ID || '',
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  adsense: {
    clientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '',
    slots: {
      lobby: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LOBBY || '',
      waiting: process.env.NEXT_PUBLIC_ADSENSE_SLOT_WAITING || '',
      result: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULT || '',
    },
  },
  bmcUrl: process.env.NEXT_PUBLIC_BMC_URL || '',
}

export const isEnabled = {
  ga: () => env.gaId.length > 0,
  sentry: () => env.sentryDsn.length > 0,
  adsense: () => env.adsense.clientId.length > 0,
  bmc: () => env.bmcUrl.length > 0,
}
