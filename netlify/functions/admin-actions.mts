/**
 * Handelingen in de beheeromgeving: de status van een order bijwerken en een
 * factuur (opnieuw) laten aanmaken bij FINOM.
 */
import type{Config}from'@netlify/functions'
import{desc,eq}from'drizzle-orm'
import{db}from'../../db/index.js'
import{invoices,orderItems,orders}from'../../db/schema.js'
import{withAdmin}from'../shared/admin.js'
import{createInvoice,integrationSettings}from'../shared/finom.js'

const STATUSES=['nieuw','gefactureerd','betaald','verzonden','geannuleerd','factuur mislukt']

export default async(req:Request)=>withAdmin(req,async()=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  const body=await req.json().catch(()=>({}))as Record<string,unknown>
  const action=String(body.action??'')
  const orderId=Number(body.orderId)
  if(!orderId)return Response.json({error:'Onbekende order.'},{status:400})
  const[order]=await db.select().from(orders).where(eq(orders.id,orderId)).limit(1)
  if(!order)return Response.json({error:'Deze order bestaat niet.'},{status:404})

  if(action==='order-status'){
    const status=String(body.status??'')
    if(!STATUSES.includes(status))return Response.json({error:'Onbekende status.'},{status:400})
    await db.update(orders).set({status}).where(eq(orders.id,orderId))
    return Response.json({ok:true,message:`Order ${order.orderNumber} staat nu op ${status}.`})
  }

  if(action==='invoice'){
    const settings=await integrationSettings()
    if(!settings.active)return Response.json({error:'Zet de FINOM-koppeling eerst aan.'},{status:400})
    const items=await db.select().from(orderItems).where(eq(orderItems.orderId,orderId))
    const result=await createInvoice({
      orderNumber:order.orderNumber,
      customer:order,
      lines:items.map(item=>({name:item.productName,quantity:item.quantity,unitPrice:Number(item.unitPrice)})),
      total:Number(order.total),
      discount:Number(order.discount??0),
      notes:order.notes,
    })
    const[existing]=await db.select().from(invoices).where(eq(invoices.orderId,orderId)).orderBy(desc(invoices.createdAt)).limit(1)
    const values={
      orderId,
      provider:settings.provider,
      externalId:result.externalId,
      number:result.number,
      status:result.ok?result.status:'mislukt',
      amount:String(order.total),
      pdfUrl:result.pdfUrl,
      dueDate:result.dueDate,
      error:result.error,
      updatedAt:new Date(),
    }
    if(existing&&existing.status==='mislukt')await db.update(invoices).set(values).where(eq(invoices.id,existing.id))
    else await db.insert(invoices).values(values)
    await db.update(orders).set({status:result.ok?'gefactureerd':'factuur mislukt'}).where(eq(orders.id,orderId))
    return Response.json(result.ok
      ?{ok:true,message:`Factuur ${result.number??''} aangemaakt voor order ${order.orderNumber}.`.replace('  ',' ')}
      :{error:result.error??'De factuur kon niet worden aangemaakt.'},{status:result.ok?200:502})
  }

  return Response.json({error:'Onbekende actie.'},{status:400})
})

export const config:Config={path:'/api/admin-actions'}
