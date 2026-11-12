import type { Config } from '@netlify/functions'
import { resolveIdealUrl } from '../shared/ideal.js'

export default async (req: Request) => {
  const target = new URL(req.url).searchParams.get('u')
  if (!target) return Response.json({ ok: false, error: 'Geen ?u= meegegeven' }, { status: 400 })
  try {
    const url = await resolveIdealUrl(target)
    if (!url) return Response.json({ ok: false, error: 'bunq bleef hangen, geen iDEAL-link gevonden' }, { status: 502 })
    return Response.json({ ok: true, url })
  } catch (error) {
    return Response.json({ ok: false, error: String((error as Error)?.message ?? error) }, { status: 500 })
  }
}

export const config: Config = { path: '/api/ideal' }