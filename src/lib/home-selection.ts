import type { Product } from '@/data/products'

/** Round-robin over departments and product types keeps new catalog imports from dominating the homepage. */
export function selectHomeProducts(products: Product[], limit: number, excluded = new Set<number>()): Product[] {
  const groups = new Map<string, Product[]>()
  for (const product of products) {
    if (excluded.has(product.id)) continue
    const group = groups.get(product.category) ?? []
    group.push(product)
    groups.set(product.category, group)
  }
  const selected: Product[] = []
  const types = new Set<string>()
  const ids = new Set(excluded)
  while (selected.length < limit) {
    let added = false
    for (const group of groups.values()) {
      const product = group.find(p => !ids.has(p.id) && !types.has(`${p.category}:${p.subcategory}`))
      if (!product) continue
      selected.push(product)
      ids.add(product.id)
      types.add(`${product.category}:${product.subcategory}`)
      added = true
      if (selected.length === limit) break
    }
    if (!added) break
  }
  return selected
}
