/**
 * Alle mandjes- en afrekenmomenten ooit, voor het beheeroverzicht "Interesse".
 * Per product: hoe vaak in een mandje gelegd, door hoeveel bezoekers, hoeveel
 * daarvan ermee naar afrekenen gingen en hoeveel er werkelijk besteld is.
 * Per bezoeker: wat die wilde, hoe ver die kwam en, als er een order uit
 * voortkwam, wie de klant is. Met `session` komt de volledige tijdlijn van één
 * bezoeker mee.
 */
import type{Config}from'@netlify/functions'
import{and,asc,eq,inArray,ne,sql}from'drizzle-orm'
import{db}from'../../db/index.js'
import{orderItems,orders,visitorEvents}from'../../db/schema.js'
import{withAdmin}from'../shared/admin.js'

type Line={name:string;quantity:number;price:number}
const INTEREST=['add_to_cart','remove_from_cart','begin_checkout','checkout_submit','order_placed']
const CHECKOUT=['begin_checkout','checkout_submit']
const PAGE=50
/** Tijdstempels zonder zone staan in UTC; als ISO-tekst met Z leest de browser ze goed. */
const iso=(value:ReturnType<typeof sql>)=>sql<string>`to_char(${value}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
const rowsOf=<T,>(result:unknown)=>((result as{rows?:T[]})?.rows??(result as T[]))

const type=visitorEvents.eventType
const interest=inArray(type,INTEREST)
const countType=(t:string)=>sql<number>`count(*) filter (where ${type} = ${t})::int`
const sessionsType=(t:string)=>sql<number>`count(distinct ${visitorEvents.sessionId}) filter (where ${type} = ${t})::int`

/** Tellingen en productoverzicht over de hele geschiedenis. */
const overview=async()=>{
  const[[totals],added,removed,checkoutLines,ordered]=await Promise.all([
    db.select({
      addToCart:countType('add_to_cart'),removeFromCart:countType('remove_from_cart'),checkouts:countType('begin_checkout'),submits:countType('checkout_submit'),placed:countType('order_placed'),
      cartSessions:sessionsType('add_to_cart'),checkoutSessions:sessionsType('begin_checkout'),submitSessions:sessionsType('checkout_submit'),orderSessions:sessionsType('order_placed'),
      since:iso(sql`min(${visitorEvents.createdAt})`),
    }).from(visitorEvents).where(interest),
    db.select({name:visitorEvents.productName,count:sql<number>`count(*)::int`,sessions:sql<number>`count(distinct ${visitorEvents.sessionId})::int`,last:iso(sql`max(${visitorEvents.createdAt})`)})
      .from(visitorEvents).where(and(eq(type,'add_to_cart'),sql`${visitorEvents.productName} is not null`)).groupBy(visitorEvents.productName),
    db.select({name:visitorEvents.productName,count:sql<number>`count(*)::int`})
      .from(visitorEvents).where(and(eq(type,'remove_from_cart'),sql`${visitorEvents.productName} is not null`)).groupBy(visitorEvents.productName),
    db.execute(sql`select line->>'name' as name, e.event_type as type, count(distinct e.session_id)::int as sessions
      from visitor_events e cross join lateral jsonb_array_elements(case when jsonb_typeof(e.cart_lines) = 'array' then e.cart_lines else '[]'::jsonb end) as line
      where e.event_type in ('begin_checkout','checkout_submit') group by 1, 2`),
    db.select({name:orderItems.productName,quantity:sql<number>`sum(${orderItems.quantity})::int`,orders:sql<number>`count(distinct ${orderItems.orderId})::int`})
      .from(orderItems).groupBy(orderItems.productName),
  ])
  const products=new Map<string,{name:string;added:number;visitors:number;removed:number;checkoutVisitors:number;submitVisitors:number;ordered:number;orders:number;last:string|null}>()
  const row=(name:string)=>{let item=products.get(name);if(!item){item={name,added:0,visitors:0,removed:0,checkoutVisitors:0,submitVisitors:0,ordered:0,orders:0,last:null};products.set(name,item)}return item}
  for(const item of added){const r=row(item.name!);r.added=item.count;r.visitors=item.sessions;r.last=item.last}
  for(const item of removed)row(item.name!).removed=item.count
  for(const item of rowsOf<{name:string|null;type:string;sessions:number}>(checkoutLines)){
    if(!item.name)continue
    const r=row(item.name)
    if(item.type==='begin_checkout')r.checkoutVisitors=Number(item.sessions);else r.submitVisitors=Number(item.sessions)
  }
  for(const item of ordered){const r=row(item.name);r.ordered=item.quantity;r.orders=item.orders}
  return{totals,products:[...products.values()].sort((a,b)=>b.visitors-a.visitors||b.checkoutVisitors-a.checkoutVisitors||b.added-a.added||b.ordered-a.ordered)}
}

const STAGES:Record<string,ReturnType<typeof sql>>={
  mandje:sql`count(*) filter (where ${type} = 'add_to_cart') > 0 and count(*) filter (where ${inArray(type,CHECKOUT)}) = 0`,
  checkout:sql`count(*) filter (where ${inArray(type,CHECKOUT)}) > 0`,
  afgehaakt:sql`count(*) filter (where ${inArray(type,CHECKOUT)}) > 0 and count(*) filter (where ${type} = 'order_placed') = 0`,
  besteld:sql`count(*) filter (where ${type} = 'order_placed') > 0`,
}

/** Bezoekers met minstens één mandjes- of afrekenmoment, nieuwste activiteit eerst. */
const visitors=async(stage:string,query:string,page:number)=>{
  const conditions=[STAGES[stage]??sql`true`]
  if(query){const like=`%${query.replace(/[\\%_]/g,m=>`\\${m}`)}%`;conditions.push(sql`bool_or(${visitorEvents.productName} ilike ${like} or ${visitorEvents.cartLines}::text ilike ${like})`)}
  const lastCheckout=sql`${inArray(type,CHECKOUT)} and ${visitorEvents.cartLines} is not null`
  const rows=await db.select({
    sessionId:visitorEvents.sessionId,
    first:iso(sql`min(${visitorEvents.createdAt})`),
    last:iso(sql`max(${visitorEvents.createdAt})`),
    device:sql<string|null>`max(${visitorEvents.device})`,
    browser:sql<string|null>`max(${visitorEvents.browser})`,
    os:sql<string|null>`max(${visitorEvents.os})`,
    added:countType('add_to_cart'),removed:countType('remove_from_cart'),checkouts:countType('begin_checkout'),submits:countType('checkout_submit'),
    products:sql<string[]|null>`array_agg(distinct ${visitorEvents.productName}) filter (where ${type} = 'add_to_cart' and ${visitorEvents.productName} is not null)`,
    orderNumbers:sql<string[]|null>`array_agg(distinct ${visitorEvents.productName}) filter (where ${type} = 'order_placed' and ${visitorEvents.productName} is not null)`,
    placed:countType('order_placed'),
    checkoutLines:sql<Line[]|null>`(array_agg(${visitorEvents.cartLines} order by ${visitorEvents.createdAt} desc) filter (where ${lastCheckout}))[1]`,
    checkoutValue:sql<string|null>`(array_agg(${visitorEvents.cartValue} order by ${visitorEvents.createdAt} desc) filter (where ${inArray(type,CHECKOUT)}))[1]`,
    total:sql<number>`(count(*) over ())::int`,
  }).from(visitorEvents).where(interest).groupBy(visitorEvents.sessionId)
    .having(sql.join(conditions,sql` and `))
    .orderBy(sql`max(${visitorEvents.createdAt}) desc`).limit(PAGE).offset(page*PAGE)
  const ids=rows.map(r=>r.sessionId)
  const numbers=rows.flatMap(r=>r.orderNumbers??[])
  const[sources,customers]=await Promise.all([
    ids.length?db.selectDistinctOn([visitorEvents.sessionId],{sessionId:visitorEvents.sessionId,referrer:visitorEvents.referrer,path:visitorEvents.path})
      .from(visitorEvents).where(and(eq(type,'page_view'),inArray(visitorEvents.sessionId,ids))).orderBy(visitorEvents.sessionId,asc(visitorEvents.createdAt)):[],
    numbers.length?db.select({orderNumber:orders.orderNumber,companyName:orders.companyName,firstName:orders.firstName,lastName:orders.lastName,email:orders.email,phone:orders.phone,city:orders.city,total:orders.total,status:orders.status})
      .from(orders).where(inArray(orders.orderNumber,numbers)):[],
  ])
  const source=new Map(sources.map(s=>[s.sessionId,s]))
  const customer=new Map(customers.map(c=>[c.orderNumber,c]))
  return{
    page,pageSize:PAGE,total:rows[0]?.total??0,
    visitors:rows.map(({total:_,orderNumbers,...r})=>({
      ...r,
      landing:source.get(r.sessionId)?.path??null,
      referrer:source.get(r.sessionId)?.referrer??null,
      orders:(orderNumbers??[]).map(number=>customer.get(number)??{orderNumber:number,companyName:null,firstName:null,lastName:null,email:null,phone:null,city:null,total:null,status:null}),
    })),
  }
}

/** Alle meetpunten van één bezoeker, behalve de hartslag, oudste eerst. */
const timeline=(sessionId:string)=>db.select({id:visitorEvents.id,eventType:visitorEvents.eventType,path:visitorEvents.path,productName:visitorEvents.productName,referrer:visitorEvents.referrer,cartValue:visitorEvents.cartValue,cartLines:visitorEvents.cartLines,createdAt:visitorEvents.createdAt})
  .from(visitorEvents).where(and(eq(visitorEvents.sessionId,sessionId),ne(type,'heartbeat'))).orderBy(asc(visitorEvents.createdAt)).limit(400)

export default async(req:Request)=>withAdmin(req,async()=>{
  const params=new URL(req.url).searchParams
  const session=params.get('session')?.slice(0,80)
  const headers={'Cache-Control':'no-store'}
  if(session)return Response.json({events:await timeline(session)},{headers})
  const stage=params.get('stage')??'alle'
  const query=(params.get('q')??'').trim().slice(0,100)
  const page=Math.min(1000,Math.max(0,Math.floor(Number(params.get('page'))||0)))
  const[summary,list]=await Promise.all([overview(),visitors(stage,query,page)])
  return Response.json({generatedAt:new Date().toISOString(),...summary,...list},{headers})
})

export const config:Config={path:'/api/admin-interest'}
