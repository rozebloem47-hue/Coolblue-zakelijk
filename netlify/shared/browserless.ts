/**
 * Koppeling met Browserless (browserless.io), de api voor headless Chrome.
 *
 * Het API-token staat in Netlify Blobs (of in BROWSERLESS_API_KEY) en komt nooit
 * in een antwoord of logregel terecht. De instellingen staan als eigen rij in de
 * tabel integrations, met alleen de laatste vier tekens van het token.
 */
import{getStore}from'@netlify/blobs'
import{chromium,type Browser}from'playwright-core'
import{eq}from'drizzle-orm'
import{db}from'../../db/index.js'
import{integrations}from'../../db/schema.js'

export const BROWSERLESS='browserless'
export const BROWSERLESS_REGIONS=[
  {url:'https://production-sfo.browserless.io',label:'San Francisco (VS)'},
  {url:'https://production-lon.browserless.io',label:'Londen (VK)'},
  {url:'https://production-ams.browserless.io',label:'Amsterdam (NL)'},
]
const DEFAULT_URL=BROWSERLESS_REGIONS[2].url
const KEY='browserless-api-key'
const store=()=>getStore({name:'integrations',consistency:'strong'})

type Row=typeof integrations.$inferSelect

async function settings():Promise<Row>{
  const[row]=await db.select().from(integrations).where(eq(integrations.provider,BROWSERLESS)).limit(1)
  if(row)return row
  const[created]=await db.insert(integrations).values({provider:BROWSERLESS,baseUrl:DEFAULT_URL,invoicePath:''}).onConflictDoNothing().returning()
  if(created)return created
  const[existing]=await db.select().from(integrations).where(eq(integrations.provider,BROWSERLESS)).limit(1)
  return existing
}

const update=(values:Partial<Row>)=>db.update(integrations).set({...values,updatedAt:new Date()}).where(eq(integrations.provider,BROWSERLESS))

const envKey=()=>process.env.BROWSERLESS_API_KEY?.trim()||''

/** Het token zelf. Gebruik dit alleen om een verzoek aan Browserless te doen. */
export async function browserlessToken(){
  return envKey()||await store().get(KEY,{type:'text'}).catch(()=>null)||''
}

/** Wat het beheer mag zien: waar het token vandaan komt, de laatste tekens en de laatste controle. */
export async function browserlessStatus(){
  const row=await settings()
  const stored=Boolean(await store().get(KEY,{type:'text'}).catch(()=>null))
  return {
    source:envKey()?'omgeving':stored?'beheer':'geen' as 'omgeving'|'beheer'|'geen',
    keyLast4:row.keyLast4,
    keyUpdatedAt:row.keyUpdatedAt,
    baseUrl:row.baseUrl,
    active:row.active,
    lastCheckAt:row.lastCheckAt,
    lastCheckOk:row.lastCheckOk,
    lastCheckMessage:row.lastCheckMessage,
    regions:BROWSERLESS_REGIONS,
  }
}

export async function saveBrowserless({token,baseUrl,active}:{token?:string;baseUrl:string;active:boolean}){
  await settings()
  await update({baseUrl,active})
  if(token){
    await store().set(KEY,token)
    await update({keyLast4:token.slice(-4),keyUpdatedAt:new Date(),lastCheckOk:null,lastCheckMessage:null})
  }
}

export async function removeBrowserlessToken(){
  await store().delete(KEY)
  await update({keyLast4:null,keyUpdatedAt:null,active:false,lastCheckOk:null,lastCheckMessage:null})
}

/** Vraagt de versie-informatie van Browserless op (/meta); dat kost geen browsersessie en weigert een ongeldig token met 401. */
export async function testBrowserless(){
  const row=await settings()
  const token=await browserlessToken()
  if(!token)return {ok:false,message:'Er is nog geen API-token opgeslagen.'}
  let result:{ok:boolean;message:string}
  try{
    const response=await fetch(`${row.baseUrl.replace(/\/$/,'')}/meta?token=${encodeURIComponent(token)}`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)})
    if(response.status===401||response.status===403)result={ok:false,message:`Browserless weigert het token (status ${response.status}).`}
    else if(response.status===429)result={ok:false,message:'Het token werkt, maar je tegoed of limiet bij Browserless is bereikt.'}
    else if(!response.ok)result={ok:false,message:`Browserless antwoordde met status ${response.status}.`}
    else result={ok:true,message:'Verbinding met Browserless in orde.'}
  }catch(error){
    result={ok:false,message:`Browserless was niet bereikbaar: ${String(error instanceof Error?error.message:error).slice(0,160)}`}
  }
  await update({lastCheckAt:new Date(),lastCheckOk:result.ok,lastCheckMessage:result.message})
  return result
}

/**
 * Opent een Chrome-sessie bij Browserless via Playwright, in de gekozen regio en
 * met het bewaarde token. Sluit de browser na gebruik met browser.close(); een
 * open sessie verbruikt tegoed.
 */
export async function connectBrowserless(){
  const row=await settings()
  const token=await browserlessToken()
  if(!token)throw new Error('Er is nog geen API-token van Browserless opgeslagen.')
  if(!row.active)throw new Error('De koppeling met Browserless staat uit.')
  const endpoint=`${row.baseUrl.replace(/\/$/,'').replace(/^https:/,'wss:')}/chromium/playwright?token=${encodeURIComponent(token)}`
  const browser=await chromium.connect(endpoint)
  return browser
}


/**
 * Opent de bunq.me-link in Browserless, wacht tot bunq doorverwijst naar iDEAL
 * en geeft die pagina terug. Lukt dat niet binnen de tijd, dan krijg je null
 * en blijft de gewone link gelden. Een open sessie verbruikt tegoed, dus de
 * browser gaat altijd dicht.
 */
/**
 * Opent de bunq.me-link in Browserless, wacht tot bunq doorverwijst naar iDEAL
 * en geeft die pagina terug. Lukt dat niet binnen de tijd, dan krijg je null
 * en blijft de gewone link gelden. Schrijft op waar hij naartoe gaat, zodat we
 * zien waarom het niet lukt. Een open sessie verbruikt tegoed, dus de browser
 * gaat altijd dicht.
 */
export async function resolveIdealUrl(startUrl:string,maxMs=8000):Promise<string|null>{
  const session:{browser?:Browser;page?:any}={}
  const begin=Date.now()
  const log=(text:string)=>console.log(`[browserless +${Date.now()-begin}ms] ${text}`)
  // Alleen adres en pad, nooit de rest van de link.
  const safe=(value:string)=>{try{const url=new URL(value);return url.hostname+url.pathname}catch{return 'onbekend'}}
  const work=async()=>{
    session.browser=await connectBrowserless()
    log('verbonden met Browserless')
    session.page=await session.browser.newPage()
    const page=session.page
    page.on('framenavigated',(frame:any)=>{if(frame===page.mainFrame())log('pagina: '+safe(frame.url()))})
    await page.goto(startUrl,{waitUntil:'domcontentloaded',timeout:maxMs})
    log('eerste pagina geladen')
    await page.waitForURL((url:URL)=>!/bunq/i.test(url.hostname),{timeout:maxMs})
    log('doorverwezen naar: '+safe(page.url()))
    return page.url() as string
  }
  try{
    const result=await Promise.race([
      work().catch(error=>{log('fout: '+String(error instanceof Error?error.message:error).slice(0,200));return null}),
      new Promise<null>(resolve=>setTimeout(()=>{log('tijd om');resolve(null)},maxMs)),
    ])
    if(!result&&session.page){
      const title=await session.page.title().catch(()=>'')
      const content=await session.page.evaluate(()=>document.body?.innerText?.slice(0,300)).catch(()=>'')
      log('titel: '+title)
      log('tekst op de pagina: '+String(content).replace(/\s+/g,' '))
    }
    return result
  }finally{
    await session.browser?.close().catch(()=>{})
  }
}
  try{
    return await Promise.race([
      work().catch(()=>null),
      new Promise<null>(resolve=>setTimeout(()=>resolve(null),maxMs)),
    ])
  }finally{
    await session.browser?.close().catch(()=>{})
  }
}