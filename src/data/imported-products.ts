/**
 * Producten uit de beheeromgeving (tabel `catalog_products`) naast de vaste
 * catalogus. Dit bestand bevat geen databasecode, zodat winkel, serverfuncties
 * en Netlify Functions dezelfde omzetting gebruiken.
 */
import{categories,collectionSlug,type Product,type ProductVariant,type VariantOption}from'./products'
import{presentationFor}from'./catalog/presentation'

/** Beheerproducten krijgen een eigen nummerreeks, zodat ze nooit botsen met de vaste catalogus. */
export const IMPORTED_ID_OFFSET=100000
export const isImportedId=(id:number)=>id>IMPORTED_ID_OFFSET

export type SpecGroup={title:string;specs:[string,string][]}

/** Een uitvoering zoals die in de database staat: bedragen als tekst, inclusief 21% btw. */
export type StoredVariant={sku:string;name:string;values:Record<string,string>;price:string;listPrice:string|null;imageIds:string[];specs?:[string,string][]}

/** Zoals een rij uit de database binnenkomt: bedragen als tekst, datums als datum of tekst. */
export type CatalogRow={id:number;slug:string;name:string;brand:string;category:string;collection:string|null;subcategory:string;series:string|null;colorName:string|null;description:string;bullets:string[];specGroups:SpecGroup[];price:string|number;listPrice:string|number|null;imageId:string|null;imageIds?:string[]|null;sourceSku?:string|null;variantOptions?:VariantOption[]|null;variants?:StoredVariant[]|null;rating:string|number|null;reviews:number|null;stock:string|null;active:boolean}

const cents=(value:number)=>Math.round(value*100)/100

/** Bedragen zoals mensen ze typen: 1299, 1.299,95, 1299.95 of € 1.299,-. */
export const parseEuro=(value:unknown):number|null=>{
  if(typeof value==='number')return Number.isFinite(value)?cents(value):null
  let raw=String(value??'').replace(/[€\s]/g,'').replace(/,-$/,'')
  if(!raw)return null
  if(raw.includes(','))raw=raw.replace(/\./g,'').replace(',','.')
  else if(/^\d{1,3}(\.\d{3})+$/.test(raw))raw=raw.replace(/\./g,'')
  const number=Number(raw)
  return Number.isFinite(number)?cents(number):null
}

/** Van databaserij naar winkelproduct. De ingevulde prijs is altijd inclusief 21% btw. */
export const fromCatalogRow=(row:CatalogRow):Product=>{
  const look=presentationFor(row.subcategory,row.name)
  const price=cents(Number(row.price))
  const was=row.listPrice==null?0:cents(Number(row.listPrice))
  const deal=was>price?Math.round((1-price/was)*100):0
  const specs=row.specGroups.flatMap(group=>group.specs)
  // De standaarduitvoering volgt altijd de prijs van het product zelf.
  const stored=row.variants??[]
  const defaultVariant=stored.find(variant=>variant.sku===row.sourceSku)?.sku??stored[0]?.sku
  const variants:ProductVariant[]=stored.map(variant=>{
    const own=variant.sku===defaultVariant
    const variantPrice=own?price:cents(Number(variant.price))
    const variantWas=own?was:variant.listPrice==null?0:cents(Number(variant.listPrice))
    return{sku:variant.sku,name:variant.name,values:variant.values,price:variantPrice,...(variantWas>variantPrice?{listPrice:variantWas}:{}),imageIds:variant.imageIds?.length?variant.imageIds:row.imageIds??[],...(variant.specs?.length?{specs:variant.specs}:{})}
  })
  const hasVariants=variants.length>1&&Boolean(row.variantOptions?.length)
  return{
    id:IMPORTED_ID_OFFSET+row.id,slug:row.slug,name:row.name,brand:row.brand,
    category:row.category,subcategory:row.subcategory,
    price,
    ...(deal>0?{listPrice:was,dealPercent:deal}:{}),
    rating:Number(row.rating)||4.5,reviews:row.reviews??0,
    stock:row.stock||'Morgen in huis',
    // Een toestel dat pas later leverbaar is, wordt ook niet morgen bezorgd.
    ...(/^leverbaar vanaf/i.test(row.stock??'')?{delivery:'Bestel nu, gratis bezorgd zodra het leverbaar is'}:{}),
    color:look.color,icon:look.icon,
    bullets:row.bullets.length?row.bullets:specs.slice(0,3).map(([label,value])=>`${label}: ${value}`),
    description:row.description,
    specs,
    specGroups:row.specGroups,
    ...(row.series?{series:row.series}:{}),
    ...(row.colorName?{colorName:row.colorName}:{}),
    ...(row.imageId||row.imageIds?.[0]?{imageId:row.imageIds?.[0]??row.imageId!}:{}),
    ...(row.imageIds&&row.imageIds.length>1?{imageIds:row.imageIds}:{}),
    ...(hasVariants?{variantOptions:row.variantOptions!,variants,defaultVariant}:{}),
  }
}

/** Een nette url-naam, met het bronnummer erachter zodat twee kleuren van hetzelfde model niet botsen. */
export const catalogSlug=(name:string,suffix?:string|number)=>[collectionSlug(name).slice(0,80),suffix].filter(Boolean).join('-')

export type Placement={category:string;collection:string;subcategory:string}

/** Alle subcollecties van de winkel op één rij, met afdeling en collectie erbij. */
export const placements=():Placement[]=>categories.flatMap(category=>category.collections.flatMap(collection=>collection.items.map(item=>({category:category.slug,collection:collection.name,subcategory:item}))))

/**
 * De best passende plek in de winkel voor een product, op basis van het
 * kruimelpad van de bronpagina. De diepste kruimel die we als subcollectie
 * kennen wint; daarna het producttype, de collectie en de afdeling.
 */
export const placementFor=(breadcrumbs:string[],productType?:string|null):Placement=>{
  // Merk- en actiepagina's zijn verzamelplekken: alleen als niets anders past.
  const everything=placements()
  const all=everything.filter(place=>place.category!=='acties-merken')
  const key=(value:string)=>collectionSlug(value)
  const crumbs=[...breadcrumbs].reverse()
  for(const crumb of crumbs){const hit=all.find(place=>key(place.subcategory)===key(crumb));if(hit)return hit}
  if(productType){
    const type=key(productType)
    const hit=all.find(place=>key(place.subcategory)===type)??all.find(place=>key(place.subcategory).includes(type)||type.includes(key(place.subcategory)))
    if(hit)return hit
  }
  for(const crumb of crumbs){const hit=all.find(place=>key(place.collection)===key(crumb));if(hit)return hit}
  for(const crumb of crumbs){
    const category=categories.find(item=>key(item.name)===key(crumb)||item.slug===key(crumb))
    if(category)return{category:category.slug,collection:category.collections[0].name,subcategory:category.collections[0].items[0]}
  }
  for(const crumb of crumbs){const hit=all.find(place=>key(crumb).includes(key(place.subcategory)));if(hit)return hit}
  for(const crumb of crumbs){const hit=everything.find(place=>key(place.subcategory)===key(crumb));if(hit)return hit}
  return all[0]
}

/** Klopt deze combinatie van afdeling, collectie en subcollectie met het menu van de winkel? */
export const validPlacement=(place:Partial<Placement>)=>placements().some(item=>item.category===place.category&&item.collection===place.collection&&item.subcategory===place.subcategory)
