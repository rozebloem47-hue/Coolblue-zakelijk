import { chromium } from 'playwright-core'

const BUNQ = /(^|\.)bunq\.(me|com)$/i

export async function resolveIdealUrl(startUrl: string, maxMs = 15000): Promise<string | null> {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) throw new Error('BROWSERLESS_TOKEN ontbreekt in Netlify')

  const region = process.env.BROWSERLESS_REGION || 'ams'
  const launch = encodeURIComponent(JSON.stringify({ headless: false, stealth: true }))
  const endpoint = `wss://production-${region}.browserless.io/chromium/playwright?token=${encodeURIComponent(token)}&launch=${launch}`

  const job = async () => {
    const browser = await chromium.connect(endpoint)
    try {
      const page = await browser.newPage({
        locale: 'nl-NL',
        timezoneId: 'Europe/Amsterdam',
        viewport: { width: 1280, height: 900 },
      })
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: maxMs })
      // bunq.me stuurt eerst naar bunq.com en pas daarna naar iDEAL: alles van bunq telt als "nog niet klaar".
      await page.waitForURL((url: URL) => !BUNQ.test(url.hostname), { timeout: maxMs, waitUntil: 'commit' })
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      return page.url()
    } finally {
      await browser.close().catch(() => {})
    }
  }

  const result = await Promise.race([
    job().catch(error => {
      console.log('[ideal] fout:', (error as Error)?.message ?? error)
      return null
    }),
    new Promise<null>(resolve => setTimeout(() => resolve(null), maxMs + 3000)),
  ])

  return result && !BUNQ.test(new URL(result).hostname) ? result : null
}