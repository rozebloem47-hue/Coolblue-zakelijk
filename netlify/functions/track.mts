/**
 * Ontvangt meetpunten uit de winkel. Bots en scripts worden hier al
 * weggefilterd, en per bezoeker en per IP-adres geldt een limiet, zodat een
 * golf nepverkeer de database niet volloopt. Antwoordt altijd snel en leeg.
 */
import type{Config,Context}from'@netlify/functions'
import{db}from'../../db/index.js'
import{visitorEvents}from'../../db/schema.js'
import{isBot,parseAgent}from'../shared/user-agent.js'

const EVENTS=new Set(['page_view','heartbeat','leave','add_to_cart','remove_from_cart','begin_checkout','checkout_submit','order_placed'])
const done=()=>new Response(null,{status:204})

/** Eenvoudige limiet per functie-instantie: genoeg om floods af te remmen zonder extra opslag. */
const buckets=new Map<string,{count:number;reset:number}>()
const allowed=(key:string,limit:number)=>{
  const now=Date.now()
  if(buckets.size>20000)for(const[k,v]of buckets)if(v.reset<now)buckets.delete(k)
  const bucket=buckets.get(key)
  if(!bucket||bucket.reset<now){buckets.set(key,{count:1,reset:now+60_000});return true}
  bucket.count++
  return bucket.count<=limit
}

const text=(value:unknown,max:number)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):null
const amount=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>=0&&n<10_000_000?n.toFixed(2):null}

export default async(req:Request,context:Context)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  if(Number(req.headers.get('content-length')??0)>4096)return done()
  const ua=req.headers.get('user-agent')??''
  if(isBot(ua))return done()
  let body:Record<string,unknown>
  try{body=JSON.parse((await req.text()).slice(0,4096))}catch{return done()}
  if(!body||typeof body!=='object'||body.automated)return done()
  const sessionId=text(body.sessionId,80)
  const eventType=text(body.eventType,40)
  if(!sessionId||!eventType||!EVENTS.has(eventType))return done()
  // Een echte bezoeker stuurt hooguit een handvol meetpunten per minuut.
  if(!allowed(`ip:${context.ip??'onbekend'}`,180)||!allowed(`s:${sessionId}`,60))return done()
  const agent=parseAgent(ua,{touch:Boolean(body.touch)})
  const productId=Number(body.productId)
  const cartItems=Number(body.cartItems)
  try{
    await db.insert(visitorEvents).values({
      sessionId,eventType,
      path:text(body.path,300)??'/',
      productId:Number.isInteger(productId)&&productId>0?productId:null,
      productName:text(body.productName,200),
      referrer:text(body.referrer,300),
      isActive:eventType!=='leave',
      device:agent.device,browser:agent.browser,os:agent.os,
      cartValue:amount(body.cartValue),
      cartItems:Number.isInteger(cartItems)&&cartItems>=0&&cartItems<1000?cartItems:null,
    })
  }catch(error){console.error('Meetpunt opslaan mislukt',error)}
  return done()
}

export const config:Config={path:'/api/track'}
