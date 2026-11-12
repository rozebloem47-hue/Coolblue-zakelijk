const WORKER_URL = process.env.WORKER_URL;
const WORKER_TOKEN = process.env.WORKER_TOKEN || '';
const BUNQ_HANDLE = process.env.BUNQ_HANDLE || 'bouwstoreov';
const BUDGET_MS = 25000;

function normalizeAmount(input) {
  if (typeof input === 'number') input = input.toFixed(2);
  let s = String(input ?? '').replace(/[^\d.,-]/g, '').trim();
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) throw new Error('ongeldig bedrag');
  return n.toFixed(2);
}

function bunqFallback(amount, handle = BUNQ_HANDLE) {
  return `https://bunq.me/${encodeURIComponent(handle)}?amount=${amount}&paymentMethod=IDEAL`;
}

const json = (code, obj) => ({
  statusCode: code,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(obj),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'invalid json' });
  }

  let amount;
  try {
    amount = normalizeAmount(body.amount);
  } catch (e) {
    return json(400, { ok: false, error: e.message });
  }

  const handle = String(body.handle || BUNQ_HANDLE);
  const fallback = bunqFallback(amount, handle);

  if (!WORKER_URL) return json(200, { ok: false, fallback, error: 'WORKER_URL ontbreekt' });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), BUDGET_MS);
  try {
    const r = await fetch(WORKER_URL.replace(/\/+$/, '') + '/ideal-link', {
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
    return json(200, { ok: true, url: j.url, amount, ms: j.ms });
  } catch (e) {
    const reden = e?.name === 'AbortError' ? 'worker te traag' : String(e?.message || e);
    return json(200, { ok: false, fallback, error: reden });
  } finally {
    clearTimeout(timer);
  }
};