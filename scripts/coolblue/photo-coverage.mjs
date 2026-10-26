/** Rapporteert per product welke foto wordt gebruikt en waar er niets is. */
import { build } from 'vite'

const root = new URL('../../', import.meta.url).pathname
await build({
  configFile: false,
  logLevel: 'error',
  resolve: { alias: { '@': `${root}src` } },
  build: {
    ssr: true,
    lib: { entry: 'src/data/products.ts', formats: ['es'], fileName: () => 'products' },
    outDir: '/tmp/coverage',
    emptyOutDir: false,
    minify: false,
  },
})
const { products } = await import('/tmp/coverage/products.js')
const media = await import(`${root}src/data/media.ts?raw`).catch(() => null)
const { productPhotos, productSubjectFallbacks, subjectPhotos, subjectPhotoFor } = await import('/tmp/coverage/products.js').then(
  async () => await import(`${root}src/data/media.ts`).catch(async () => {
    await build({
      configFile: false,
      logLevel: 'error',
      resolve: { alias: { '@': `${root}src` } },
      build: {
        ssr: true,
        lib: { entry: 'src/data/media.ts', formats: ['es'], fileName: () => 'media' },
        outDir: '/tmp/coverage',
        emptyOutDir: false,
        minify: false,
      },
    })
    return await import('/tmp/coverage/media.js')
  }),
)

const usage = new Map()
let own = 0
let viaSubject = 0
const missing = []
for (const product of products) {
  const exact = productPhotos[product.slug]
  if (exact) {
    own += 1
    usage.set(`product:${exact}`, (usage.get(`product:${exact}`) ?? 0) + 1)
    continue
  }
  const fallback = productSubjectFallbacks[product.slug]
  const hash = (fallback ? subjectPhotos[fallback] : undefined) ??
    (product.subcategory ? subjectPhotoFor(product.subcategory) : undefined)
  if (hash) {
    viaSubject += 1
    usage.set(`content:${hash}`, (usage.get(`content:${hash}`) ?? 0) + 1)
  } else {
    missing.push(`${product.slug} (${product.subcategory ?? 'geen subcollectie'})`)
  }
}
const shared = [...usage.entries()].sort((a, b) => b[1] - a[1])
console.log(`producten: ${products.length}`)
console.log(`eigen productfoto: ${own}`)
console.log(`foto van de subcollectie: ${viaSubject}`)
console.log(`zonder foto: ${missing.length}`)
console.log(`verschillende foto's in gebruik: ${usage.size}`)
console.log('meest gedeelde foto\'s:')
for (const [ref, count] of shared.slice(0, 8)) console.log(`  ${count}x ${ref}`)
const perSub = new Map()
for (const entry of missing) {
  const sub = entry.slice(entry.indexOf('(') + 1, -1)
  perSub.set(sub, (perSub.get(sub) ?? 0) + 1)
}
console.log(`subcollecties zonder foto: ${perSub.size}`)
for (const [sub, count] of [...perSub.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}x ${sub}`)
}
