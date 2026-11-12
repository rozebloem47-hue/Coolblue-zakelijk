/**
 * Netlify background function: haalt de iDEAL-link op via de worker.
 * Bestandsnaam eindigt op "-background" -> Netlify antwoordt direct met 202
 * en laat de functie daarna doorlopen (tot 15 min). De klant pollt ondertussen
 * betaallink-status.mjs. Zo zit je nooit vast aan de 10s/26s limiet.
 *
 * POST body: { jobId: string, amount: number|string, handle?: string }
 */

import { getStore } from '@netlify/blobs';

const WORKER_URL   = process.env.WORKER_URL;            // bv. https://bunq-worker.jouwdomein.nl
const WORKER_TOKEN = process.env.WORKER_TOKEN || '';    // zelfde geheim als in de worker
const STORE_NAME   = 'betaallinks';
const WORKER_TIMEOUT_MS = 30_000;

const store = () => getStore(STORE_NAME);

function normalizeAmount(input) {
  if (typeof input === 'number') input = input.toFixed(2);
  let s = String(input ?? '').replace(/[^\d.,-]/g, '').trim();
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 10_000) throw new Error('ongeldig bedrag');
  return n.toFixed(2);
}

/** De bunq.me link die de klant nu al te zien krijgt: altijd als vangnet. */
function fallbackUrl(amount, handle = process.env.BUNQ_HANDLE || 'bouwstoreov') {
  return `https://bunq.me/${encodeURIComponent(handle)}?amount=${amount}&paymentMethod=IDEAL`;
}

async function haalIdealLink(amount, handle) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WORKER_TIMEOUT_MS);
  try {
    const r = await fetch(`${WORKER_URL.replace(/\/$/, '')}/ideal-link`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(WORKER_TOKEN ? { 'x-worker-token': WORKER_TOKEN } : {}),
      },
      body: JSON.stringify({ amount, handle }),
      signal: ac.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok || !j.url) throw new Error(j.error || `worker HTTP ${r.status}`);
    return j.url;
  } finally {
    clearTimeout(timer);
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid json' }) }; }

  const jobId = String(body.jobId || '').slice(0, 64);
  if (!jobId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'jobId ontbreekt' }) };

  let amount;
  try { amount = normalizeAmount(body.amount); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ ok: false, error: e.message }) }; }

  const handle = String(body.handle || process.env.BUNQ_HANDLE || 'bouwstoreov');
  const db = store();

  // meteen "pending" wegzetten, zodat de poller iets te lezen heeft
  await db.setJSON(jobId, { status: 'pending', amount, at: Date.now() });

  try {
    const url = await haalIdealLink(amount, handle);
    await db.setJSON(jobId, { status: 'ready', url, amount, at: Date.now() });
  } catch (e) {
    // Geen ramp: de klant gaat dan gewoon naar bunq.me, zoals nu.
    await db.setJSON(jobId, {
      status: 'ready',
      url: fallbackUrl(amount, handle),
      fallback: true,
      error: e.message,
      amount,
      at: Date.now(),
    });
  }

  return { statusCode: 202, body: JSON.stringify({ ok: true, jobId }) };
};
