/**
 * Client-helper: "klik op betalen -> heel even wachten -> direct op iDEAL".
 *
 * Werkt met elk framework (Vite/React/Vue/Svelte/vanilla). Geen dependencies.
 *
 *   import { betaalMetIdeal } from './lib/ideal.js'
 *
 *   btn.onclick = () => betaalMetIdeal({
 *     amount: 24.95,                     // het bedrag dat je nu ook in de bunq.me link zet
 *     onStatus: (s) => { ... },          // optioneel: 'pending' | 'redirect'
 *   })
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Start de job en wacht op de iDEAL-url.
 * @returns {Promise<string>} url om naartoe te sturen
 */
export async function haalIdealLink({ amount, handle, timeoutMs = 30_000, intervalMs = 600, onStatus } = {}) {
  const jobId = crypto.randomUUID();

  const res = await fetch('/.netlify/functions/betaallink-background', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId, amount, handle }),
  });
  if (!res.ok) throw new Error(`start mislukt (${res.status})`);

  onStatus?.('pending');

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(intervalMs);
    const r = await fetch(`/.netlify/functions/betaallink-status?job=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
    if (!r.ok) continue;
    const data = await r.json().catch(() => null);
    if (data?.status === 'ready' && data.url) {
      if (data.fallback) console.warn('[ideal] worker faalde, terug naar bunq.me:', data.error);
      return data.url;
    }
  }
  throw new Error('timeout');
}

/**
 * De knop-handler: haalt de link op en navigeert.
 * Bij een fout gaat de klant gewoon naar de bunq.me-pagina (huidige gedrag),
 * zodat je nooit een verkoop verliest.
 */
export async function betaalMetIdeal({ amount, handle, fallbackUrl, timeoutMs, onStatus, onError } = {}) {
  try {
    const url = await haalIdealLink({ amount, handle, timeoutMs, onStatus });
    onStatus?.('redirect');
    window.location.href = url;
    return url;
  } catch (e) {
    onError?.(e);
    const fb = fallbackUrl
      || `https://bunq.me/${handle || 'bouwstoreov'}?amount=${amount}&paymentMethod=IDEAL`;
    onStatus?.('redirect');
    window.location.href = fb;
  }
}

/**
 * Mini-laadscherm: toont "Bezig met je betaling… 3s" en blokkeert de pagina.
 * Puur CSS/DOM, geen framework nodig.
 */
export function toonWachtScherm(tekst = 'Bezig met je betaling…') {
  const el = document.createElement('div');
  el.id = 'bunq-ideal-wacht';
  el.innerHTML = `
    <div style="position:fixed;inset:0;z-index:99999;background:rgba(255,255,255,.96);
                display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif">
      <div style="text-align:center">
        <div style="width:44px;height:44px;margin:0 auto 18px;border:4px solid #e5e7eb;border-top-color:#111;
                    border-radius:50%;animation:bunqspin .8s linear infinite"></div>
        <div data-wacht-tekst style="font-size:16px;font-weight:600;color:#111">${tekst}</div>
        <div id="bunq-ideal-sec" style="font-size:13px;color:#6b7280;margin-top:6px">0s</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:14px">Je wordt automatisch doorgestuurd naar je bank</div>
      </div>
    </div>
    <style>@keyframes bunqspin{to{transform:rotate(360deg)}}</style>`;
  document.body.appendChild(el);
  const secEl = el.querySelector('#bunq-ideal-sec');
  const tekstEl = el.querySelector('[data-wacht-tekst]');
  const t0 = Date.now();
  const timer = setInterval(() => {
    if (secEl) secEl.textContent = `${Math.round((Date.now() - t0) / 1000)}s`;
  }, 500);
  return {
    update(t) { if (tekstEl) tekstEl.textContent = t; },
    weg() { clearInterval(timer); el.remove(); },
  };
}
