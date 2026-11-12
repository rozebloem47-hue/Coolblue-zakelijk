/**
 * Koppeling met de FINOM-bankapi voor facturen.
 *
 * De API-sleutel staat in Netlify Blobs en komt nooit in de repository, in een
 * antwoord of in een logregel terecht. In de database bewaren we alleen de
 * laatste vier tekens en de instellingen van de koppeling, zodat de beheerder
 * kan zien welke sleutel actief is.
 */
import{getStore}from'@netlify/blobs'
import{eq}from'drizzle-orm'
import{db}from'../../db/index.js'
import{integrations}from'../../db/schema.js'

export const PROVIDER='finom'
const STORE='integrations'
const KEY='finom-api-key'
const store=()=>getStore({name:STORE,consistency:'strong'})

export type Integration=typeof integrations.$inferSelect

/** De instellingen van de koppeling; bij een eerste bezoek zetten we de standaardrij klaar. */
export async function integrationSettings():Promise<Integration>{
  const[row]=await db.select().from(integrations).where(eq(integrations.provider,PROVIDER)).limit(1)
  if(row)return row
  const[created]=await db.insert(integrations).values({provider:PROVIDER}).onConflictDoNothing().returning()
  if(created)return created
  const[existing]=await db.select().from(integrations).where(eq(integrations.provider,PROVIDER)).limit(1)
  return existing
}

export async function saveApiKey(key:string){
  await store().set(KEY,key)
  const last4=key.slice(-4)
  await integrationSettings()
  await db.update(integrations).set({keyLast4:last4,keyUpdatedAt:new Date(),active:true,updatedAt:new Date()}).where(eq(integrations.provider,PROVIDER))
}

export async function removeApiKey(){
  await store().delete(KEY)
  await db.update(integrations).set({keyLast4:null,keyUpdatedAt:null,active:false,lastCheckOk:null,lastCheckMessage:null,updatedAt:new Date()}).where(eq(integrations.provider,PROVIDER))
}

/** De sleutel zelf. Gebruik dit alleen om een verzoek aan FINOM te ondertekenen. */
async function apiKey(){
  const stored=await store().get(KEY,{type:'text'}).catch(()=>null)
  return stored||process.env.FINOM_API_KEY||''
}

export const hasApiKey=async()=>Boolean(await apiKey())

export type InvoiceCustomer={companyName?:string|null;firstName?:string|null;lastName?:string|null;email:string;phone?:string|null;kvk?:string|null;vatNumber?:string|null;street?:string|null;houseNumber?:string|null;postalCode?:string|null;city?:string|null;country?:string|null;reference?:string|null}
export type InvoiceLine={name:string;quantity:number;unitPrice:number}
export type InvoiceDraft={orderNumber:string;customer:InvoiceCustomer;lines:InvoiceLine[];total:number;discount?:number;notes?:string|null}
export type InvoiceResult={ok:boolean;status:string;externalId?:string;number?:string;pdfUrl?:string;dueDate?:Date;error?:string}

const addressOf=(customer:InvoiceCustomer)=>({
  street:[customer.street,customer.houseNumber].filter(Boolean).join(' ')||undefined,
  postalCode:customer.postalCode||undefined,
  city:customer.city||undefined,
  country:customer.country||'Nederland',
})

/** Het factuurverzoek zoals FINOM het verwacht: klantgegevens uit de checkout en regels met btw. */
const payloadFor=(draft:InvoiceDraft,settings:Integration,dueDate:Date)=>({
  currency:'EUR',
  invoiceDate:new Date().toISOString().slice(0,10),
  dueDate:dueDate.toISOString().slice(0,10),
  reference:draft.customer.reference||draft.orderNumber,
  externalReference:draft.orderNumber,
  note:draft.notes||`Bestelling ${draft.orderNumber} bij ${settings.senderCompany||'VoltVoorraad'}.`,
  paymentTermDays:settings.paymentTermDays,
  sender:{
    company:settings.senderCompany||undefined,
    vatNumber:settings.senderVat||undefined,
    iban:settings.senderIban||undefined,
    address:settings.senderAddress||undefined,
  },
  customer:{
    name:draft.customer.companyName||[draft.customer.firstName,draft.customer.lastName].filter(Boolean).join(' '),
    contactName:[draft.customer.firstName,draft.customer.lastName].filter(Boolean).join(' ')||undefined,
    email:draft.customer.email,
    phone:draft.customer.phone||undefined,
    vatNumber:draft.customer.vatNumber||undefined,
    registrationNumber:draft.customer.kvk||undefined,
    address:addressOf(draft.customer),
  },
  lineItems:draft.lines.map(line=>({
    name:line.name,
    quantity:line.quantity,
    // FINOM rekent met bedragen exclusief btw en zet de btw er zelf bij.
    unitPrice:Math.round((line.unitPrice/1.21)*100)/100,
    vatRate:21,
  })),
  ...(draft.discount?{discount:{type:'fixed',amount:Math.round((draft.discount/1.21)*100)/100,description:'Ondernemerskorting'}}:{}),
  totalAmount:draft.total,
})

const pick=(source:Record<string,unknown>,...keys:string[])=>{
  for(const key of keys){const value=source?.[key];if(typeof value==='string'&&value)return value}
  return undefined
}

/** Netjes leesbaar houden en nooit een sleutel doorgeven in een foutmelding. */
const shortError=(text:string)=>text.replace(/\s+/g,' ').trim().slice(0,240)

/** Maakt een factuur aan bij FINOM voor het bedrag dat de klant afrekent. */
export async function createInvoice(draft:InvoiceDraft):Promise<InvoiceResult>{
  const settings=await integrationSettings()
  const key=await apiKey()
  const dueDate=new Date(Date.now()+settings.paymentTermDays*24*60*60*1000)
  if(!key)return {ok:false,status:'mislukt',dueDate,error:'Er is nog geen FINOM API-sleutel ingesteld.'}
  if(!settings.active)return {ok:false,status:'mislukt',dueDate,error:'De FINOM-koppeling staat uit.'}
  const url=`${settings.baseUrl.replace(/\/$/,'')}${settings.invoicePath.startsWith('/')?'':'/'}${settings.invoicePath}`
  try{
    const response=await fetch(url,{
      method:'POST',
      headers:{'X-API-Key':key,'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify(payloadFor(draft,settings,dueDate)),
      // De klant wacht op deze aanvraag voordat hij naar de betaling gaat; hangt FINOM, dan gaan we zonder factuur verder.
      signal:AbortSignal.timeout(10000),
    })
    const text=await response.text()
    if(!response.ok)return {ok:false,status:'mislukt',dueDate,error:`FINOM gaf status ${response.status}: ${shortError(text)}`}
    const body=(()=>{try{return JSON.parse(text)as Record<string,unknown>}catch{return {}as Record<string,unknown>}})()
    const data=(body.data&&typeof body.data==='object'?body.data as Record<string,unknown>:body)
    return {
      ok:true,
      status:pick(data,'status','state')||'verzonden',
      externalId:pick(data,'id','invoiceId','uuid'),
      number:pick(data,'number','invoiceNumber','documentNumber'),
      pdfUrl:pick(data,'pdfUrl','fileUrl','downloadUrl','publicUrl'),
      dueDate,
    }
  }catch(error){
    return {ok:false,status:'mislukt',dueDate,error:`FINOM was niet bereikbaar: ${shortError(String(error instanceof Error?error.message:error))}`}
  }
}

/** Test of de sleutel werkt, zonder een factuur te versturen. */
export async function testConnection(){
  const settings=await integrationSettings()
  const key=await apiKey()
  if(!key)return {ok:false,message:'Er is nog geen API-sleutel opgeslagen.'}
  const url=`${settings.baseUrl.replace(/\/$/,'')}${settings.invoicePath.startsWith('/')?'':'/'}${settings.invoicePath}`
  let result={ok:false,message:''}
  try{
    const response=await fetch(url,{method:'GET',headers:{'X-API-Key':key,accept:'application/json'}})
    if(response.status===401||response.status===403)result={ok:false,message:`FINOM weigert de sleutel (status ${response.status}).`}
    else if(response.status>=500)result={ok:false,message:`FINOM heeft een storing (status ${response.status}).`}
    else result={ok:true,message:`Verbinding in orde (status ${response.status}).`}
  }catch(error){
    result={ok:false,message:`FINOM was niet bereikbaar: ${shortError(String(error instanceof Error?error.message:error))}`}
  }
  await db.update(integrations).set({lastCheckAt:new Date(),lastCheckOk:result.ok,lastCheckMessage:result.message,updatedAt:new Date()}).where(eq(integrations.provider,PROVIDER))
  return result
}

/** Wat de beheerpagina mag zien: instellingen zonder de sleutel zelf. */
export const publicSettings=(settings:Integration)=>({
  provider:settings.provider,
  baseUrl:settings.baseUrl,
  invoicePath:settings.invoicePath,
  keyLast4:settings.keyLast4,
  keyUpdatedAt:settings.keyUpdatedAt,
  senderCompany:settings.senderCompany,
  senderVat:settings.senderVat,
  senderIban:settings.senderIban,
  senderAddress:settings.senderAddress,
  paymentTermDays:settings.paymentTermDays,
  autoCreate:settings.autoCreate,
  active:settings.active,
  lastCheckAt:settings.lastCheckAt,
  lastCheckOk:settings.lastCheckOk,
  lastCheckMessage:settings.lastCheckMessage,
})
