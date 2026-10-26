/**
 * Aanmelden bij de beheeromgeving met alleen het beheerwachtwoord.
 * GET controleert de sessie, POST meldt aan of af.
 */
import type{Config}from'@netlify/functions'
import{closeSession,isAdmin,openSession,passwordOk}from'../shared/admin.js'

export default async(req:Request)=>{
  if(req.method==='GET')return isAdmin(req)?Response.json({ok:true}):Response.json({error:'Niet aangemeld.'},{status:401})
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  const body=await req.json().catch(()=>({}))as Record<string,unknown>
  if(body.action==='logout')return closeSession({ok:true})
  if(!passwordOk(body.password))return Response.json({error:'Dit wachtwoord klopt niet.'},{status:401})
  return openSession({ok:true})
}

export const config:Config={path:'/api/admin-login'}
