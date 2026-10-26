/**
 * Een productpagina van coolblue.nl omzetten naar een concept-product voor de
 * winkel. De pagina bevat de productgegevens twee keer: als schema.org-blok
 * (naam, prijs, kruimelpad) en als data voor de pagina zelf (specificaties,
 * pluspunten, adviesprijs). We gebruiken allebei, zodat een wijziging in de ene
 * bron de import niet meteen breekt.
 */

export type SpecGroup = { title: string; specs: [label: string, value: string][] }

/** Een keuze die de klant maakt, zoals kleur of opslag, met alle mogelijke waarden. */
export type VariantOption = { title: string; type: 'color' | 'choice'; values: string[] }

/** Eén uitvoering van het product: een eigen Coolblue-artikel met eigen prijs en foto's. */
export type CoolblueVariant = { sku: string; name: string; values: Record<string, string>; price: number | null; listPrice: number | null; imageIds: string[] }

export type CoolblueProduct = {
  sourceUrl: string
  sourceSku: string
  name: string
  brand: string
  description: string
  bullets: string[]
  colorName: string | null
  series: string | null
  price: number | null
  listPrice: number | null
  imageId: string | null
  imageIds: string[]
  rating: number | null
  reviews: number | null
  breadcrumbs: string[]
  productType: string | null
  specGroups: SpecGroup[]
  variantOptions: VariantOption[]
  variants: CoolblueVariant[]
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

/** Alleen echte productpagina's van coolblue.nl (of .be) accepteren we. */
export const coolblueUrl = (input: unknown) => {
  try {
    const url = new URL(String(input ?? '').trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!/^(www\.)?coolblue\.(nl|be)$/.test(url.hostname)) return null
    const sku = url.pathname.match(/\/product\/(\d+)/)?.[1]
    if (!sku) return null
    url.protocol = 'https:'
    url.search = ''
    url.hash = ''
    return { url: url.toString(), sku }
  } catch {
    return null
  }
}

const decodeEntities = (value: string) => value
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')

const clean = (value: unknown) => decodeEntities(String(value ?? '')).replace(/\\,/g, ',').replace(/\s+/g, ' ').trim()

/** Een JSON-waarde vanaf `start` uitlezen door haakjes te tellen, met oog voor tekenreeksen. */
const readJson = (text: string, start: number) => {
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (char === '\\') i++
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{' || char === '[') depth++
    else if (char === '}' || char === ']') {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, i + 1))
    }
  }
  return null
}

/** Terugzoeken naar de `{` die het object rond `index` opent. */
const objectStart = (text: string, index: number) => {
  let depth = 0
  let inString = false
  for (let i = index; i >= 0; i--) {
    const char = text[i]
    if (char === '"') {
      let slashes = 0
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) slashes++
      if (slashes % 2 === 0) inString = !inString
      continue
    }
    if (inString) continue
    if (char === '}' || char === ']') depth++
    else if (char === '{' || char === '[') {
      if (depth === 0 && char === '{') return i
      depth--
    }
  }
  return -1
}

/** Alle schema.org-blokken op de pagina. */
const structuredData = (html: string) => {
  const blocks: any[] = []
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { blocks.push(JSON.parse(match[1])) } catch { /* onleesbaar blok overslaan */ }
  }
  return blocks
}

/** De paginadata van Next.js staat in losse, ge-escapete stukken; die plakken we aan elkaar. */
const pagePayload = (html: string) => {
  let text = ''
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try { text += JSON.parse(`"${match[1]}"`) } catch { /* stuk overslaan */ }
  }
  return text
}

/** Het productobject van dit artikel: de specificaties beginnen met het eigen artikelnummer. */
const pageProduct = (payload: string, sku: string) => {
  const marker = `"propertyGroups":[`
  let index = payload.indexOf(marker)
  while (index >= 0) {
    const groups = readJson(payload, index + marker.length - 1)
    const first = groups?.[0]?.properties?.find((property: any) => property.propertyId === 'productNumber')
    if (first?.value === sku) {
      // propertyGroups staat in `properties`, en dat staat in het product zelf.
      const properties = objectStart(payload, index - 1)
      const product = properties > 0 ? objectStart(payload, properties - 1) : -1
      const parsed = product >= 0 ? readJson(payload, product) : null
      return { groups, product: parsed && typeof parsed === 'object' ? parsed : {} }
    }
    index = payload.indexOf(marker, index + marker.length)
  }
  return null
}

/**
 * De fotogalerij van het product. In het productobject staat die vaak alleen
 * als verwijzing, dus zoeken we de galerij op die met de hoofdfoto begint.
 */
const pageGallery = (payload: string, mainId: string) => {
  for (const marker of [`"mediaGallery":{`, `"mediaGalleryItems":[`]) {
    let index = payload.indexOf(marker)
    while (index >= 0) {
      const value = readJson(payload, index + marker.length - 1)
      const items: any[] = Array.isArray(value) ? value : value?.items ?? []
      const ids: string[] = items.map(item => String(item?.image?.id ?? '')).filter(id => /^\d+$/.test(id))
      if (ids.length && (!mainId || ids.includes(mainId))) return ids
      index = payload.indexOf(marker, index + marker.length)
    }
  }
  return []
}

type Consideration = { title?: string; type?: string; options?: { name?: string; product?: any }[] }

/**
 * De keuzeblokken op de pagina ("Kleur", "Opslagcapaciteit"). Elke optie
 * verwijst naar een eigen artikel, met prijs en foto's. We nemen het blok
 * waarin dit artikel zelf als optie voorkomt.
 */
const pageConsiderations = (payload: string, sku: string): Consideration[] => {
  const marker = `"upsellZone":{`
  let index = payload.indexOf(marker)
  while (index >= 0) {
    const zone = readJson(payload, index + marker.length - 1)
    const considerations: Consideration[] = Array.isArray(zone?.considerations) ? zone.considerations : []
    if (considerations.some(item => item.options?.some(option => String(option.product?.id) === sku))) return considerations
    index = payload.indexOf(marker, index + marker.length)
  }
  return []
}

const yesNo = (value: string) => value === 'true' ? 'Ja' : value === 'false' ? 'Nee' : value

const amount = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null
  if (typeof value === 'string') return amount(Number(value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')))
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    return amount(object.includingVat ?? object.price ?? object.amount ?? object.value)
  }
  return null
}

const fetchPage = (url: string, timeout: number) => fetch(url, {
  headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'nl-NL,nl;q=0.9' },
  redirect: 'follow',
  signal: AbortSignal.timeout(timeout),
}).catch(() => null)

/** Zoveel extra pagina's halen we hooguit op om alle combinaties van kleur en opslag te vinden. */
const MAX_VARIANT_PAGES = 12
/** Na zoveel milliseconden beginnen we niet meer aan een nieuwe ronde pagina's. */
const VARIANT_DEADLINE = 12000

/** Een waarde zoals "128 GB" uit een naam als "Apple iPhone 16 128GB Zwart" halen. */
const withoutValue = (name: string, value: string) => {
  const pattern = value.trim().split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')
  return pattern ? name.replace(new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, 'i'), ' ').replace(/\s+/g, ' ').trim() : name
}

/**
 * Alle uitvoeringen van het product verzamelen. Een pagina toont alleen de
 * keuzes vanaf het huidige artikel: de kleuren bij deze opslag en de opslag
 * bij deze kleur. Daarom openen we ook de pagina's van de andere opslag (of
 * andere niet-kleurkeuzes), zodat we de kleuren daarbij ook kennen.
 */
async function collectVariants(sku: string, first: Consideration[], started: number) {
  const variants = new Map<string, CoolblueVariant & { confirmed?: boolean }>()
  const options = new Map<string, VariantOption & { seen: Set<string> }>()
  const urls = new Map<string, string>()

  const read = (pageSku: string, considerations: Consideration[]) => {
    const current: Record<string, string> = {}
    for (const item of considerations) {
      const own = item.options?.find(option => String(option.product?.id) === pageSku)
      if (item.title && own?.name) current[clean(item.title)] = clean(own.name)
    }
    for (const item of considerations) {
      const title = clean(item.title)
      if (!title || bundleChoice(title)) continue
      const option = options.get(title) ?? { title, type: item.type === 'COLOR' ? 'color' as const : 'choice' as const, values: [], seen: new Set<string>() }
      options.set(title, option)
      for (const choice of item.options ?? []) {
        const value = clean(choice.name)
        const id = String(choice.product?.id ?? '')
        if (!value || !/^\d+$/.test(id)) continue
        if (!option.seen.has(value)) { option.seen.add(value); option.values.push(value) }
        const known = variants.get(id)
        if (known?.confirmed) continue
        const url = coolblueUrl(choice.product.urls?.product)
        if (url?.sku === id) urls.set(id, url.url)
        variants.set(id, variantFrom(choice.product, { ...current, [title]: value }))
      }
    }
    // Wat de pagina van het artikel zelf zegt, gaat voor wat een andere pagina erover zegt.
    const own = variants.get(pageSku)
    if (own) variants.set(pageSku, { ...own, values: { ...own.values, ...current }, confirmed: true })
  }

  // Welke keuzes vragen om een extra pagina: alles behalve kleur (of, zonder kleur, alles behalve de eerste keuze).
  const expand = (considerations: Consideration[]) => {
    const hasColor = considerations.some(item => item.type === 'COLOR')
    return considerations
      .filter((item, index) => !bundleChoice(clean(item.title)) && (hasColor ? item.type !== 'COLOR' : index > 0))
      .flatMap(item => (item.options ?? []).map(option => String(option.product?.id ?? '')))
      .filter(id => /^\d+$/.test(id))
  }

  read(sku, first)
  const visited = new Set([sku])
  let queue = expand(first).filter(id => !visited.has(id))
  while (queue.length && visited.size <= MAX_VARIANT_PAGES && Date.now() - started < VARIANT_DEADLINE) {
    const batch = [...new Set(queue)].filter(id => !visited.has(id)).slice(0, MAX_VARIANT_PAGES + 1 - visited.size)
    batch.forEach(id => visited.add(id))
    const pages = await Promise.all(batch.map(async id => {
      const response = await fetchPage(urls.get(id) ?? `https://www.coolblue.nl/product/${id}/`, 8000)
      if (!response?.ok) return null
      return { id, considerations: pageConsiderations(pagePayload(await response.text()), id) }
    }))
    queue = []
    for (const page of pages) {
      if (!page) continue
      read(page.id, page.considerations)
      queue.push(...expand(page.considerations).filter(id => !visited.has(id)))
    }
  }

  return finishVariants(sku, [...options.values()].map(({ seen, ...option }) => option), [...variants.values()].map(({ confirmed, ...variant }) => variant))
}

/** Alleen keuzes met minstens twee waarden, en alleen uitvoeringen waarvan elke keuze bekend is. */
const finishVariants = (sku: string, options: VariantOption[], variants: CoolblueVariant[]): { variantOptions: VariantOption[]; variants: CoolblueVariant[] } => {
  const none = { variantOptions: [], variants: [] }
  const kept = options.filter(option => option.values.length > 1)
  if (!kept.length) return none
  const combos = new Set<string>()
  const list: CoolblueVariant[] = []
  // De eigen uitvoering eerst, zodat die bij een dubbele combinatie wint.
  for (const variant of [...variants].sort((a, b) => Number(b.sku === sku) - Number(a.sku === sku))) {
    if (!kept.every(option => variant.values[option.title])) continue
    const values = Object.fromEntries(kept.map(option => [option.title, variant.values[option.title]]))
    const combo = JSON.stringify(values)
    if (combos.has(combo)) continue
    combos.add(combo)
    list.push({ ...variant, values })
  }
  // Keuzes die na het filteren maar één waarde overhouden, laten we weg.
  const variantOptions = kept
    .map(option => ({ ...option, values: option.values.filter(value => list.some(variant => variant.values[option.title] === value)) }))
    .filter(option => option.values.length > 1)
  if (!variantOptions.length || list.length < 2) return none
  return {
    variantOptions,
    variants: list.map(variant => ({ ...variant, values: Object.fromEntries(variantOptions.map(option => [option.title, variant.values[option.title]])) })),
  }
}

const variantFrom = (product: any, values: Record<string, string>): CoolblueVariant => {
  const price = amount(product.salesPrice)
  const was = amount(product.listPrice) ?? amount(product.prices?.listPrice)
  return {
    sku: String(product.id),
    name: clean(product.name),
    values,
    price,
    listPrice: was && price && was > price ? was : null,
    imageIds: [...new Set<string>((product.mediaGallery?.items ?? []).map((photo: any) => clean(photo?.image?.id)).filter((photo: string) => /^\d+$/.test(photo)))].slice(0, 40),
  }
}

/** Keuzes die een ander pakket maken in plaats van een andere uitvoering, zoals "Bundel bevat". Die volgen het eigen artikel. */
const bundleChoice = (title: string) => /bundel|accessoire|pakket|abonnement|verzekering|inclusief/i.test(title)

/**
 * In de meeste pagina's staat het hele assortiment van dit model in één
 * "collectie": per keuze (kleur, opslag, bundel) de waarden met alle
 * artikelen die daarbij horen. Zo kennen we met één pagina alle combinaties.
 */
const pageCollection = (payload: string, sku: string) => {
  const marker = `"discriminants":[`
  let best: any[] | null = null
  let bestCount = 0
  let index = payload.indexOf(marker)
  while (index >= 0) {
    const discriminants = readJson(payload, index + marker.length - 1)
    if (Array.isArray(discriminants)) {
      const ids = discriminants.flatMap((item: any) => (item?.values ?? []).flatMap((value: any) => (value?.products ?? []).map((product: any) => String(product?.id ?? ''))))
      if (ids.includes(sku) && ids.length > bestCount) { best = discriminants; bestCount = ids.length }
    }
    index = payload.indexOf(marker, index + marker.length)
  }
  if (!best) return null

  const products = new Map<string, any>()
  const values = new Map<string, Record<string, string>>()
  const options: VariantOption[] = []
  let allowed = null as Set<string> | null
  for (const item of best) {
    const title = clean(item?.displayName)
    if (!title) continue
    const choices: any[] = (item.values ?? []).filter((value: any) => clean(value?.name))
    if (bundleChoice(title)) {
      // Alleen artikelen met dezelfde bundel als het eigen artikel.
      const own = choices.find(value => value.products?.some((product: any) => String(product?.id) === sku))
      const ids = new Set<string>((own?.products ?? []).map((product: any) => String(product?.id ?? '')))
      allowed = allowed ? new Set([...allowed].filter(id => ids.has(id))) : ids
      continue
    }
    options.push({ title, type: item.referenceId === '1006' || /kleur/i.test(title) ? 'color' : 'choice', values: choices.map(value => clean(value.name)) })
    for (const value of choices) {
      for (const product of value.products ?? []) {
        const id = String(product?.id ?? '')
        if (!/^\d+$/.test(id) || typeof product !== 'object') continue
        if (!products.has(id) || product.salesPrice) products.set(id, product)
        values.set(id, { ...values.get(id), [title]: clean(value.name) })
      }
    }
  }
  const variants = [...products.entries()]
    .filter(([id]) => !allowed || allowed.has(id))
    .map(([id, product]) => variantFrom(product, values.get(id) ?? {}))
  return finishVariants(sku, options, variants)
}

const specGroupsFrom = (groups: any[] | undefined): SpecGroup[] => (groups ?? []).map((group: any, index: number) => ({
  title: clean(group.title) || (index === 0 ? 'Product' : 'Overig'),
  specs: (group.properties ?? [])
    .filter((property: any) => property.propertyId !== 'productNumber')
    .map((property: any) => [clean(property.displayName), yesNo(clean(property.value))] as [string, string])
    .filter(([label, value]: [string, string]) => label && value),
})).filter((group: SpecGroup) => group.specs.length)

/**
 * De specificaties van één uitvoering, zoals de pagina van dat artikel ze
 * toont. Zo kloppen opslag, werkgeheugen en processor bij elke keuze.
 * Geeft een lege lijst als de pagina niet te lezen is.
 */
export async function coolblueSpecGroups(sku: string, url?: string): Promise<SpecGroup[]> {
  if (!/^\d+$/.test(sku)) return []
  const response = await fetchPage(coolblueUrl(url)?.url ?? `https://www.coolblue.nl/product/${sku}/`, 15000)
  if (!response?.ok) return []
  return specGroupsFrom(pageProduct(pagePayload(await response.text()), sku)?.groups)
}

/** Pagina ophalen en uitlezen. Gooit een leesbare fout als dat niet lukt. */
export async function importCoolblue(input: unknown): Promise<CoolblueProduct> {
  const target = coolblueUrl(input)
  if (!target) throw new Error('Plak de volledige link van een productpagina op coolblue.nl, bijvoorbeeld https://www.coolblue.nl/product/123456/…')

  const started = Date.now()
  const response = await fetchPage(target.url, 20000)
  if (!response) throw new Error('Coolblue reageerde niet op tijd. Probeer het zo nog eens.')
  if (response.status === 404) throw new Error('Deze productpagina bestaat niet (meer) op Coolblue.')
  if (!response.ok) throw new Error(`Coolblue gaf de pagina niet vrij (status ${response.status}). Probeer het later nog eens.`)
  const html = await response.text()

  const blocks = structuredData(html)
  const ld = blocks.find(block => block?.['@type'] === 'Product') ?? {}
  const breadcrumbList = blocks.find(block => block?.['@type'] === 'BreadcrumbList')
  const breadcrumbs: string[] = (breadcrumbList?.itemListElement ?? [])
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((item: any) => clean(item.name))
    .filter(Boolean)

  const payload = pagePayload(html)
  const found = pageProduct(payload, target.sku)
  const product: any = found?.product ?? {}

  const specGroups = specGroupsFrom(found?.groups)

  const allSpecs = specGroups.flatMap(group => group.specs)
  const spec = (...labels: string[]) => allSpecs.find(([label]) => labels.some(wanted => label.toLowerCase() === wanted.toLowerCase()))?.[1] ?? null

  const name = clean(ld.name ?? product.name)
  if (!name) throw new Error('Op deze pagina vonden we geen product. Controleer of het een productpagina is.')

  const versions: any[] = product.description?.versions ?? []
  const version = versions.find(item => item?.variation === 'handWritten') ?? versions[0]
  const pros: string[] = (version?.prosAndCons?.pros ?? product.prosAndCons?.pros ?? []).map(clean).filter(Boolean)
  const highlights: string[] = (product.highlights ?? []).map(clean).filter(Boolean)

  const price = amount(product.salesPrice) ?? amount(ld.offers?.price ?? ld.offers?.[0]?.price)
  const was = amount(product.listPrice) ?? amount(product.prices?.listPrice) ?? amount(product.prices?.referencePrice)

  // Alle foto's uit de galerij, in de volgorde van de bronpagina. Valt terug op de foto's uit het schema.org-blok.
  const ldImages = (Array.isArray(ld.image) ? ld.image : [ld.image]).map((image: unknown) => String(image ?? '').match(/products\/(\d+)/)?.[1])
  const mainId = clean(product.mediaGallery?.mainGalleryItem?.image?.id ?? product.primaryImage?.id) || ldImages[0] || ''
  const galleryIds = Array.isArray(product.mediaGallery?.items)
    ? product.mediaGallery.items.map((item: any) => clean(item?.image?.id))
    : pageGallery(payload, mainId)
  const imageIds = [...new Set<string>([mainId, ...(galleryIds.length ? galleryIds : ldImages)].filter((id): id is string => Boolean(id && /^\d+$/.test(id))))].slice(0, 40)

  // De laatste kruimel is het product zelf; de kruimel ervoor is meestal de serie.
  const trail = breadcrumbs.slice(0, -1)
  const seriesCrumb = trail.length > 3 ? trail[trail.length - 1] : null

  // Alle kleuren en opslagvarianten horen bij één product in de winkel.
  const considerations = pageConsiderations(payload, target.sku)
  let collection = pageCollection(payload, target.sku)
  if (!collection?.variants.length && considerations.length) {
    // Coolblue toont afwisselend twee versies van de pagina; alleen de nieuwe heeft de complete collectie. Even opnieuw proberen.
    const retries = await Promise.all([0, 1, 2].map(async () => {
      const again = await fetchPage(target.url, 8000)
      return again?.ok ? pageCollection(pagePayload(await again.text()), target.sku) : null
    }))
    collection = retries.find(item => item?.variants.length) ?? null
  }
  const { variantOptions, variants } = collection?.variants.length ? collection : await collectVariants(target.sku, considerations, started)
  const own = variants.find(variant => variant.sku === target.sku)
  const colorOption = variantOptions.find(option => option.type === 'color')
  const baseName = own ? Object.values(own.values).reduce(withoutValue, name) || name : name
  if (own) {
    // De eigen uitvoering krijgt de prijs en de volledige fotogalerij van deze pagina.
    own.price = price ?? own.price
    own.listPrice = was && price && was > price ? was : null
    if (imageIds.length) own.imageIds = imageIds
  }

  return {
    sourceUrl: target.url,
    sourceSku: target.sku,
    name: baseName,
    brand: clean(ld.brand?.name ?? product.brand?.name) || name.split(' ')[0],
    description: clean(version?.mainText ?? ld.description),
    bullets: (highlights.length ? highlights : pros).slice(0, 5),
    colorName: (colorOption && own?.values[colorOption.title]) || spec('Kleur', 'Kleur behuizing', 'Kleur van het product', 'Kleurfamilie'),
    series: seriesCrumb,
    price,
    listPrice: was && price && was > price ? was : null,
    imageId: imageIds[0] ?? null,
    imageIds,
    rating: Number(ld.aggregateRating?.ratingValue) ? Math.round((Number(ld.aggregateRating.ratingValue) / 2) * 10) / 10 : null,
    reviews: Number(ld.aggregateRating?.reviewCount) || null,
    breadcrumbs: trail,
    productType: clean(product.productType?.pluralName) || null,
    specGroups,
    variantOptions,
    variants,
  }
}
