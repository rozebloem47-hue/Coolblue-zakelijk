/**
 * Producten beheren: een Coolblue-productpagina uitlezen, producten opslaan,
 * prijzen aanpassen, tonen of verbergen en verwijderen. Alle prijzen die hier
 * binnenkomen zijn inclusief 21% btw; de prijs exclusief btw rekenen we overal
 * zelf uit.
 */
import type{Config}from'@netlify/functions'
import{desc,eq,inArray,or,sql}from'drizzle-orm'
import{db}from'../../db/index.js'
import{catalogProducts}from'../../db/schema.js'
import{withAdmin}from'../shared/admin.js'
import{importCoolblue}from'../shared/coolblue.js'
import{catalogSlug,parseEuro as euro,placementFor,validPlacement,type SpecGroup,type StoredVariant}from'../../src/data/imported-products.js'

const text=(value:unknown,max=200)=>String(value??'').trim().slice(0,max)
const optional=(value:unknown,max=200)=>text(value,max)||null

/** Prijs en was-prijs controleren. Geeft een foutmelding of de bedragen als tekst voor de database. */
const prices=(priceInput:unknown,listInput:unknown)=>{
  const price=euro(priceInput)
  if(price==null||price<=0||price>1_000_000)return{error:'Vul een geldige prijs inclusief btw in, bijvoorbeeld 1.299,00.'}
  const hasList=String(listInput??'').trim()!==''&&listInput!=null
  const listPrice=hasList?euro(listInput):null
  if(hasList&&(listPrice==null||listPrice<=0))return{error:'Vul een geldige was-prijs in, of laat het veld leeg.'}
  if(listPrice!=null&&listPrice<=price)return{error:'De was-prijs moet hoger zijn dan de prijs. Laat het veld leeg als er geen korting is.'}
  return{price:price.toFixed(2),listPrice:listPrice==null?null:listPrice.toFixed(2)}
}

const specGroups=(value:unknown):SpecGroup[]=>Array.isArray(value)?value.slice(0,80).map(group=>({
  title:text(group?.title,120)||'Specificaties',
  specs:(Array.isArray(group?.specs)?group.specs:[]).slice(0,200).map((spec:unknown)=>Array.isArray(spec)?[text(spec[0],160),text(spec[1],600)] as [string,string]:null).filter((spec:[string,string]|null):spec is[string,string]=>Boolean(spec&&spec[0]&&spec[1])),
})).filter(group=>group.specs.length):[]

/** Beeldnummers van Coolblue: alleen cijfers, zonder dubbele. */
const imageIds=(value:unknown)=>Array.isArray(value)?[...new Set(value.map(id=>String(id??'').trim()).filter(id=>/^\d{1,15}$/.test(id)))].slice(0,40):[]

/**
 * Keuzes en uitvoeringen controleren. Elke uitvoering heeft voor elke keuze
 * een waarde en een eigen prijs inclusief btw. Keuzes die niemand meer gebruikt
 * vallen weg. Zonder minstens twee uitvoeringen heeft het product geen varianten.
 */
/** Specificaties die bij één uitvoering afwijken, als [label, waarde]-paren. */
const variantSpecs=(value:unknown):[string,string][]|undefined=>{
  if(!Array.isArray(value))return undefined
  const pairs=value.filter(pair=>Array.isArray(pair)).map(pair=>[text(pair[0],120),text(pair[1],300)] as [string,string]).filter(([label,spec])=>label&&spec).slice(0,200)
  return pairs.length?pairs:undefined
}

const variantData=(optionsInput:unknown,variantsInput:unknown,sourceSku:string|null,money:{price:string;listPrice:string|null},previous:StoredVariant[]=[]):{variantOptions:{title:string;type:'color'|'choice';values:string[]}[];variants:StoredVariant[]}|{error:string}=>{
  const none={variantOptions:[],variants:[]}
  if(!Array.isArray(optionsInput)||!Array.isArray(variantsInput))return none
  const options=optionsInput.slice(0,4).map(option=>({title:text(option?.title,60),type:option?.type==='color'?'color' as const:'choice' as const,values:(Array.isArray(option?.values)?option.values:[]).map((value:unknown)=>text(value,60)).filter(Boolean).slice(0,40) as string[]})).filter(option=>option.title&&option.values.length)
  const variants:StoredVariant[]=[]
  const seen=new Set<string>()
  for(const input of variantsInput.slice(0,120)){
    const sku=text(input?.sku,20)
    if(!/^\d{1,15}$/.test(sku)||seen.has(sku))continue
    const values=Object.fromEntries(options.map(option=>[option.title,text(input?.values?.[option.title],60)]))
    if(options.some(option=>!option.values.includes(values[option.title])))continue
    const own=sku===sourceSku
    const variantMoney=own?money:prices(input?.price,input?.listPrice)
    if('error'in variantMoney)return{error:`${text(input?.name,120)||'Uitvoering'}: ${variantMoney.error}`}
    seen.add(sku)
    // Zonder meegestuurde specificaties blijven de eerder opgeslagen afwijkingen van deze uitvoering staan.
    const specs=variantSpecs(input?.specs)??previous.find(variant=>variant.sku===sku)?.specs
    variants.push({sku,name:text(input?.name,200),values,price:variantMoney.price,listPrice:variantMoney.listPrice,imageIds:imageIds(input?.imageIds),...(specs?{specs}:{})})
  }
  const used=options.map(option=>({...option,values:option.values.filter(value=>variants.some(variant=>variant.values[option.title]===value))})).filter(option=>option.values.length>1)
  if(!used.length||variants.length<2)return none
  return{variantOptions:used,variants:variants.map(variant=>({...variant,values:Object.fromEntries(used.map(option=>[option.title,variant.values[option.title]]))}))}
}

const bullets=(value:unknown)=>(Array.isArray(value)?value:String(value??'').split('\n')).map(item=>text(item,200)).filter(Boolean).slice(0,8)

/** Een url-naam die nog niet bestaat. */
const freeSlug=async(name:string,suffix:string|null)=>{
  const base=catalogSlug(name,suffix??undefined)||`product-${Date.now()}`
  for(let attempt=0;attempt<20;attempt++){
    const slug=attempt?`${base}-${attempt+1}`:base
    const[taken]=await db.select({id:catalogProducts.id}).from(catalogProducts).where(eq(catalogProducts.slug,slug)).limit(1)
    if(!taken)return slug
  }
  return `${base}-${Date.now()}`
}

const findRow=async(id:unknown)=>{
  const number=Number(id)
  if(!Number.isInteger(number)||number<=0)return null
  const[row]=await db.select().from(catalogProducts).where(eq(catalogProducts.id,number)).limit(1)
  return row??null
}

export default async(req:Request)=>withAdmin(req,async()=>{
  if(req.method==='GET'){
    const rows=await db.select().from(catalogProducts).orderBy(desc(catalogProducts.createdAt))
    return Response.json({products:rows})
  }
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  const body=await req.json().catch(()=>({}))as Record<string,any>
  const action=String(body.action??'')

  if(action==='fetch'){
    try{
      const source=await importCoolblue(body.url)
      // Een andere kleur of opslag van een product dat al in de winkel staat, telt ook als bestaand.
      const skus=[...new Set([source.sourceSku,...source.variants.map(variant=>variant.sku)])]
      const[existing]=await db.select({id:catalogProducts.id,name:catalogProducts.name}).from(catalogProducts).where(or(inArray(catalogProducts.sourceSku,skus),...skus.map(sku=>sql`${catalogProducts.variants} @> ${JSON.stringify([{sku}])}::jsonb`))).limit(1)
      const place=placementFor(source.breadcrumbs,source.productType,source.name)
      const specCount=source.specGroups.reduce((sum,group)=>sum+group.specs.length,0)
      const photoCount=source.imageIds.length
      const choices=source.variantOptions.map(option=>`${option.values.length} ${option.title.toLowerCase()}`).join(' en ')
      return Response.json({
        ok:true,
        draft:{...source,...place},
        existing:existing??null,
        message:`${source.name} opgehaald: ${photoCount} ${photoCount===1?'foto':"foto's"} en ${specCount} specificaties in ${source.specGroups.length} groepen${source.variants.length?`, plus ${source.variants.length} uitvoeringen (${choices})`:''}. Controleer de gegevens en voeg het product toe.`,
      })
    }catch(error){
      return Response.json({error:error instanceof Error?error.message:'De pagina kon niet worden uitgelezen.'},{status:422})
    }
  }

  if(action==='save'){
    const input=body.product??{}
    const name=text(input.name,200)
    const brand=text(input.brand,80)
    if(!name||!brand)return Response.json({error:'Vul in elk geval de naam en het merk in.'},{status:400})
    const place={category:text(input.category,80),collection:text(input.collection,120),subcategory:text(input.subcategory,120)}
    if(!validPlacement(place))return Response.json({error:'Kies een collectie uit het menu van de winkel.'},{status:400})
    const money=prices(input.price,input.listPrice)
    if('error'in money)return Response.json({error:money.error},{status:400})
    const existing=input.id?await findRow(input.id):null
    if(input.id&&!existing)return Response.json({error:'Dit product bestaat niet meer.'},{status:404})
    // Bij bijwerken vanaf een nieuwe Coolblue-link wordt die link het bronartikel en dus de standaarduitvoering.
    const sourceSku=optional(input.sourceSku,20)??existing?.sourceSku??null
    const variants=variantData(input.variantOptions,input.variants,sourceSku,money,(existing?.variants as StoredVariant[]|undefined)??[])
    if('error'in variants)return Response.json({error:variants.error},{status:400})
    if(variants.variants.length&&!variants.variants.some(variant=>variant.sku===sourceSku))return Response.json({error:'De standaarduitvoering hoort bij de prijs hierboven en kan niet worden weggehaald.'},{status:400})
    const values={
      name,brand,...place,
      series:optional(input.series,120),
      colorName:optional(input.colorName,80),
      description:text(input.description,6000),
      bullets:bullets(input.bullets),
      price:money.price,
      listPrice:money.listPrice,
      stock:optional(input.stock,80),
      active:input.active!==false,
      ...(Array.isArray(input.variants)?variants:{}),
      ...(existing&&sourceSku?{sourceSku,sourceUrl:optional(input.sourceUrl,400)??existing.sourceUrl}:{}),
      updatedAt:new Date(),
    }
    if(existing){
      const photos=imageIds(input.imageIds)
      // Een lege lijst laat de bestaande foto staan; oudere producten hebben alleen `imageId`.
      await db.update(catalogProducts).set({...values,...(Array.isArray(input.specGroups)?{specGroups:specGroups(input.specGroups)}:{}),...(photos.length?{imageIds:photos,imageId:photos[0]}:{})}).where(eq(catalogProducts.id,existing.id))
      return Response.json({ok:true,message:`${name} is bijgewerkt.`})
    }
    const photos=imageIds(Array.isArray(input.imageIds)&&input.imageIds.length?input.imageIds:[input.imageId])
    const[created]=await db.insert(catalogProducts).values({
      ...values,
      slug:await freeSlug(name,sourceSku),
      specGroups:specGroups(input.specGroups),
      imageId:photos[0]??null,
      imageIds:photos,
      sourceUrl:optional(input.sourceUrl,400),
      sourceSku,
      rating:Number(input.rating)>0&&Number(input.rating)<=5?String(Number(input.rating)):null,
      reviews:Number.isInteger(Number(input.reviews))&&Number(input.reviews)>=0?Number(input.reviews):null,
    }).returning()
    return Response.json({ok:true,slug:created.slug,message:`${name} staat nu in de winkel.`})
  }

  const row=await findRow(body.id)
  if(!row)return Response.json({error:'Dit product bestaat niet (meer).'},{status:404})

  if(action==='price'){
    const money=prices(body.price,body.listPrice)
    if('error'in money)return Response.json({error:money.error},{status:400})
    // De standaarduitvoering hoort bij de prijs van het product.
    const variants=(row.variants??[]).map(variant=>variant.sku===row.sourceSku?{...variant,...money}:variant)
    await db.update(catalogProducts).set({price:money.price,listPrice:money.listPrice,variants,updatedAt:new Date()}).where(eq(catalogProducts.id,row.id))
    return Response.json({ok:true,message:`Prijs van ${row.name} bijgewerkt.`})
  }

  if(action==='toggle'){
    const active=body.active===true
    await db.update(catalogProducts).set({active,updatedAt:new Date()}).where(eq(catalogProducts.id,row.id))
    return Response.json({ok:true,message:active?`${row.name} staat weer in de winkel.`:`${row.name} is verborgen in de winkel.`})
  }

  if(action==='delete'){
    await db.delete(catalogProducts).where(eq(catalogProducts.id,row.id))
    return Response.json({ok:true,message:`${row.name} is verwijderd.`})
  }

  return Response.json({error:'Onbekende actie.'},{status:400})
})

export const config:Config={path:'/api/admin-products'}
