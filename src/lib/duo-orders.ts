import{createServerFn}from'@tanstack/react-start'

export type DuoOrderNotice={name:string;product:string;expiresAt:number}
export const DUO_RECENT_MS=5*60*1000

/** Alleen de opgegeven voornamen worden openbaar getoond, bij een echte recente order. */
const names=['Lisa','Peter','Hamza','Arthur','Leco','Emir','Vincent','Yves']

export const getRecentDuoOrders=createServerFn({method:'GET'}).handler(async():Promise<DuoOrderNotice[]>=>{
  const[{db},{orders,orderItems},{and,desc,eq,inArray,sql}]=await Promise.all([
    import('../../db/index'),import('../../db/schema'),import('drizzle-orm'),
  ])
  const rows=await db.select({name:orders.firstName,product:orderItems.productName,createdAt:orders.createdAt})
    .from(orderItems).innerJoin(orders,eq(orderItems.orderId,orders.id))
    .where(and(
      sql`${orders.createdAt} > now() - interval '5 minutes'`,
      sql`${orders.createdAt} <= now()`,
      inArray(orders.firstName,names),
      inArray(orders.status,['nieuw','paid','betaald','gefactureerd','verzonden','afgerond']),
      sql`${orderItems.productName} ~* '^Apple iPhone Duo( |$)'`,
    ))
    .orderBy(desc(orders.createdAt)).limit(8)
  return rows.flatMap(row=>row.name&&row.createdAt?[{
    name:row.name,product:row.product.replace(/^Apple /,''),expiresAt:row.createdAt.getTime()+DUO_RECENT_MS,
  }]:[])
})
