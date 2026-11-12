/**
 * ALTERNATIEF (simpler, geen polling): synchrone variant.
 * POST /.netlify/functions/betaallink  { amount }
 *   -> { ok: true, url: "https://pay.ideal.nl/..." }
 *
 * Let op: Netlify's standaard functie-timeout is 10s (max 26s, in te stellen in
 * de Netlify UI). De worker doet er warm 5-9s over, koud ~10s. Gebruik dus
 * bij voorkeur de background-variant (betaallink-background + betaallink-status)
 * en dit bestand alleen als je de timeout op 26s hebt gezet.
 */

const WORKER_URL   = process.env.WORKER_URL;
const WORKER_TOKEN = process.env.WORKER_TOKEN || '';
const WORKER_TIMEOUT_MS = 24_000;

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

const json = (code, obj) => ({
  statusCode: code,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(obj),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'invalid json' }); }

  let amount;
  try { amount = normalizeAmount(body.amount); } catch (e) { return json(400, { ok: false, error: e.message }); }

  const handle = String(body.handle || process.env.BUNQ_HANDLE || 'bouwstoreov');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WORKER_TIMEOUT_MS);
  try {
    const r = await fetch(`${WORKER_URL.replace(/\/$/, '')}/ideal-link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(WORKER_TOKEN ? { 'x-worker-token': WORKER_TOKEN } : {}) },
      body: JSON.stringify({ amount, handle }),
      signal: ac.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok || !j.url) throw new Error(j.error || `worker HTTP ${r.status}`);
    return json(200, { ok: true, url: j.url, amount, ms: j.ms });
  } catch (e) {
    return json(200, {
      ok: false,
      error: e.message,
      fallback: `https://bunq.me/${encodeURIComponent(handle)}?amount=${amount}&paymentMethod=IDEAL`,
    });
  } finally {
    clearTimeout(timer);
  }
};
