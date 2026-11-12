/**
 * TIJDELIJK diagnosefunctie. Open in je browser:
 *   https://JOUW-DOMEIN/.netlify/functions/betaal-debug
 *
 * Je krijgt JSON met:
 *   - of WORKER_URL / WORKER_TOKEN / BUNQ_HANDLE gevuld zijn
 *   - of Netlify de worker kan bereiken (/health)
 *   - of Netlify Blobs (de geheugenkast) werkt
 *
 * Mag daarna weer weg.
 */

import { getStore } from '@netlify/blobs';

const schoon = (u) => String(u || '').replace(/\/+$/, '');

export const handler = async () => {
  const url = schoon(process.env.WORKER_URL);
  const token = process.env.WORKER_TOKEN || '';

  const uit = {
    env: {
      WORKER_URL: url || null,
      WORKER_TOKEN_aanwezig: token.length > 0,
      WORKER_TOKEN_lengte: token.length,
      WORKER_TOKEN_eerste4: token.slice(0, 4),
      BUNQ_HANDLE: process.env.BUNQ_HANDLE ?? null,
    },
  };

  // 1) Kan Netlify de worker bereiken?
  if (!url) {
    uit.worker = 'WORKER_URL ontbreekt in Netlify';
  } else {
    try {
      const t0 = Date.now();
      const r = await fetch(url + '/health', { signal: AbortSignal.timeout(10000) });
      uit.worker = {
        status: r.status,
        body: (await r.text()).slice(0, 300),
        ms: Date.now() - t0,
      };
    } catch (e) {
      uit.worker = { fout: String(e?.message || e) };
    }
  }

  // 2) Werkt Netlify Blobs?
  try {
    const store = getStore('betaallinks');
    const sleutel = 'debug-' + Date.now();
    await store.setJSON(sleutel, { ok: true, at: Date.now() });
    const terug = await store.get(sleutel, { type: 'json' });
    uit.blobs = { werkt: !!terug?.ok };
  } catch (e) {
    uit.blobs = { werkt: false, fout: String(e?.message || e) };
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(uit, null, 2),
  };
};
