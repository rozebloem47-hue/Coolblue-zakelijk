/**
 * Het assortiment bestaat uit de producten die in de beheeromgeving zijn
 * toegevoegd (Netlify Database). De root-route laadt ze één keer via een
 * serverfunctie; `useCatalog` geeft pagina's het complete assortiment.
 */
import{createServerFn}from'@tanstack/react-start'
import{getRouteApi}from'@tanstack/react-router'
import{useMemo}from'react'
import type{Product}from'@/data/products'
import{fromCatalogRow,markStandaloneVariants,type CatalogRow}from'@/data/imported-products'

/** Actieve beheerproducten, nieuwste eerst. Zonder database (of bij een fout) blijft de winkel leeg in plaats van te crashen. */
export const getShopProducts=createServerFn({method:'GET'}).handler(async():Promise<Product[]>=>{
  try{
    const[{db},{catalogProducts},{desc,eq}]=await Promise.all([import('../../db/index'),import('../../db/schema'),import('drizzle-orm')])
    const rows=await db.select().from(catalogProducts).where(eq(catalogProducts.active,true)).orderBy(desc(catalogProducts.createdAt))
    return markStandaloneVariants(rows.map(row=>fromCatalogRow(row as CatalogRow)))
  }catch(error){
    console.error('Beheerproducten laden mislukt',error)
    return[]
  }
})

const root=getRouteApi('__root__')

/** Het hele assortiment, nieuwste producten eerst. */
export function useCatalog(){
  const extra=root.useLoaderData() as Product[]|undefined
  return useMemo(()=>{
    const all=extra??[]
    return{
      all,
      find:(slug:string)=>all.find(product=>product.slug===slug),
      byId:(id:number)=>all.find(product=>product.id===id),
    }
  },[extra])
}
