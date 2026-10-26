/**
 * Beheertoegang met één wachtwoord. Wie het juiste wachtwoord invult krijgt een
 * ondertekend sessiecookie; elke beheerfunctie controleert alleen dat cookie.
 * Er zijn dus geen accounts, e-mailadressen of uitnodigingen nodig.
 *
 * Het wachtwoord staat niet als leesbare tekst in de repository: hier ligt
 * alleen de SHA-256-afdruk. Zet `ADMIN_PASSWORD` in de Netlify-omgeving om een
 * ander wachtwoord te gebruiken; die waarde gaat dan voor.
 */
import{createHash,createHmac,timingSafeEqual}from'node:crypto'

const PASSWORD_HASH='feff0f2082be5cfb7d6a857cb6a271c379d13741a6c501f583752ee86c8f0071'
const COOKIE='vv_admin'
const MAX_AGE=60*60*12

const sha256=(value:string)=>createHash('sha256').update(value,'utf8').digest('hex')
const same=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
/** De afdruk waarmee we vergelijken en waarmee we het cookie ondertekenen. */
const fingerprint=()=>{
  const override=process.env.ADMIN_PASSWORD?.trim()
  return override?sha256(override):PASSWORD_HASH
}

/** Klopt het ingevulde wachtwoord? */
export const passwordOk=(input:unknown)=>{
  const value=typeof input==='string'?input:''
  return value.length>0&&same(sha256(value),fingerprint())
}

const sign=(payload:string)=>createHmac('sha256',fingerprint()).update(payload).digest('hex')

/** Nieuw sessietoken: geldigheidsdatum plus ondertekening. */
const newToken=()=>{
  const expires=String(Date.now()+MAX_AGE*1000)
  return `${expires}.${sign(expires)}`
}

const tokenOk=(token:string|undefined)=>{
  if(!token)return false
  const[expires,signature]=token.split('.')
  if(!expires||!signature||!same(signature,sign(expires)))return false
  return Number(expires)>Date.now()
}

const cookie=(req:Request)=>Object.fromEntries((req.headers.get('cookie')??'').split(';').map(part=>{
  const index=part.indexOf('=')
  return index<0?['','']:[part.slice(0,index).trim(),decodeURIComponent(part.slice(index+1).trim())]
}))[COOKIE]

/** Is er een geldige beheersessie? */
export const isAdmin=(req:Request)=>tokenOk(cookie(req))

const setCookie=(value:string,maxAge:number)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`

/** Antwoord dat de sessie opent. */
export const openSession=(body:Record<string,unknown>)=>Response.json(body,{headers:{'Set-Cookie':setCookie(newToken(),MAX_AGE)}})

/** Antwoord dat de sessie sluit. */
export const closeSession=(body:Record<string,unknown>)=>Response.json(body,{headers:{'Set-Cookie':setCookie('',0)}})

/** Standaardantwoord voor wie niet is aangemeld. */
export const noAccess=()=>Response.json({error:'Geen toegang. Vul eerst het beheerwachtwoord in.'},{status:401})

/** Kleine helper zodat elke beheerfunctie op dezelfde manier begint. */
export async function withAdmin(req:Request,handler:()=>Promise<Response>):Promise<Response>{
  if(!isAdmin(req))return noAccess()
  return handler()
}
