/**
 * Alle cijfers voor de beheeromgeving in één antwoord: bezoek, verkoop,
 * facturen, catalogus en de status van de koppelingen.
 */
import type{Config}from'@netlify/functions'
import{desc,eq,sql}from'drizzle-orm'
import{db}from'../../db/index.js'
import{catalogProducts,invoices,orderItems,orders,siteSettings,visitorEvents}from'../../db/schema.js'
import{withAdmin}from'../shared/admin.js'
import{integrationSettings,publicSettings}from'../shared/finom.js'
import{bunqStatus}from'../shared/bunq.js'
import{businessDiscountPercent,categories}from'../../src/data/products.js'
import{fromCatalogRow,type CatalogRow}from'../../src/data/imported-products.js'

/** Het actieve assortiment uit de database, per afdeling en met de grootste acties. */
const catalogSummary=async()=>{
  const rows=await db.select().from(catalogProducts).where(eq(catalogProducts.active,true))
  const products=rows.map(row=>fromCatalogRow(row as CatalogRow))
  const deals=products.filter(product=>product.dealPercent)
  const perDepartment=categories.map(category=>({
    slug:category.slug,
    name:category.name,
    products:products.filter(product=>product.category===category.slug).length,
    deals:deals.filter(product=>product.category===category.slug).length,
  })).sort((a,b)=>b.products-a.products)
  return {
    products:products.length,
    departments:categories.length,
    collections:categories.reduce((sum,category)=>sum+category.collections.length,0),
    items:categories.reduce((sum,category)=>sum+category.collections.reduce((count,collection)=>count+collection.items.length,0),0),
    brands:new Set(products.map(product=>product.brand)).size,
    deals:deals.length,
    dealShare:products.length?Math.round((deals.length/products.length)*100):0,
    averageDeal:deals.length?Math.round(deals.reduce((sum,product)=>sum+(product.dealPercent??0),0)/deals.length):0,
    businessDiscount:businessDiscountPercent,
    perDepartment,
    topDeals:[...deals].sort((a,b)=>(b.dealPercent??0)-(a.dealPercent??0)).slice(0,8).map(product=>({name:product.name,department:product.category,dealPercent:product.dealPercent,price:product.price,listPrice:product.listPrice})),
  }
}

const since=(days:number)=>sql`now() - interval '1 day' * ${days}`

export default async(req:Request)=>withAdmin(req,async()=>{
  const[[visits],[visits7],[visits30],[active]]=await Promise.all([
    db.select({views:sql<number>`count(*)::int`,sessions:sql<number>`count(distinct ${visitorEvents.sessionId})::int`}).from(visitorEvents).where(sql`${visitorEvents.createdAt} >= date_trunc('day', now())`),
    db.select({views:sql<number>`count(*)::int`,sessions:sql<number>`count(distinct ${visitorEvents.sessionId})::int`}).from(visitorEvents).where(sql`${visitorEvents.createdAt} >= ${since(7)}`),
    db.select({views:sql<number>`count(*)::int`,sessions:sql<number>`count(distinct ${visitorEvents.sessionId})::int`}).from(visitorEvents).where(sql`${visitorEvents.createdAt} >= ${since(30)}`),
    db.select({sessions:sql<number>`count(distinct ${visitorEvents.sessionId})::int`}).from(visitorEvents).where(sql`${visitorEvents.createdAt} >= now() - interval '5 minutes' and ${visitorEvents.isActive}`),
  ])

  const[[revenueToday],[revenue7],[revenue30],[revenueAll]]=await Promise.all([
    db.select({revenue:sql<string>`coalesce(sum(${orders.total}),0)`,count:sql<number>`count(*)::int`}).from(orders).where(sql`${orders.createdAt} >= date_trunc('day', now())`),
    db.select({revenue:sql<string>`coalesce(sum(${orders.total}),0)`,count:sql<number>`count(*)::int`}).from(orders).where(sql`${orders.createdAt} >= ${since(7)}`),
    db.select({revenue:sql<string>`coalesce(sum(${orders.total}),0)`,count:sql<number>`count(*)::int`}).from(orders).where(sql`${orders.createdAt} >= ${since(30)}`),
    db.select({revenue:sql<string>`coalesce(sum(${orders.total}),0)`,count:sql<number>`count(*)::int`}).from(orders),
  ])

  const[timeline,topPages,referrers,funnel,recentEvents,latestOrders,latestInvoices,invoiceStatus,topProducts,settingsRow,integration]=await Promise.all([
    db.select({day:sql<string>`to_char(date_trunc('day', ${visitorEvents.createdAt}),'YYYY-MM-DD')`,views:sql<number>`count(*)::int`,sessions:sql<number>`count(distinct ${visitorEvents.sessionId})::int`}).from(visitorEvents).where(sql`${visitorEvents.createdAt} >= ${since(13)}`).groupBy(sql`1`).orderBy(sql`1`),
    db.select({path:visitorEvents.path,views:sql<number>`count(*)::int`}).from(visitorEvents).where(sql`${visitorEvents.createdAt} >= ${since(30)}`).groupBy(visitorEvents.path).orderBy(desc(sql`count(*)`)).limit(8),
    db.select({referrer:sql<string>`coalesce(nullif(${visitorEvents.referrer},''),'direct')`,views:sql<number>`count(*)::int`}).from(visitorEvents).where(sql`${visitorEvents.createdAt} >= ${since(30)}`).groupBy(sql`1`).orderBy(desc(sql`count(*)`)).limit(6),
    db.select({eventType:visitorEvents.eventType,count:sql<number>`count(*)::int`}).from(visitorEvents).where(sql`${visitorEvents.createdAt} >= ${since(30)}`).groupBy(visitorEvents.eventType).orderBy(desc(sql`count(*)`)),
    db.select({id:visitorEvents.id,eventType:visitorEvents.eventType,path:visitorEvents.path,productId:visitorEvents.productId,referrer:visitorEvents.referrer,isActive:visitorEvents.isActive,createdAt:visitorEvents.createdAt}).from(visitorEvents).orderBy(desc(visitorEvents.createdAt)).limit(25),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(25),
    db.select({id:invoices.id,orderId:invoices.orderId,number:invoices.number,status:invoices.status,amount:invoices.amount,pdfUrl:invoices.pdfUrl,dueDate:invoices.dueDate,error:invoices.error,createdAt:invoices.createdAt,orderNumber:orders.orderNumber,companyName:orders.companyName,email:orders.email}).from(invoices).leftJoin(orders,eq(invoices.orderId,orders.id)).orderBy(desc(invoices.createdAt)).limit(25),
    db.select({status:invoices.status,count:sql<number>`count(*)::int`,amount:sql<string>`coalesce(sum(${invoices.amount}),0)`}).from(invoices).groupBy(invoices.status),
    db.select({name:orderItems.productName,sold:sql<number>`sum(${orderItems.quantity})::int`,revenue:sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}),0)`}).from(orderItems).groupBy(orderItems.productName).orderBy(desc(sql`sum(${orderItems.quantity})`)).limit(8),
    db.select().from(siteSettings).limit(1),
    integrationSettings(),
  ])

  const orderCount=revenueAll.count
  const sessions30=visits30.sessions
  return Response.json({
    generatedAt:new Date().toISOString(),
    visits:{today:visits,week:visits7,month:visits30,active:active.sessions},
    revenue:{today:revenueToday,week:revenue7,month:revenue30,all:revenueAll,
      averageOrder:orderCount?Math.round((Number(revenueAll.revenue)/orderCount)*100)/100:0,
      conversion:sessions30?Math.round((revenue30.count/sessions30)*1000)/10:0},
    timeline,topPages,referrers,funnel,recentEvents,
    orders:latestOrders,
    invoices:latestInvoices,
    invoiceStatus,
    topProducts,
    catalog:await catalogSummary(),
    settings:settingsRow[0]??{siteName:'VoltVoorraad',tagline:null,supportEmail:null,supportPhone:null,logoKey:null},
    integration:publicSettings(integration),
    bunq:await bunqStatus(),
  })
})

export const config:Config={path:'/api/admin-data'}
