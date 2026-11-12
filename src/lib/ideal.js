export async function haalIdealLink({ amount, handle, timeoutMs = 35000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/.netlify/functions/betaallink', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount, handle }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`functie gaf ${res.status}`);
    const data = await res.json();
    if (data?.ok && data.url) return data.url;
    if (data?.fallback) {
      console.warn('[ideal] worker faalde, terug naar bunq.me:', data.error);
      return data.fallback;
    }
    throw new Error(data?.error || 'geen link ontvangen');
  } finally {
    clearTimeout(timer);
  }
}

export async function betaalMetIdeal({ amount, handle, fallbackUrl, timeoutMs, onError } = {}) {
  try {
    const url = await haalIdealLink({ amount, handle, timeoutMs });
    window.location.href = url;
    return url;
  } catch (e) {
    onError?.(e);
    const fb = fallbackUrl || `https://bunq.me/${handle || 'bouwstoreov'}?amount=${amount}&paymentMethod=IDEAL`;
    window.location.href = fb;
  }
}

export function toonWachtScherm(tekst = 'Bezig met je betaling...') {
  if (typeof document === 'undefined') return { update() {}, weg() {} };
  const el = document.createElement('div');
  el.id = 'bunq-ideal-wacht';
  el.innerHTML = `
    <div style="position:fixed;inset:0;z-index:99999;background:rgba(255,255,255,.97);
                display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif">
      <div style="text-align:center;max-width:320px">
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