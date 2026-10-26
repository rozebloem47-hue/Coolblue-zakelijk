import {
  createHash,
  createSign,
  generateKeyPairSync,
  randomUUID,
} from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getStore } from '@netlify/blobs'
import { db } from '../../db/index.js'
import { bunqContext } from '../../db/schema.js'

/**
 * De koppeling met bunq. Bij elke bestelling maken we een bunq.me-link met het
 * bedrag van de bestelling en het ordernummer als beschrijving.
 *
 * bunq wil daarvoor drie dingen die we niet per bestelling opnieuw willen doen:
 * een installatie met een eigen RSA-sleutelpaar, een geregistreerd apparaat en
 * een sessie. Die bewaren we in de tabel bunq_context (één rij, id = 1) en
 * hergebruiken we zolang ze geldig zijn. Verloopt de sessie, dan maken we bij
 * de eerstvolgende bestelling automatisch een nieuwe.
 *
 * De API-sleutel komt uit BUNQ_API_KEY of, als die ontbreekt, uit Netlify Blobs
 * (ingevuld in het beheer). In de database staan alleen een afdruk en de
 * laatste vier tekens.
 */

const BASE_URL = 'https://api.bunq.com/v1'
const USER_AGENT = 'VoltVoorraad-webshop/1.0'
const DEVICE_DESCRIPTION = 'VoltVoorraad webshop'
/** Zonder opgave van bunq gaan we uit van een uur sessieduur. */
const FALLBACK_SESSION_SECONDS = 3600
/**
 * Bij één API-sleutel horen vaak meerdere rekeningen. Met BUNQ_ACCOUNT_IBAN
 * (een volledig IBAN of alleen het begin ervan) kies je de rekening waarop de
 * betaallinks komen; zonder die variabele nemen we de eerste betaalrekening.
 */
const configuredIban = () => normalizeIban(process.env.BUNQ_ACCOUNT_IBAN ?? '')

/** Spaties en kleine letters weg, zodat 'nl39 bunq …' net zo goed matcht. */
function normalizeIban(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

type ContextRow = typeof bunqContext.$inferSelect
type ContextPatch = Partial<typeof bunqContext.$inferInsert>

/** Een fout van de API van bunq. Bevat nooit de API-sleutel. */
class BunqApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'BunqApiError'
  }
}

/** De beheerder heeft nog geen API-sleutel ingesteld. */
export class BunqNotConfiguredError extends Error {
  constructor() {
    super('Er is nog geen bunq API-sleutel ingesteld.')
    this.name = 'BunqNotConfiguredError'
  }
}

/* ------------------------------------------------------------------ */
/* De bewaarde koppeling                                               */
/* ------------------------------------------------------------------ */

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

const STORE = 'integrations'
const KEY = 'bunq-api-key'
const store = () => getStore({ name: STORE, consistency: 'strong' })

/** De sleutel uit de omgeving heeft altijd voorrang op die uit het beheer. */
function apiKeyFromEnv() {
  return (process.env.BUNQ_API_KEY ?? '').trim()
}

async function apiKeyFromAdmin() {
  const stored = await store()
    .get(KEY, { type: 'text' })
    .catch(() => null)
  return (stored ?? '').trim()
}

/** Een nieuwe lokale identiteit voor een volledig verse bunq-installatie. */
function generateClientKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  return { privateKeyPem: privateKey, publicKeyPem: publicKey }
}

async function readContext(): Promise<ContextRow> {
  const [existing] = await db
    .select()
    .from(bunqContext)
    .where(eq(bunqContext.id, 1))
  if (existing) return existing

  // Eerste keer: een eigen sleutelpaar waarmee we onze verzoeken ondertekenen.
  await db
    .insert(bunqContext)
    .values({ id: 1, ...generateClientKeyPair() })
    .onConflictDoNothing()

  const [created] = await db
    .select()
    .from(bunqContext)
    .where(eq(bunqContext.id, 1))
  if (!created) throw new Error('De bunq-koppeling kon niet worden opgeslagen.')
  return created
}

/** Schrijft de wijziging weg én werkt de rij in het geheugen bij. */
async function save(row: ContextRow, patch: ContextPatch) {
  await db
    .update(bunqContext)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(bunqContext.id, 1))
  Object.assign(row, patch)
}

/** Alles wat aan een installatie hangt vergeten, zodat de koppeling opnieuw begint. */
const FORGET_HANDSHAKE: ContextPatch = {
  installationToken: '',
  serverPublicKeyPem: '',
  deviceRegistered: false,
  sessionToken: '',
  sessionExpiresAt: null,
  bunqUserId: null,
  monetaryAccountId: null,
  monetaryAccountIban: '',
}

/**
 * Een API-sleutel hoort bij een eigen bunq-installatie. Daarom vervangen we
 * bij sleutelrotatie ook het RSA-sleutelpaar en niet alleen de tijdelijke
 * tokens; zo kan geen onderdeel van de oude koppeling blijven doorwerken.
 */
async function resetConnection(row: ContextRow, patch: ContextPatch = {}) {
  await save(row, { ...FORGET_HANDSHAKE, ...generateClientKeyPair(), ...patch })
}

/* ------------------------------------------------------------------ */
/* Verzoeken aan bunq                                                  */
/* ------------------------------------------------------------------ */

type BunqEntry = Record<string, any>

/** Haalt het object met deze naam uit de Response-array van bunq. */
function pick<T = any>(entries: Array<BunqEntry>, key: string): T | undefined {
  for (const entry of entries) {
    if (entry && typeof entry === 'object' && key in entry) {
      return entry[key] as T
    }
  }
  return undefined
}

/** bunq verpakt elk item in een object met de soort als enige sleutel. */
function unwrap(entry: BunqEntry) {
  const key = Object.keys(entry ?? {})[0]
  return key ? { type: key, value: entry[key] as BunqEntry } : null
}

function describeError(status: number, text: string) {
  try {
    const parsed = JSON.parse(text)
    const first = parsed?.Error?.[0]?.error_description
    if (typeof first === 'string' && first) return first
  } catch {
    // Geen JSON — dan is de status het enige dat we weten.
  }
  return `bunq antwoordde met status ${status}.`
}

async function call(options: {
  path: string
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  token?: string
  /** Aanwezig: dan ondertekenen we de body met onze private sleutel. */
  privateKeyPem?: string
}): Promise<Array<BunqEntry>> {
  const method = options.method ?? 'GET'
  const payload = options.body === undefined ? '' : JSON.stringify(options.body)

  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache',
    'User-Agent': USER_AGENT,
    'X-Bunq-Language': 'nl_NL',
    'X-Bunq-Region': 'nl_NL',
    'X-Bunq-Geolocation': '0 0 0 0 000',
    'X-Bunq-Client-Request-Id': randomUUID(),
  }
  if (payload) headers['Content-Type'] = 'application/json'
  if (options.token) headers['X-Bunq-Client-Authentication'] = options.token
  // bunq wil precies de verzonden body ondertekend zien — geen headers, geen URL.
  if (payload && options.privateKeyPem) {
    headers['X-Bunq-Client-Signature'] = createSign('sha256')
      .update(payload)
      .sign(options.privateKeyPem, 'base64')
  }

  const response = await fetch(`${BASE_URL}${options.path}`, {
    method,
    headers,
    body: payload || undefined,
  })
  const text = await response.text()
  if (!response.ok) {
    throw new BunqApiError(response.status, describeError(response.status, text))
  }

  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed?.Response) ? parsed.Response : []
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* De drie stappen van de koppeling                                    */
/* ------------------------------------------------------------------ */

async function createInstallation(row: ContextRow) {
  const entries = await call({
    path: '/installation',
    method: 'POST',
    body: { client_public_key: row.publicKeyPem },
  })
  const token = pick<{ token?: string }>(entries, 'Token')?.token
  const serverKey = pick<{ server_public_key?: string }>(
    entries,
    'ServerPublicKey',
  )?.server_public_key
  if (!token) throw new Error('bunq gaf geen installatietoken terug.')

  await save(row, {
    ...FORGET_HANDSHAKE,
    installationToken: token,
    serverPublicKeyPem: serverKey ?? '',
  })
}

async function registerDevice(row: ContextRow, apiKey: string) {
  const body = {
    description: DEVICE_DESCRIPTION,
    secret: apiKey,
    /**
     * Netlify Functions hebben geen vast IP-adres, dus moet de sleutel vanaf
     * elk adres mogen werken. Staat dat niet toe, dan binden we hem alsnog aan
     * het adres van deze aanvraag.
     */
    permitted_ips: ['*'],
  }
  try {
    await call({
      path: '/device-server',
      method: 'POST',
      body,
      token: row.installationToken,
      privateKeyPem: row.privateKeyPem,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    // Een al geregistreerd apparaat is geen probleem: de sessie werkt gewoon.
    if (/already|bestaat|registered/i.test(message)) {
      await save(row, { deviceRegistered: true })
      return
    }
    await call({
      path: '/device-server',
      method: 'POST',
      body: { description: DEVICE_DESCRIPTION, secret: apiKey },
      token: row.installationToken,
      privateKeyPem: row.privateKeyPem,
    })
  }
  await save(row, { deviceRegistered: true })
}

async function createSession(row: ContextRow, apiKey: string) {
  const entries = await call({
    path: '/session-server',
    method: 'POST',
    body: { secret: apiKey },
    token: row.installationToken,
    privateKeyPem: row.privateKeyPem,
  })
  const token = pick<{ token?: string }>(entries, 'Token')?.token
  if (!token) throw new Error('bunq gaf geen sessietoken terug.')

  // Welk gebruikersnummer bij de sleutel hoort vragen we apart op in plaats van
  // het uit de sessie te vissen: dat antwoord heeft per soort gebruiker een
  // andere vorm (UserPerson, UserCompany, UserApiKey).
  const users = await call({ path: '/user', token })
  const user = users.map(unwrap).find((entry) => entry?.value?.id)
  const userId = Number(user?.value?.id)
  if (!Number.isFinite(userId)) {
    throw new Error('bunq gaf geen gebruiker terug voor deze API-sleutel.')
  }

  const timeout = Number(user?.value?.session_timeout)
  const seconds =
    Number.isFinite(timeout) && timeout > 60 ? timeout : FALLBACK_SESSION_SECONDS
  // Een minuut marge, zodat we niet net tijdens een bestelling verlopen.
  const expiresAt = new Date(Date.now() + (seconds - 60) * 1000)

  await save(row, {
    sessionToken: token,
    sessionExpiresAt: expiresAt,
    bunqUserId: userId,
    monetaryAccountId: null,
    monetaryAccountIban: '',
  })
}

async function findMonetaryAccount(row: ContextRow) {
  const entries = await call({
    path: `/user/${row.bunqUserId}/monetary-account`,
    token: row.sessionToken,
  })

  const accounts = entries
    .map(unwrap)
    .filter((entry): entry is { type: string; value: BunqEntry } =>
      Boolean(entry?.value?.id),
    )

  // Alleen actieve euro-rekeningen, en een betaalrekening gaat voor de rest.
  const usable = accounts.filter(
    (entry) =>
      String(entry.value.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE' &&
      String(entry.value.currency ?? 'EUR').toUpperCase() === 'EUR',
  )

  // Is er een IBAN opgegeven, dan innen we liever niets dan op de verkeerde
  // rekening: de beheerder ziet de reden bij de bunq-koppeling.
  const wanted = configuredIban()
  const matches = wanted
    ? usable.filter((entry) =>
        ibansOf(entry.value).some((iban) => iban.startsWith(wanted)),
      )
    : usable
  const chosen =
    matches.find((entry) => entry.type === 'MonetaryAccountBank') ??
    matches.find((entry) => entry.type === 'MonetaryAccountJoint') ??
    matches[0] ??
    (wanted ? undefined : accounts[0])
  if (!chosen) {
    if (!wanted) throw new Error('Er is geen bunq-rekening gevonden.')
    const available = usable.map((entry) => describeAccount(entry.value)).join(', ')
    throw new Error(
      `Geen bunq-rekening gevonden met IBAN ${wanted}…. Beschikbaar: ${available || 'geen actieve euro-rekening'}.`,
    )
  }

  const ibans = ibansOf(chosen.value)
  // Hangen er meer IBAN's aan één rekening, dan tonen we het gevraagde.
  const iban = ibans.find((value) => value.startsWith(wanted)) ?? ibans[0] ?? ''

  await save(row, {
    monetaryAccountId: Number(chosen.value.id),
    monetaryAccountIban: iban,
  })
}

/** Alle IBAN's van een rekening; bunq hangt er soms meer dan één aan. */
function ibansOf(account: BunqEntry): Array<string> {
  if (!Array.isArray(account.alias)) return []
  return account.alias
    .filter((alias: BunqEntry) => alias?.type === 'IBAN' && alias.value)
    .map((alias: BunqEntry) => normalizeIban(String(alias.value)))
}

/** Naam en begin van het IBAN, zodat de beheerder de rekening herkent. */
function describeAccount(account: BunqEntry) {
  const name = String(account.description ?? '').trim() || 'naamloos'
  const iban = ibansOf(account)[0]
  return iban ? `${name} (${iban.slice(0, 8)}…)` : `${name} (zonder IBAN)`
}

/** Zorgt dat installatie, apparaat, sessie en rekening klaarstaan. */
async function ensureSession(): Promise<ContextRow> {
  const row = await readContext()
  const apiKey = apiKeyFromEnv() || (await apiKeyFromAdmin())
  if (!apiKey) throw new BunqNotConfiguredError()

  // Een andere sleutel betekent een andere koppeling: opnieuw beginnen.
  const hash = sha256(apiKey)
  if (row.apiKeyHash !== hash) {
    await resetConnection(row, { apiKeyHash: hash, lastError: '' })
  }

  if (!row.installationToken) await createInstallation(row)
  if (!row.deviceRegistered) await registerDevice(row, apiKey)

  const expired =
    !row.sessionExpiresAt || row.sessionExpiresAt.getTime() < Date.now()
  if (!row.sessionToken || expired) await createSession(row, apiKey)
  // Een eerder gekozen rekening houden we alleen als hij nog bij het gewenste
  // IBAN hoort, zodat een gewijzigde BUNQ_ACCOUNT_IBAN vanzelf meeverhuist.
  const accountMatches =
    Boolean(row.monetaryAccountId) &&
    normalizeIban(row.monetaryAccountIban).startsWith(configuredIban())
  if (!accountMatches) await findMonetaryAccount(row)

  return row
}

/* ------------------------------------------------------------------ */
/* bunq.me-link                                                        */
/* ------------------------------------------------------------------ */

/** Centen naar het formaat dat bunq verwacht: "129.95". */
function formatAmount(cents: number) {
  return (Math.round(cents) / 100).toFixed(2)
}

async function requestPaymentLink(
  row: ContextRow,
  input: { amountCents: number; description: string; redirectUrl: string },
) {
  const path = `/user/${row.bunqUserId}/monetary-account/${row.monetaryAccountId}/bunqme-tab`
  const created = await call({
    path,
    method: 'POST',
    token: row.sessionToken,
    privateKeyPem: row.privateKeyPem,
    body: {
      bunqme_tab_entry: {
        amount_inquired: {
          value: formatAmount(input.amountCents),
          currency: 'EUR',
        },
        description: input.description,
        ...(input.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
      },
    },
  })

  const tabId = Number(pick<{ id?: number }>(created, 'Id')?.id)
  if (!Number.isFinite(tabId)) {
    throw new Error('bunq gaf geen betaalverzoek terug.')
  }

  // De link zelf staat niet in het antwoord op de POST; die halen we erbij op.
  const detail = await call({ path: `${path}/${tabId}`, token: row.sessionToken })
  const shareUrl = pick<{ bunqme_tab_share_url?: string }>(
    detail,
    'BunqMeTab',
  )?.bunqme_tab_share_url

  if (!shareUrl) throw new Error('bunq gaf geen betaallink terug.')
  return { tabId, shareUrl }
}

/**
 * Maakt een bunq.me-link voor een bedrag met het ordernummer als beschrijving.
 * Loopt de sessie onderweg af, dan proberen we het één keer opnieuw met een
 * verse koppeling.
 */
export async function createBunqPaymentLink(input: {
  amountCents: number
  description: string
  redirectUrl?: string
}): Promise<{ tabId: number; shareUrl: string }> {
  const payload = { ...input, redirectUrl: input.redirectUrl ?? '' }

  try {
    const row = await ensureSession()
    const link = await requestPaymentLink(row, payload)
    if (row.lastError) await save(row, { lastError: '' })
    return link
  } catch (error) {
    const recoverable =
      error instanceof BunqApiError &&
      (error.status === 401 || error.status === 403 || error.status === 419)
    if (!recoverable) throw error

    // Sessie of installatie afgekeurd: alles vergeten en één keer opnieuw.
    const row = await readContext()
    await resetConnection(row)
    const fresh = await ensureSession()
    const link = await requestPaymentLink(fresh, payload)
    if (fresh.lastError) await save(fresh, { lastError: '' })
    return link
  }
}

/**
 * Dezelfde bunq.me-link, maar met iDEAL al gekozen. De betaalpagina van bunq
 * leest `paymentMethod` uit de URL, kiest die methode en dient hem meteen in,
 * zodat de klant zonder tussenstap bij de iDEAL-pagina uitkomt. Staat iDEAL
 * voor deze link niet aan, dan toont bunq.me gewoon de keuze van methodes.
 */
export function idealPaymentUrl(shareUrl: string) {
  try {
    const url = new URL(shareUrl)
    url.searchParams.set('paymentMethod', 'ideal')
    return url.toString()
  } catch {
    return shareUrl
  }
}

const recoverable = (error: unknown) =>
  error instanceof BunqApiError &&
  (error.status === 401 || error.status === 403 || error.status === 419)

async function paymentCompleted(row: ContextRow, tabId: number) {
  const path = `/user/${row.bunqUserId}/monetary-account/${row.monetaryAccountId}/bunqme-tab/${tabId}`
  const detail = await call({ path, token: row.sessionToken })
  const tab = pick<{ result_inquiries?: unknown[] }>(detail, 'BunqMeTab')

  // bunq vult result_inquiries uitsluitend met geslaagde betalingen.
  return Array.isArray(tab?.result_inquiries) && tab.result_inquiries.length > 0
}

/** Controleert de betaling rechtstreeks bij bunq, nooit via de browser. */
export async function isBunqPaymentCompleted(tabId: number) {
  try {
    return await paymentCompleted(await ensureSession(), tabId)
  } catch (error) {
    if (!recoverable(error)) throw error
    const row = await readContext()
    await resetConnection(row)
    return paymentCompleted(await ensureSession(), tabId)
  }
}

/**
 * Zet de koppeling meteen op met de huidige sleutel, zodat een fout zichtbaar
 * is vóórdat een klant afrekent. Een mislukte poging komt bij de laatste fout.
 */
export async function testBunqConnection() {
  try {
    const row = await ensureSession()
    if (row.lastError) await save(row, { lastError: '' })
    return { ok: true as const, iban: row.monetaryAccountIban }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Onbekende fout bij bunq.'
    await recordBunqError(message)
    return { ok: false as const, error: message }
  }
}

/** Legt vast waarom een betaallink niet gemaakt kon worden. */
export async function recordBunqError(message: string) {
  try {
    const row = await readContext()
    await save(row, { lastError: message.slice(0, 500) })
  } catch {
    // Zonder database valt er niets vast te leggen.
  }
}

/* ------------------------------------------------------------------ */
/* Beheer                                                              */
/* ------------------------------------------------------------------ */

/** Status van de bunq-koppeling voor het beheer; nooit de sleutel zelf. */
export interface BunqStatus {
  configured: boolean
  /** Waar de sleutel vandaan komt, zodat de beheerder weet wat er geldt. */
  source: 'omgeving' | 'beheer' | 'geen'
  keyLast4: string | null
  connected: boolean
  iban: string
  /** Het IBAN (of begin ervan) uit BUNQ_ACCOUNT_IBAN; leeg = eerste betaalrekening. */
  expectedIban: string
  lastError: string
}

/**
 * Bewaart een API-sleutel die de beheerder invult. De sleutel is daarna niet
 * meer terug te lezen — er is geen enkele functie die hem teruggeeft.
 */
export async function saveBunqApiKey(apiKey: string) {
  const row = await readContext()
  const trimmed = apiKey.trim()
  if (trimmed) await store().set(KEY, trimmed)
  else await store().delete(KEY)
  await resetConnection(row, {
    apiKeyHash: trimmed ? sha256(trimmed) : '',
    keyLast4: trimmed ? trimmed.slice(-4) : null,
    lastError: '',
  })
}

/** Status voor het beheer. Geeft nooit de sleutel zelf terug. */
export async function bunqStatus(): Promise<BunqStatus> {
  const [row] = await db
    .select()
    .from(bunqContext)
    .where(eq(bunqContext.id, 1))
  const fromEnv = Boolean(apiKeyFromEnv())
  const fromAdmin = Boolean(await apiKeyFromAdmin())

  return {
    configured: fromEnv || fromAdmin,
    source: fromEnv ? 'omgeving' : fromAdmin ? 'beheer' : 'geen',
    keyLast4: fromEnv ? null : (row?.keyLast4 ?? null),
    connected:
      Boolean(row?.monetaryAccountId) &&
      normalizeIban(row?.monetaryAccountIban ?? '').startsWith(configuredIban()),
    iban: row?.monetaryAccountIban ?? '',
    expectedIban: configuredIban(),
    lastError: row?.lastError ?? '',
  }
}
