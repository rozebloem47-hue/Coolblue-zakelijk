/**
 * Merk- en contactgegevens van de winkel. Het logo gaat naar Netlify Blobs, de
 * tekstvelden naar Netlify Database.
 */
import type{Config}from'@netlify/functions'
import{getStore}from'@netlify/blobs'
import{db}from'../../db/index.js'
import{siteSettings}from'../../db/schema.js'
import{withAdmin}from'../shared/admin.js'

const TYPES=['image/png','image/jpeg','image/webp','image/svg+xml']
const text=(value:FormDataEntryValue|null,max:number)=>String(value??'').trim().slice(0,max)

export default async(req:Request)=>withAdmin(req,async()=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  const form=await req.formData()
  const siteName=text(form.get('siteName'),80)||'VoltVoorraad'
  const tagline=text(form.get('tagline'),160)||null
  const supportEmail=text(form.get('supportEmail'),160)||null
  const supportPhone=text(form.get('supportPhone'),40)||null
  const logo=form.get('logo')
  let logoKey:string|undefined
  if(logo instanceof File&&logo.size){
    if(logo.size>2_000_000||!TYPES.includes(logo.type))return Response.json({error:'Gebruik PNG, JPG, WebP of SVG tot 2 MB.'},{status:400})
    logoKey=`logo/${Date.now()}-${logo.name.replace(/[^a-zA-Z0-9.-]/g,'')}`
    await getStore({name:'brand-assets',consistency:'strong'}).set(logoKey,await logo.arrayBuffer(),{metadata:{type:logo.type}})
  }
  const values={siteName,tagline,supportEmail,supportPhone,...(logoKey?{logoKey}:{}),updatedAt:new Date()}
  await db.insert(siteSettings).values({id:1,...values}).onConflictDoUpdate({target:siteSettings.id,set:values})
  return Response.json({ok:true,message:'Merkgegevens opgeslagen.',logoKey:logoKey??null})
})

export const config:Config={path:'/api/site-settings'}
