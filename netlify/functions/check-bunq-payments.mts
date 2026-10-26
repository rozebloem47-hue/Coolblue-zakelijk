/**
 * Kijkt elke vijf minuten bij bunq of openstaande bunq.me-links zijn betaald.
 * Een betaalde order gaat op 'betaald'; orders die al verder zijn (verzonden,
 * geannuleerd) of ouder dan twee weken laten we met rust. De browser van de
 * klant telt nooit mee: alleen het antwoord van bunq bepaalt of er betaald is.
 */
import type{Config}from'@netlify/functions'
import{and,eq,gte,isNotNull,notInArray}from'drizzle-orm'
import{db}from'../../db/index.js'
import{orders}from'../../db/schema.js'
import{BunqNotConfiguredError,isBunqPaymentCompleted}from'../shared/bunq.js'

const DONE=['betaald','verzonden','geannuleerd']
const WINDOW_DAYS=14

export default async()=>{
  const since=new Date(Date.now()-WINDOW_DAYS*24*60*60*1000)
  const open=await db.select({id:orders.id,orderNumber:orders.orderNumber,tabId:orders.bunqTabId}).from(orders)
    .where(and(isNotNull(orders.bunqTabId),notInArray(orders.status,DONE),gte(orders.createdAt,since)))

  let paid=0
  for(const order of open){
    if(!order.tabId)continue
    try{
      if(!await isBunqPaymentCompleted(order.tabId))continue
      await db.update(orders).set({status:'betaald'}).where(eq(orders.id,order.id))
      paid++
    }catch(error){
      // Zonder sleutel valt er voor geen enkele order iets te controleren.
      if(error instanceof BunqNotConfiguredError)break
      console.error(`Controle van bunq-betaling voor order ${order.orderNumber} is mislukt:`,error instanceof Error?error.message:error)
    }
  }
  console.log(`bunq-controle afgerond: ${open.length} gecontroleerd, ${paid} betaald.`)
}

export const config:Config={schedule:'*/5 * * * *'}
