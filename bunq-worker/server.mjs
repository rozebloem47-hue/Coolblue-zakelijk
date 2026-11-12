/**
 * bunq-ideal worker
 * ------------------
 * Doel: voor een gegeven bedrag de iDEAL-betaallink van bunq.me ophalen,
 * zónder dat de klant de bunq-pagina ooit ziet.
 *
 * Waarom een browser en geen fetch?
 *   bunq.me maakt de merchant-request aan met een Google reCAPTCHA v3 token.
 *   Dat token is domein-gebonden aan bunq.me én headless Chrome wordt door
 *   reCAPTCHA afgestraft (score te laag -> "couldn't verify that you are a
 *   real human"). Daarom: een echte, headed Chrome onder Xvfb.
 *
 * Wat deze worker doet (per betaling):
 *   1. opent https://bunq.me/<handle>?amount=<x>&paymentMethod=IDEAL in Chrome
 *   2. leest uit de response van POST /v1/bunqme-merchant-request de request-uuid
 *   3. polt GET /v1/bunqme-merchant-request/<uuid> (pure HTTP, snel)
 *   4. geeft de iDEAL-url terug zodra bunq/Adyen hem heeft aangemaakt
 *   Bij een captcha-afwijzing (400/429) → automatisch opnieuw proberen.
 *
 * Starten (Linux/VPS):   xvfb-run -a node server.mjs
 * Lokaal (Windows/mac):  node server.mjs      (Chrome opent zichtbaar, dat mag)
 */

import http from 'node:http';
import { chromium } from 'playwright';

/* ------------------------------- config ---------------------------------- */

const PORT           = Number(process.env.PORT || 8787);
const TOKEN          = process.env.WORKER_TOKEN || '';           // gedeeld geheim met Netlify
const BUNQ_HANDLE    = process.env.BUNQ_HANDLE || 'bouwstoreov'; // jouw bunq.me naam
const HEADLESS       = process.env.HEADLESS === '1';              // LET OP: headless = vaak captcha-fail
const NO_SANDBOX     = process.env.NO_SANDBOX === '1';            // nodig in Docker/Railway (root)
const MAX_ATTEMPTS   = Number(process.env.MAX_ATTEMPTS || 4);     // captcha-pogingen per betaling
const POLL_TIMEOUT   = Number(process.env.POLL_TIMEOUT_MS || 20000);
const CACHE_TTL      = Number(process.env.CACHE_TTL_MS || 45000); // dubbelklik-bescherming
const RESOLVE_FINAL  = process.env.RESOLVE_FINAL !== '0';         // Adyen-url doorvertalen naar pay.ideal.nl

const API            = 'https://api.bunq.me';
const CLIENT_VERSION = 'BUNQ_ME:PRODUCTION:202610280851';

/* -------------------------------- utils ---------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);

const apiHeaders = () => ({
  'x-bunq-client-version': CLIENT_VERSION,
  'x-bunq-language': 'en_US',
  'x-bunq-client-request-id': crypto.randomUUID(),
  accept: 'application/json',
});

/** Bedrag normaliseren: 24.9 / "24,90" / "€ 24,90" -> "24.90" */
function normalizeAmount(input) {
  if (typeof input === 'number') input = input.toFixed(2);
  let s = String(input ?? '').replace(/[^\d.,-]/g, '').trim();
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`ongeldig bedrag: ${input}`);
  return n.toFixed(2);
}

/* ------------------------------- browser --------------------------------- */

let browser = null;   // warme Chrome instantie
let context = null;
let browserVersion = null;

async function ensureBrowser() {
  if (browser?.isConnected()) return context;
  log('Chrome starten…');
  browser = await chromium.launch({
    headless: HEADLESS,
    // Deze twee zijn essentieel: zonder deze flags ziet reCAPTCHA automation.
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      ...(NO_SANDBOX ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
    ],
  });
  browserVersion = browser.version();
  context = await browser.newContext({
    locale: 'nl-NL',
    timezoneId: 'Europe/Amsterdam',
    viewport: { width: 1366, height: 900 },
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  log(`Chrome klaar (${browserVersion})`);
  return context;
}

/* --------------------------- de kern: één poging ------------------------- */

async function attempt(ctx, amount, handle) {
  const page = await ctx.newPage();
  let postStatus = null;
  let uuid = null;
  let captchaError = null;

  const onResponse = async (res) => {
    // let op: exact matchen, '-top-up-method-configuration' bevat dezelfde prefix
    let path = '';
    try { path = new URL(res.url()).pathname; } catch { return; }
    if (path !== '/v1/bunqme-merchant-request') return;
    if (res.request().method() !== 'POST') return;
    postStatus = res.status();
    try {
      const j = await res.json();
      uuid = j?.Response?.[0]?.BunqMeMerchantRequest?.uuid ?? uuid;
      captchaError = j?.Error?.[0]?.error_description ?? null;
    } catch { /* body al opgegeten */ }
  };
  page.on('response', onResponse);

  // Afbeeldingen/fonts/media blokkeren: flink sneller, fingerprint blijft ok.
  await page.route('**/*', (route) => {
    const t = route.request().resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return route.abort().catch(() => {});
    return route.continue().catch(() => {});
  });

  try {
    const url = `https://bunq.me/${encodeURIComponent(handle)}?amount=${amount}&paymentMethod=IDEAL`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // wachten tot bunq de merchant-request aanmaakt (incl. captcha-uitkomst)
    for (let i = 0; i < 40 && postStatus === null; i++) await page.waitForTimeout(150);

    if (postStatus !== 200) {
      return { ok: false, reason: captchaError || `HTTP ${postStatus}`, uuid };
    }
    if (!uuid) return { ok: false, reason: 'geen request-uuid ontvangen' };

    // Vanaf hier geen browser meer nodig: pollen via platte HTTP.
    const deadline = Date.now() + POLL_TIMEOUT;
    let lastStatus = null;
    while (Date.now() < deadline) {
      // is de pagina zelf al doorgesprongen? dan zijn we klaar
      const cur = page.url();
      if (!cur.includes('bunq.me')) return { ok: true, url: cur, source: 'navigatie', uuid };

      const r = await fetch(`${API}/v1/bunqme-merchant-request/${uuid}`, { headers: apiHeaders() });
      const j = await r.json().catch(() => null);
      const m = j?.Response?.[0]?.BunqMeMerchantRequest;
      lastStatus = m?.status ?? lastStatus;

      // issuer_authentication_url = de kale iDEAL-url (als bunq die al zet)
      if (m?.issuer_authentication_url) {
        return { ok: true, url: m.issuer_authentication_url, source: 'issuer_authentication_url', uuid };
      }
      // adyen_checkout_payment_action.url = redirect die naar pay.ideal.nl gaat
      if (m?.adyen_checkout_payment_action?.url) {
        return { ok: true, url: m.adyen_checkout_payment_action.url, source: 'adyen', uuid };
      }
      await sleep(350);
    }
    return { ok: false, reason: `timeout (status ${lastStatus})`, uuid };
  } finally {
    page.off('response', onResponse);
    await page.close().catch(() => {});
  }
}

/* ------------------- Adyen-redirect doorvertalen naar iDEAL -------------- */

async function resolveFinal(url) {
  if (!RESOLVE_FINAL) return url;
  try {
    const r = await fetch(url, { redirect: 'manual' });
    const loc = r.headers.get('location');
    if (loc && loc.includes('ideal')) return loc;
  } catch { /* niet erg, klant volgt de redirect zelf */ }
  return url;
}

/* ------------------------------ publieke API ---------------------------- */

const cache = new Map(); // `${handle}|${amount}` -> { url, at }

async function idealLink(amountRaw, handle = BUNQ_HANDLE) {
  const amount = normalizeAmount(amountRaw);
  const key = `${handle}|${amount}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return { url: hit.url, amount, cached: true, attempts: hit.attempts, ms: 0 };
  }

  const t0 = Date.now();
  const ctx = await ensureBrowser();

  let last = null;
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      const res = await attempt(ctx, amount, handle);
      if (res.ok) {
        const finalUrl = await resolveFinal(res.url);
        const out = { url: finalUrl, amount, attempts: i, ms: Date.now() - t0, source: res.source, uuid: res.uuid };
        cache.set(key, { url: finalUrl, at: Date.now(), attempts: i });
        log(`OK €${amount} in ${out.ms}ms (poging ${i}, ${res.source})`);
        return out;
      }
      last = res;
      log(`poging ${i} mislukt: ${res.reason}`);
      if (/timeout|uuid/i.test(res.reason || '')) break; // geen captcha-probleem -> niet blijven hameren
      await sleep(400);
    } catch (e) {
      last = { reason: e.message };
      log(`poging ${i} error: ${e.message}`);
      // browser kan gecrasht zijn
      if (!browser?.isConnected()) { browser = null; context = null; await ensureBrowser(); }
    }
  }
  const err = new Error(`geen iDEAL-link: ${last?.reason || 'onbekend'}`);
  err.status = 502;
  throw err;
}

/* -------------------------------- server -------------------------------- */

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/health') {
    return json(res, 200, { ok: true, chrome: browserVersion, connected: !!browser?.isConnected() });
  }

  if (TOKEN && req.headers['x-worker-token'] !== TOKEN) {
    return json(res, 401, { ok: false, error: 'unauthorized' });
  }

  if (url.pathname === '/warm') {
    try { await ensureBrowser(); return json(res, 200, { ok: true }); }
    catch (e) { return json(res, 500, { ok: false, error: e.message }); }
  }

  if (url.pathname === '/ideal-link' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { return json(res, 400, { ok: false, error: 'invalid json' }); }
    try {
      const out = await idealLink(body.amount, body.handle || BUNQ_HANDLE);
      return json(res, 200, { ok: true, ...out });
    } catch (e) {
      return json(res, e.status || 500, { ok: false, error: e.message });
    }
  }

  json(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => log(`worker luistert op :${PORT} (handle=${BUNQ_HANDLE}, headless=${HEADLESS})`));

// browser warm houden
setInterval(() => { ensureBrowser().catch(() => {}); }, 60_000);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { await browser?.close().catch(() => {}); process.exit(0); });
}
