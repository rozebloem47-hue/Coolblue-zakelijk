/** Levert het geüploade logo uit Netlify Blobs, zodat de winkel en de beheerpagina het kunnen tonen. */
import type{Config}from'@netlify/functions'
import{getStore}from'@netlify/blobs'
import{db}from'../../db/index.js'
import{siteSettings}from'../../db/schema.js'

export default async()=>{
  const[settings]=await db.select().from(siteSettings).limit(1)
  if(!settings?.logoKey)return new Response('Geen logo ingesteld',{status:404})
  const blob=await getStore({name:'brand-assets',consistency:'strong'}).getWithMetadata(settings.logoKey,{type:'arrayBuffer'})
  if(!blob)return new Response('Geen logo ingesteld',{status:404})
  const type=typeof blob.metadata?.type==='string'?blob.metadata.type:'image/png'
  return new Response(blob.data,{headers:{'content-type':type,'cache-control':'public, max-age=300'}})
}

export const config:Config={path:'/api/brand-logo'}
