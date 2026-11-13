/**
 * Filters voor collectiepagina's. We filteren per uitvoering: kies je 256 GB
 * en blauw, dan telt alleen een uitvoering die allebei heeft. Elke kleur
 * krijgt een eigen kaart met de laagste prijs van de passende uitvoeringen.
 */
import{specsFor,type Product,type ProductVariant,type SpecTuple}from'./products'

export type Facet={key:string;title:string;values:string[]}
export type Selection=Record<string,string[]>
/**
 * Een product in één kleur. `variant` is de goedkoopste uitvoering in die kleur
 * die bij de filters past; `choices` is het aantal passende uitvoeringen, zodat
 * de kaart "vanaf" kan tonen als er meer keuze is.
 */
export type Match={product:Product;variant?:ProductVariant;choices:number}

const spec=(specs:SpecTuple[],...labels:string[])=>{
  const wanted=labels.map(label=>label.toLowerCase())
  return specs.find(([label])=>wanted.includes(label.toLowerCase()))?.[1]
}
/** "512 GB", "1 TB" of "2 TB SSD" naar gigabytes, om netjes te sorteren. */
const gigabytes=(value:string)=>{
  const match=value.replace(',','.').match(/([\d.]+)\s*(tb|gb)/i)
  return match?Number(match[1])*(match[2].toLowerCase()==='tb'?1024:1):Number.NaN
}
const capacity=(value?:string)=>{
  if(!value)return undefined
  const size=gigabytes(value)
  if(!Number.isFinite(size))return undefined
  return size>=1024?`${size/1024} TB`:`${size} GB`
}
const inches=(value?:string)=>{
  const size=Number(value?.replace(',','.').match(/[\d.]+/)?.[0])
  if(!size)return undefined
  if(size<6.3)return 'Tot 6,3 inch'
  if(size<6.7)return '6,3 tot 6,7 inch'
  if(size<10)return '6,7 inch en groter'
  if(size<15)return '13 tot 15 inch'
  if(size<17)return '15 tot 17 inch'
  return '17 inch en groter'
}
const priceBands:[number,string][]=[[500,'Tot € 500'],[1000,'€ 500 tot € 1.000'],[1500,'€ 1.000 tot € 1.500'],[2500,'€ 1.500 tot € 2.500'],[Infinity,'€ 2.500 en meer']]
const priceBand=(price:number)=>priceBands.find(([max])=>price<max)![1]

/** De waarde per filter voor één uitvoering (of een product zonder uitvoeringen). */
const valuesOf=(product:Product,variant?:ProductVariant):Record<string,string|undefined>=>{
  const specs=specsFor(product,variant)
  const colorTitle=product.variantOptions?.find(option=>option.type==='color')?.title
  const price=variant?.price??product.price
  return{
    type:product.subcategory,
    brand:product.brand,
    price:priceBand(price),
    storage:capacity(spec(specs,'Totale opslagcapaciteit','Opslagcapaciteit van SSD','Opslagcapaciteit')),
    memory:capacity(spec(specs,'Intern werkgeheugen (RAM)','Werkgeheugen (RAM)','Werkgeheugen')),
    screen:inches(spec(specs,'Schermdiagonaal')),
    color:(colorTitle&&variant?.values[colorTitle])||spec(specs,'Kleur')||product.colorName,
    system:spec(specs,'Besturingssysteem'),
    deal:(variant?.listPrice??product.listPrice??0)>price?'Met actiekorting':undefined,
  }
}

const facetTitles:[key:string,title:string][]=[['type','Producttype'],['brand','Merk'],['price','Prijs'],['storage','Opslag'],['memory','Werkgeheugen'],['screen','Schermformaat'],['color','Kleur'],['system','Besturingssysteem'],['deal','Aanbieding']]
const order:Record<string,(a:string,b:string)=>number>={
  price:(a,b)=>priceBands.findIndex(([,label])=>label===a)-priceBands.findIndex(([,label])=>label===b),
  storage:(a,b)=>gigabytes(a)-gigabytes(b),
  memory:(a,b)=>gigabytes(a)-gigabytes(b),
  screen:(a,b)=>Number(a.replace(',','.').match(/[\d.]+/)?.[0])-Number(b.replace(',','.').match(/[\d.]+/)?.[0]),
}

/** Alle uitvoeringen van een product, of het product zelf. */
// Een losse uitvoering (`standalone`) telt alleen met haar eigen variant; de andere uitvoeringen zijn eigen producten.
const optionsOf=(product:Product)=>product.variants?.length?(product.standalone?product.variants.filter(variant=>variant.sku===product.defaultVariant):product.variants).map(variant=>({variant,values:valuesOf(product,variant)})):[{variant:undefined,values:valuesOf(product)}]

/** Welke filters zinvol zijn voor deze producten: alleen met minstens twee verschillende waarden (aanbieding mag er één hebben). */
export const facetsFor=(pool:Product[]):Facet[]=>{
  const seen=new Map<string,Set<string>>()
  for(const product of pool)for(const{values}of optionsOf(product))for(const[key,value]of Object.entries(values))if(value){if(!seen.has(key))seen.set(key,new Set());seen.get(key)!.add(value)}
  return facetTitles.map(([key,title])=>({key,title,values:[...(seen.get(key)??[])].sort(order[key]??((a,b)=>a.localeCompare(b,'nl')))})).filter(facet=>facet.values.length>(facet.key==='deal'?0:1))
}

/**
 * Elke kleur staat los in de lijst: een telefoon in drie kleuren en twee
 * opslagmaten geeft drie kaarten, elk met de goedkoopste passende uitvoering.
 * Binnen één filter is elke aangevinkte waarde goed; tussen filters moet alles
 * kloppen voor dezelfde uitvoering. De kleur van de standaarduitvoering staat
 * vooraan, de rest in de volgorde van het product.
 */
export const applyFilters=(pool:Product[],selection:Selection):Match[]=>{
  const active=Object.entries(selection).filter(([,values])=>values.length)
  return pool.flatMap(product=>{
    const fits=optionsOf(product).filter(({values})=>active.every(([key,wanted])=>values[key]!=null&&wanted.includes(values[key]!)))
    const colorTitle=product.variantOptions?.find(option=>option.type==='color')?.title
    const groups=new Map<string,ProductVariant[]>()
    for(const{variant}of fits){
      const color=(colorTitle&&variant?.values[colorTitle])||''
      groups.set(color,[...(groups.get(color)??[]),...(variant?[variant]:[])])
    }
    const standard=product.variants?.find(variant=>variant.sku===product.defaultVariant)
    const standardColor=(colorTitle&&standard?.values[colorTitle])||''
    const ordered=[...groups].sort(([a],[b])=>Number(b===standardColor)-Number(a===standardColor))
    return ordered.map(([,variants])=>{
      if(!variants.length)return{product,choices:1}
      const cheapest=variants.reduce((best,variant)=>variant.price<best.price?variant:best)
      return{product,variant:cheapest,choices:variants.length}
    })
  })
}

/** Unieke sleutel voor een kaart: product plus uitvoering. */
export const matchKey=(match:Match)=>`${match.product.id}:${match.variant?.sku??''}`

/** De prijs van een match, voor sorteren. */
export const matchPrice=(match:Match)=>match.variant?.price??match.product.price

const months=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
const specValue=(product:Product,label:string)=>product.specGroups?.flatMap(group=>group.specs).find(([name])=>name===label)?.[1]

/** Hoe nieuw een iPhone-toestel is, als maandnummer van de introductie; hoesjes, opladers en andere accessoires tellen niet mee.
 * We gebruiken de introductiedatum uit de specificaties, zodat ook toestellen zonder nummer (zoals de iPhone Duo) goed vallen.
 * Zonder datum leiden we die af uit het modelnummer ("iPhone 18" → september 2026). Bij een gelijke datum gaat een toestel dat
 * pas binnenkort leverbaar is voor, want dat is de nieuwste uitvoering. */
const iPhoneRecency=(product:Product)=>{
  if(!/iphone/i.test(product.name)||/hoes|case|screenprotector|glas|oplader|kabel|adapter/i.test(product.name))return 0
  const year=Number(specValue(product,'Introductiejaar'))
  const month=months.indexOf((specValue(product,'Introductiemaand')??'').toLowerCase())
  const generation=Number(/iphone\s*(\d{1,2})/i.exec(product.name)?.[1]??0)
  const introduced=year?year*12+Math.max(month,0):generation?(2008+generation)*12+8:1
  return introduced+(/^leverbaar vanaf/i.test(product.stock)?0.5:0)
}

/** Standaardvolgorde: de nieuwste iPhones eerst (iPhone Duo en 18, dan 17, dan 16 enzovoort), daarna de rest in de bestaande volgorde. */
export const newestIPhonesFirst=(matches:Match[])=>[...matches].sort((a,b)=>iPhoneRecency(b.product)-iPhoneRecency(a.product))
