/**
 * Beheer van de FINOM-bankkoppeling. De API-sleutel gaat naar Netlify Blobs en
 * verlaat de server nooit meer; in het antwoord staan alleen de instellingen en
 * de laatste vier tekens van de sleutel.
 */
import type{Config}from'@netlify/functions'
import{eq}from'drizzle-orm'
import{db}from'../../db/index.js'
import{integrations}from'../../db/schema.js'
import{withAdmin}from'../shared/admin.js'
import{PROVIDER,integrationSettings,publicSettings,removeApiKey,saveApiKey,testConnection}from'../shared/finom.js'

const text=(value:unknown,max=160)=>String(value??'').trim().slice(0,max)

export default async(req:Request)=>withAdmin(req,async()=>{
  if(req.method==='GET')return Response.json({integration:publicSettings(await integrationSettings())})
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  const body=await req.json().catch(()=>({}))as Record<string,unknown>
  const action=text(body.action,40)

  if(action==='test'){
    const result=await testConnection()
    return Response.json({...result,integration:publicSettings(await integrationSettings())})
  }

  if(action==='remove-key'){
    await removeApiKey()
    return Response.json({ok:true,message:'De API-sleutel is verwijderd en de koppeling staat uit.',integration:publicSettings(await integrationSettings())})
  }

  if(action==='save'){
    await integrationSettings()
    const apiKey=text(body.apiKey,200)
    const baseUrl=text(body.baseUrl,200)||'https://api.finom.co'
    if(!/^https:\/\//.test(baseUrl))return Response.json({error:'Gebruik een https-adres voor de FINOM-api.'},{status:400})
    const invoicePath=text(body.invoicePath,120)||'/v1/invoices'
    const paymentTermDays=Math.min(Math.max(Number(body.paymentTermDays)||14,1),90)
    await db.update(integrations).set({
      baseUrl,
      invoicePath,
      paymentTermDays,
      senderCompany:text(body.senderCompany)||null,
      senderVat:text(body.senderVat,40)||null,
      senderIban:text(body.senderIban,40)||null,
      senderAddress:text(body.senderAddress,240)||null,
      autoCreate:body.autoCreate!==false,
      active:body.active!==false,
      updatedAt:new Date(),
    }).where(eq(integrations.provider,PROVIDER))
    // De sleutel slaan we los op, zodat een gewone instellingswijziging hem niet wist.
    if(apiKey){
      if(apiKey.length<12)return Response.json({error:'Deze sleutel lijkt te kort. Controleer de sleutel in FINOM.'},{status:400})
      await saveApiKey(apiKey)
    }
    const integration=await integrationSettings()
    return Response.json({ok:true,message:apiKey?'Koppeling en nieuwe API-sleutel opgeslagen.':'Instellingen van de koppeling opgeslagen.',integration:publicSettings(integration)})
  }

  return Response.json({error:'Onbekende actie.'},{status:400})
})

export const config:Config={path:'/api/admin-integrations'}
