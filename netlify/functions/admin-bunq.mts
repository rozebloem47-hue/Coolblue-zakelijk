/**
 * Beheer van de bunq-koppeling voor betalingen. De API-sleutel gaat naar
 * Netlify Blobs en komt nooit meer terug in een antwoord; het beheer ziet alleen
 * waar de sleutel vandaan komt, de laatste vier tekens en de gekoppelde rekening.
 */
import type{Config}from'@netlify/functions'
import{withAdmin}from'../shared/admin.js'
import{bunqStatus,saveBunqApiKey}from'../shared/bunq.js'

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
    return Response.json({ok:true,message:'De bunq API-sleutel is opgeslagen. De rekening wordt bij de eerstvolgende bestelling gekoppeld.',bunq:await bunqStatus()})
  }

  if(action==='remove-key'){
    await saveBunqApiKey('')
    return Response.json({ok:true,message:'De bunq API-sleutel is verwijderd.',bunq:await bunqStatus()})
  }

  return Response.json({error:'Onbekende actie.'},{status:400})
})

export const config:Config={path:'/api/admin-bunq'}
