/**
 * Afrekenen op factuur. De winkelwagen komt van de client, maar de prijzen komen
 * altijd uit de catalogus op de server, zodat het bedrag op de factuur klopt.
 * Direct na het opslaan van de order maken we via FINOM de factuur aan, gericht
 * aan de gegevens die de klant bij de checkout heeft ingevuld.
 *
 * Na het opslaan gaat de klant direct naar de vaste bunq.me-betaalpagina
 * met het op de server berekende totaalbedrag en iDEAL als betaalmethode.
 */
import type{Config}from'@netlify/functions'
import{and,eq,inArray}from'drizzle-orm'
import{db}from'../../db/index.js'
import{catalogProducts,invoices,orderItems,orders}from'../../db/schema.js'
import{businessDiscount,exVat,priced,type Product}from'../../src/data/products.js'
import{IMPORTED_ID_OFFSET,fromCatalogRow,isImportedId,type CatalogRow}from'../../src/data/imported-products.js'
import{createInvoice,integrationSettings}from'../shared/finom.js'

type Line={productId:number;variant?:string;quantity:number}

const text=(value:unknown,max=120)=>String(value??'').trim().slice(0,max)
const money=(value:number)=>Math.round(value*100)/100
const orderNumber=()=>{
  const day=new Date().toISOString().slice(0,10).replaceAll('-','')
  return `VV-${day}-${String(Math.floor(Math.random()*9000)+1000)}`
}

export default async(req:Request)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  const body=await req.json().catch(()=>null)
  if(!body)return Response.json({error:'Ongeldige bestelling.'},{status:400})

  const email=text(body.email,160)
  if(!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email))return Response.json({error:'Vul een geldig e-mailadres in.'},{status:400})

  const requested:Line[]=Array.isArray(body.items)?body.items.map((line:Line)=>({productId:Number(line?.productId),variant:line?.variant?String(line.variant).slice(0,20):undefined,quantity:Math.min(Math.max(Number(line?.quantity)||1,1),99)})):[]
  // Het assortiment staat in de database; alleen actieve producten tellen mee.
  const importedIds=requested.filter(line=>isImportedId(line.productId)).map(line=>line.productId-IMPORTED_ID_OFFSET)
  const imported:Product[]=importedIds.length
    ?(await db.select().from(catalogProducts).where(and(inArray(catalogProducts.id,importedIds),eq(catalogProducts.active,true)))).map(row=>fromCatalogRow(row as CatalogRow))
    :[]
  const lines=requested.map(line=>{
    const product=imported.find(item=>item.id===line.productId)
    // De prijs van de gekozen uitvoering (kleur, opslag) komt ook uit de catalogus, nooit van de client.
    return product?{product,quantity:line.quantity,...priced(product,line.variant)}:null
  }).filter((line):line is{product:Product;quantity:number}&ReturnType<typeof priced>=>Boolean(line))
  if(!lines.length)return Response.json({error:'Je mandje is leeg.'},{status:400})

  const businessOrder=body.businessOrder!==false
  const subtotal=money(lines.reduce((sum,line)=>sum+line.price*line.quantity,0))
  const discount=businessOrder?money(subtotal*businessDiscount):0
  const total=money(subtotal-discount)
  const vatAmount=money(total-exVat(total))

  const customer={
    companyName:text(body.companyName)||null,
    firstName:text(body.firstName,60),
    lastName:text(body.lastName,60),
    email,
    phone:text(body.phone,40)||null,
    kvk:text(body.kvk,20)||null,
    vatNumber:text(body.vatNumber,20)||null,
    reference:text(body.reference,80)||null,
    street:text(body.street,120)||null,
    houseNumber:text(body.houseNumber,20)||null,
    postalCode:text(body.postalCode,12)||null,
    city:text(body.city,80)||null,
    country:text(body.country,60)||'Nederland',
    notes:text(body.notes,400)||null,
  }
  if(!customer.firstName||!customer.lastName||!customer.postalCode||!customer.houseNumber)return Response.json({error:'Vul je naam en bezorgadres in.'},{status:400})
  if(businessOrder&&!customer.companyName)return Response.json({error:'Vul de bedrijfsnaam in voor een zakelijke bestelling.'},{status:400})

  const paymentUrl=`https://bunq.me/bouwstoreov?amount=${total.toFixed(2)}&paymentMethod=IDEAL`
  const number=orderNumber()
  const[order]=await db.insert(orders).values({
    orderNumber:number,
    companyName:customer.companyName,
    email:customer.email,
    total:String(total),
    subtotal:String(subtotal),
    discount:String(discount),
    vatAmount:String(vatAmount),
    status:'nieuw',
    firstName:customer.firstName,
    lastName:customer.lastName,
    phone:customer.phone,
    kvk:customer.kvk,
    vatNumber:customer.vatNumber,
    reference:customer.reference,
    street:customer.street,
    houseNumber:customer.houseNumber,
    postalCode:customer.postalCode,
    city:customer.city,
    country:customer.country,
    paymentMethod:'bunq',
    bunqPaymentUrl:paymentUrl,
    businessOrder,
    notes:customer.notes,
  }).returning()

  await db.insert(orderItems).values(lines.map(line=>({
    orderId:order.id,
    productName:line.name,
    productId:line.product.id,
    quantity:line.quantity,
    unitPrice:String(money(line.price)),
  })))

  const settings=await integrationSettings()
  let invoice:{status:string;number?:string|null;pdfUrl?:string|null;error?:string|null}={status:'niet aangemaakt'}
  if(settings.autoCreate&&settings.active){
    const result=await createInvoice({
      orderNumber:number,
      customer,
      lines:lines.map(line=>({name:line.name,quantity:line.quantity,unitPrice:line.price})),
      total,
      discount,
      notes:customer.notes,
    })
    const[saved]=await db.insert(invoices).values({
      orderId:order.id,
      provider:settings.provider,
      externalId:result.externalId,
      number:result.number,
      status:result.ok?result.status:'mislukt',
      amount:String(total),
      pdfUrl:result.pdfUrl,
      dueDate:result.dueDate,
      error:result.error,
    }).returning()
    invoice={status:saved.status,number:saved.number,pdfUrl:saved.pdfUrl,error:saved.error}
    await db.update(orders).set({status:result.ok?'gefactureerd':'factuur mislukt'}).where(eq(orders.id,order.id))
  }

  return Response.json({
    ok:true,
    orderNumber:number,
    totals:{subtotal,discount,total,vatAmount},
    paymentMethod:'bunq',
    paymentUrl,
    paymentTermDays:settings.paymentTermDays,
    invoice,
  })
}

export const config:Config={path:'/api/checkout'}
