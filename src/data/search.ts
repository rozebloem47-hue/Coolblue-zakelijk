/**
 * Zoeken in het assortiment. Elke uitvoering is een eigen resultaat, net als
 * in de collecties: zoek je "iphone 256gb blauw", dan krijg je precies die
 * uitvoering. Alle woorden moeten ergens in het product voorkomen; hoofdletters,
 * accenten, spaties in "256 GB" en leestekens maken niet uit.
 */
import{categories,type Product}from'./products'
import type{Match}from'./filters'

/** Kleine letters, zonder accenten en leestekens, "256 GB" wordt "256gb". */
export const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9+]+/g,' ').replace(/(\d)\s+(gb|tb|mb|inch|hz|mp|mah|w)\b/g,'$1$2').trim()

const words=(query:string)=>normalize(query).split(' ').filter(Boolean)

const categoryName=(slug:string)=>categories.find(category=>category.slug===slug)?.name??''

/** Alle tekst waarop een product (en eventueel een uitvoering) gevonden kan worden. */
const haystack=(product:Product,variant?:Match['variant'])=>normalize([
  variant?.name||product.name,product.brand,product.subcategory,categoryName(product.category),product.series,product.colorName,
  ...(variant?Object.values(variant.values):[]),variant?.sku,
].filter(Boolean).join(' '))

/** Een woord past ook als alleen de stam voorkomt: "telefoon" vindt "telefonie", "monitoren" vindt "monitor". */
const stem=(term:string)=>term.length>=5&&!/\d/.test(term)?term.slice(0,-2):term
const fits=(text:string,term:string)=>text.includes(term)||text.includes(stem(term))

/** Hoe goed een resultaat past: treffers in de naam en aan het begin van een woord tellen zwaarder. */
const score=(text:string,name:string,terms:string[])=>terms.reduce((sum,term)=>sum+(name.includes(term)?3:0)+(text.includes(term)?1:0)+(new RegExp(`(^| )${term.replace(/[+]/g,'\\+')}`).test(text)?1:0),0)

/** Alle uitvoeringen die bij de zoekopdracht passen, best passend eerst. */
export const searchProducts=(products:Product[],query:string):Match[]=>{
  const terms=words(query)
  if(!terms.length)return[]
  const hits:{match:Match;score:number;order:number}[]=[]
  products.forEach((product,index)=>{
    const options=product.variants?.length?[...product.variants].sort((a,b)=>Number(b.sku===product.defaultVariant)-Number(a.sku===product.defaultVariant)):[undefined]
    options.forEach((variant,position)=>{
      const text=haystack(product,variant)
      if(!terms.every(term=>fits(text,term)))return
      hits.push({match:{product,variant,choices:1},score:score(text,normalize(variant?.name||product.name),terms),order:index*1000+position})
    })
  })
  return hits.sort((a,b)=>b.score-a.score||a.order-b.order).map(hit=>hit.match)
}
