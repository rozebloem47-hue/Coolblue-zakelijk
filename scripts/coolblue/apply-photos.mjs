/**
 * Koppelt de rijen uit rows.tsv aan de catalogus en zet het Coolblue-beeld-id in
 * `productPhotos` in src/data/media.ts. Zonder --write wordt alleen gerapporteerd.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const root = new URL('../../', import.meta.url).pathname
const write = process.argv.includes('--write')

/** Woorden die niets zeggen over welk model het is. */
const NOISE = new Set([
  'zwart', 'wit', 'grijs', 'zilver', 'blauw', 'lichtblauw', 'donkerblauw', 'rood',
  'bordeaux', 'groen', 'goud', 'creme', 'paars', 'roze', 'antraciet', 'titanium',
  'inch', 'gen', 'tws', 'wifi', 'met', 'en', 'voor', 'de', 'het',
  'oordopjes', 'koptelefoon', 'hoofdtelefoon', 'monitor', 'stofzuiger', 'series',
  // Soortnamen: ze staan vaak aan een kant van de vergelijking en zeggen niets
  // over welk model het is. Merk en modelnummer moeten nog altijd kloppen.
  'receiver', 'receivers', 'verrekijker', 'verrekijkers', 'telescoop', 'dashcam',
  'microfoon', 'platenspeler', 'speaker', 'smartphone', 'wasmachine', 'droger',
])
const isCapacity = (t) => /^\d+(gb|tb|mah|w)$/.test(t) || t === '5g' || t === '4g'
const clean = (s) =>
  s
    .toLowerCase()
    .replace(/(\d+)\s*(gb|tb|mah)\b/g, '$1$2')
    .replace(/\bdash\s*cam\b/g, 'dashcam')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t && !NOISE.has(t) && !isCapacity(t))
const isModel = (t) => /\d/.test(t)

/** Varianten binnen een serie: die moeten aan beide kanten hetzelfde zijn. */
const VARIANTS = ['ultra', 'pro', 'max', 'mini', 'air', 'lite', 'plus', 'se', 'fe', 'elite']

/** Bundels en multipacks hebben een foto van meerdere producten, die slaan we over. */
const isBundle = (name) => /\+|\bduo\b|\b2x\b|\bpakket\b|\bset\b|\bcombi\b/i.test(name)

const seeds = []
for (const file of readdirSync(`${root}src/data/catalog`)) {
  if (!file.endsWith('.ts')) continue
  const source = readFileSync(`${root}src/data/catalog/${file}`, 'utf8')
  for (const match of source.matchAll(/slug:'([^']+)',name:'([^']+)'/g)) {
    seeds.push({ slug: match[1], name: match[2], t: clean(match[2]) })
  }
}

const rows = readFileSync(`${root}scripts/coolblue/rows.tsv`, 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [category, name, imageId, price] = line.split('\t')
    return { category, name, imageId, price, t: clean(name) }
  })

/**
 * Een rij hoort bij een seed als het merk klopt, alle betekenisvolle woorden van de
 * seed in de rij voorkomen en alle modelnummers van de seed in de rij staan.
 */
const fits = (seed, row) => {
  if (!seed.t.length || !row.t.length) return false
  if (seed.t[0] !== row.t[0]) return false
  const rowTokens = new Set(row.t)
  if (!seed.t.every((t) => rowTokens.has(t))) return false
  for (const variant of VARIANTS) {
    if (seed.t.includes(variant) !== row.t.includes(variant)) return false
  }
  // De rij mag extra modelnummers hebben (Coolblue zet er vaak een artikelcode
  // bij), maar elk modelnummer van de seed moet erin staan.
  return seed.t.filter(isModel).every((t) => rowTokens.has(t))
}

const chosen = new Map()
const unmatched = []
for (const row of rows) {
  if (isBundle(row.name)) {
    unmatched.push(row)
    continue
  }
  const hit = seeds.find((seed) => fits(seed, row))
  if (!hit) {
    unmatched.push(row)
    continue
  }
  // Bij meerdere rijen voor hetzelfde product houdt de kortste (meest neutrale) naam.
  const current = chosen.get(hit.slug)
  if (!current || row.name.length < current.row.name.length) chosen.set(hit.slug, { seed: hit, row })
}

const matched = [...chosen.values()]
console.log(`rijen: ${rows.length}, gekoppeld: ${matched.length}, geen product: ${unmatched.length}`)
for (const m of matched) console.log(`  ${m.seed.slug} -> ${m.row.imageId}  (${m.row.name})`)

// Met --misses laten we zien welke rijen dicht bij een product zaten, om te
// beoordelen of de koppeling te streng is.
if (process.argv.includes('--misses')) {
  for (const row of unmatched) {
    if (isBundle(row.name)) continue
    const near = seeds.filter(
      (seed) => seed.t[0] === row.t[0] && seed.t.some((t) => isModel(t) && row.t.includes(t)),
    )
    for (const seed of near) console.log(`  ? ${row.name} [${row.imageId}]  ~  ${seed.name} (${seed.slug})`)
  }
}

if (!write || !matched.length) process.exit(0)

const mediaPath = `${root}src/data/media.ts`
let media = readFileSync(mediaPath, 'utf8')
const anchor = 'export const productPhotos: Record<string, string> = {\n'
const index = media.indexOf(anchor)
if (index < 0) throw new Error('productPhotos niet gevonden in media.ts')
const fresh = matched.filter((m) => !media.includes(`'${m.seed.slug}':`))
const lines = fresh.map((m) => `  '${m.seed.slug}':'${m.row.imageId}',\n`).join('')
const insertAt = index + anchor.length
writeFileSync(mediaPath, media.slice(0, insertAt) + lines + media.slice(insertAt))
console.log(`toegevoegd aan media.ts: ${fresh.length}`)
