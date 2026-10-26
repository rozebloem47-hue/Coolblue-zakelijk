/**
 * Beheer van de Browserless-koppeling. Het API-token gaat naar Netlify Blobs en
 * komt nooit meer terug in een antwoord; het beheer ziet alleen de laatste vier
 * tekens, de gekozen regio en de uitkomst van de laatste test.
 */
import type{Config}from'@netlify/functions'
import{withAdmin}from'../shared/admin.js'
import{BROWSERLESS_REGIONS,browserlessStatus,removeBrowserlessToken,saveBrowserless,testBrowserless}from'../shared/browserless.js'

const text=(value:unknown,max=200)=>String(value??'').trim().slice(0,max)

export default async(req:Request)=>withAdmin(req,async()=>{
  if(req.method==='GET')return Response.json({browserless:await browserlessStatus()})
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  const body=await req.json().catch(()=>({}))as Record<string,unknown>
  const action=text(body.action,40)

  if(action==='save'){
    const token=text(body.apiKey)
    const baseUrl=text(body.baseUrl).replace(/\/$/,'')||BROWSERLESS_REGIONS[2].url
    if(!/^https:\/\/[^/]+$/.test(baseUrl))return Response.json({error:'Gebruik een https-adres zonder pad, bijvoorbeeld https://production-ams.browserless.io.'},{status:400})
    if(token&&token.length<16)return Response.json({error:'Dit token lijkt te kort. Controleer het token in je Browserless-account.'},{status:400})
    await saveBrowserless({token,baseUrl,active:body.active!==false})
    if(!token)return Response.json({ok:true,message:'Instellingen van Browserless opgeslagen.'})
    const test=await testBrowserless()
    if(!test.ok)return Response.json({error:`Token opgeslagen, maar de test mislukte: ${test.message}`})
    return Response.json({ok:true,message:'Het Browserless API-token is opgeslagen en werkt.'})
  }

  if(action==='test'){
    const test=await testBrowserless()
    return Response.json(test.ok?{ok:true,message:test.message}:{error:test.message})
  }

  if(action==='remove-key'){
    await removeBrowserlessToken()
    return Response.json({ok:true,message:'Het Browserless API-token is verwijderd en de koppeling staat uit.'})
  }

  return Response.json({error:'Onbekende actie.'},{status:400})
})

export const config:Config={path:'/api/admin-browserless'}
