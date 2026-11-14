/**
 * Live stand van de winkel voor het beheerdashboard: tellers van vandaag en
 * het laatste halfuur, wie er nu actief is (apparaat en browser) en de nieuwste
 * gebeurtenissen. Met `after` komen alleen gebeurtenissen na dat nummer mee,
 * zodat elke ververs-ronde klein blijft, ook bij veel verkeer.
 */
import type{Config}from'@netlify/functions'
import{and,desc,gt,ne,sql}from'drizzle-orm'
import{db}from'../../db/index.js'
import{orders,visitorEvents}from'../../db/schema.js'
import{withAdmin}from'../shared/admin.js'

const today=sql`${visitorEvents.createdAt} >= date_trunc('day', now())`
const recent=sql`${visitorEvents.createdAt} >= now() - interval '30 minutes'`
const active=sql`${visitorEvents.createdAt} >= now() - interval '5 minutes'`
const countOf=(type:string,window:typeof today)=>sql<number>`count(*) filter (where ${visitorEvents.eventType} = ${type} and ${window})::int`
const sessionsOf=(type:string)=>sql<number>`count(distinct ${visitorEvents.sessionId}) filter (where ${visitorEvents.eventType} = ${type})::int`

/** De zware tellingen hoeven niet elke ververs-ronde opnieuw: een paar seconden oud is live genoeg. */
let cached:{at:number;value:Promise<Awaited<ReturnType<typeof summary>>>}|null=null
const CACHE_MS=8000
const summary=()=>Promise.all([
    db.select({
      addToCart:countOf('add_to_cart',today),
      addToCart30:countOf('add_to_cart',recent),
      removeFromCart:countOf('remove_from_cart',today),
      checkouts:countOf('begin_checkout',today),
      checkouts30:countOf('begin_checkout',recent),
      submits:countOf('checkout_submit',today),
      placed:countOf('order_placed',today),
      pageViews:countOf('page_view',today),
      pageViews30:countOf('page_view',recent),
      sessions:sql<number>`count(distinct ${visitorEvents.sessionId})::int`,
      cartSessions:sessionsOf('add_to_cart'),
      checkoutSessions:sessionsOf('begin_checkout'),
    }).from(visitorEvents).where(today),
    db.select({count:sql<number>`count(*)::int`,revenue:sql<string>`coalesce(sum(${orders.total}),0)`}).from(orders).where(sql`${orders.createdAt} >= date_trunc('day', now())`),
    // Per actieve sessie het laatste meetpunt: waar is die bezoeker nu, op welk apparaat, met welk mandje.
    db.selectDistinctOn([visitorEvents.sessionId],{sessionId:visitorEvents.sessionId,device:visitorEvents.device,browser:visitorEvents.browser,os:visitorEvents.os,path:visitorEvents.path,cartValue:visitorEvents.cartValue,isActive:visitorEvents.isActive}).from(visitorEvents).where(active).orderBy(visitorEvents.sessionId,desc(visitorEvents.createdAt)).limit(2000)
])
const latest=(after:number)=>db.select({id:visitorEvents.id,sessionId:visitorEvents.sessionId,eventType:visitorEvents.eventType,path:visitorEvents.path,productId:visitorEvents.productId,productName:visitorEvents.productName,referrer:visitorEvents.referrer,device:visitorEvents.device,browser:visitorEvents.browser,os:visitorEvents.os,cartValue:visitorEvents.cartValue,cartItems:visitorEvents.cartItems,createdAt:visitorEvents.createdAt})
  .from(visitorEvents)
  .where(and(gt(visitorEvents.id,after),ne(visitorEvents.eventType,'heartbeat'),sql`${visitorEvents.createdAt} >= now() - interval '1 day'`))
  .orderBy(desc(visitorEvents.id)).limit(after?100:40)

export default async(req:Request)=>withAdmin(req,async()=>{
  const after=Math.max(0,Number(new URL(req.url).searchParams.get('after'))||0)
  if(!cached||Date.now()-cached.at>CACHE_MS){cached={at:Date.now(),value:summary()};cached.value.catch(()=>{cached=null})}
  const[[[totals],[orderTotals],activeRows],events]=await Promise.all([cached.value,latest(after)])
  const now=activeRows.filter(row=>row.isActive)
  const tally=(key:'device'|'browser'|'os')=>Object.entries(now.reduce<Record<string,number>>((acc,row)=>{const k=row[key]??'Onbekend';acc[k]=(acc[k]??0)+1;return acc},{})).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count)
  const openCarts=now.filter(row=>Number(row.cartValue)>0)
  return Response.json({
    generatedAt:new Date().toISOString(),
    active:now.length,
    // Sessies die nu online zijn (laatste 5 minuten actief en niet vertrokken), voor het vastpinnen in de ticker.
    online:now.map(row=>row.sessionId),
    totals:{...totals,orders:orderTotals.count,revenue:orderTotals.revenue},
    openCarts:{count:openCarts.length,value:openCarts.reduce((sum,row)=>sum+Number(row.cartValue),0)},
    devices:tally('device'),browsers:tally('browser').slice(0,6),systems:tally('os').slice(0,6),
    events,
  },{headers:{'Cache-Control':'no-store'}})
})

export const config:Config={path:'/api/admin-live'}
