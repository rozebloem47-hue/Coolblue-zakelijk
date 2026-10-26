/**
 * Beheer van de bunq-koppeling voor betalingen. De API-sleutel gaat naar
 * Netlify Blobs en komt nooit meer terug in een antwoord; het beheer ziet alleen
 * waar de sleutel vandaan komt, de laatste vier tekens en de gekoppelde rekening.
 * Een mislukte koppeling geeft status 200 met een fout, zodat het beheer de
 * nieuwe status (en de laatste fout) meteen opnieuw inleest.
 */
import type{Config}from'@netlify/functions'
import{withAdmin}from'../shared/admin.js'
import{bunqStatus,saveBunqApiKey,testBunqConnection}from'../shared/bunq.js'

const text=(value:unknown,max=200)=>String(value??'').trim().slice(0,max)

export default async(req:Request)=>withAdmin(req,async()=>{
  if(req.method==='GET')return Response.json({bunq:await bunqStatus()})
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  const body=await req.json().catch(()=>({}))as Record<string,unknown>
  const action=text(body.action,40)

  if(action==='save'){
    const apiKey=text(body.apiKey)
    if(apiKey.length<20)return Response.json({error:'Deze sleutel lijkt te kort. Controleer de sleutel in de bunq-app.'},{status:400})
    await saveBunqApiKey(apiKey)
    // Een sleutel uit de omgeving gaat voor; alleen een sleutel uit het beheer controleren we meteen.
    if(process.env.BUNQ_API_KEY?.trim())return Response.json({ok:true,message:'De sleutel is opgeslagen, maar BUNQ_API_KEY uit de omgeving heeft voorrang.',bunq:await bunqStatus()})
    const test=await testBunqConnection()
    if(!test.ok)return Response.json({error:`Sleutel opgeslagen, maar koppelen mislukt: ${test.error}`,bunq:await bunqStatus()})
    return Response.json({ok:true,message:`De bunq API-sleutel is opgeslagen en gekoppeld${test.iban?` aan ${test.iban}`:''}.`,bunq:await bunqStatus()})
  }

  if(action==='test'){
    const test=await testBunqConnection()
    if(!test.ok)return Response.json({error:`Koppelen met bunq mislukt: ${test.error}`,bunq:await bunqStatus()})
    return Response.json({ok:true,message:`Verbonden met bunq${test.iban?`, betalingen komen binnen op ${test.iban}`:''}.`,bunq:await bunqStatus()})
  }

  if(action==='remove-key'){
    await saveBunqApiKey('')
    return Response.json({ok:true,message:'De bunq API-sleutel is verwijderd.',bunq:await bunqStatus()})
  }

  return Response.json({error:'Onbekende actie.'},{status:400})
})

export const config:Config={path:'/api/admin-bunq'}
