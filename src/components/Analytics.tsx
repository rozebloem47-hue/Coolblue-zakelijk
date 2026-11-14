import{useEffect,useRef}from'react';import{useRouterState}from'@tanstack/react-router'
import{priced,type Product}from'@/data/products'
import{useCatalog}from'@/lib/shop-products'
/**
 * Meet paginabezoek per route, de bron van het bezoek, mandjesacties en het
 * afrekenen, plus een hartslag zolang het tabblad open staat. Elk meetpunt
 * draagt het actuele mandjesbedrag (incl. btw) mee. De beheeromgeving zelf
 * meten we niet mee, en geautomatiseerde browsers sturen niets.
 */
const sessionId=()=>{let id=sessionStorage.getItem('vv-session');if(!id){id=crypto.randomUUID();sessionStorage.setItem('vv-session',id)}return id}
let lookup:(id:number)=>Product|undefined=()=>undefined

/** Huidig mandje uit de opslag: aantal stuks en bedrag inclusief btw. */
const cartSnapshot=()=>{
  try{
    const items=JSON.parse(localStorage.getItem('voltvoorraad-cart')||'[]') as ({id:number;variant?:string}|number)[]
    let value=0
    for(const raw of items){const item=typeof raw==='number'?{id:raw}:raw;const product=lookup(item.id);if(product)value+=priced(product,item.variant).price}
    return{cartItems:items.length,cartValue:Math.round(value*100)/100}
  }catch{return{cartItems:0,cartValue:0}}
}

export function track(eventType:string,extra:Record<string,unknown>={}){
  if(typeof window==='undefined'||location.pathname.startsWith('/admin'))return
  if(navigator.webdriver)return
  const body=JSON.stringify({sessionId:sessionId(),eventType,path:location.pathname,touch:navigator.maxTouchPoints>1,...cartSnapshot(),...extra})
  try{if(navigator.sendBeacon('/api/track',new Blob([body],{type:'application/json'})))return}catch{}
  fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{})
}

export function Analytics(){
  const path=useRouterState({select:state=>state.location.pathname})
  const{byId}=useCatalog()
  lookup=byId
  const byIdRef=useRef(byId);byIdRef.current=byId
  useEffect(()=>{
    if(path.startsWith('/admin'))return
    // Alleen de herkomst buiten onze eigen winkel is interessant als bron.
    let referrer=''
    try{referrer=document.referrer&&!document.referrer.includes(location.host)?new URL(document.referrer).hostname:''}catch{}
    track('page_view',{referrer})
    if(path==='/checkout')track('begin_checkout')
    let timer=0
    const beat=()=>{window.clearInterval(timer);timer=window.setInterval(()=>{if(document.visibilityState==='visible')track('heartbeat')},30000)}
    beat()
    const leave=()=>track('leave')
    addEventListener('pagehide',leave)
    return()=>{window.clearInterval(timer);removeEventListener('pagehide',leave)}
  },[path])
  useEffect(()=>{
    // Het mandje meldt elke wijziging; we wachten tot de opslag is bijgewerkt.
    const onCart=(event:Event)=>{
      const{type,id}=(event as CustomEvent<{type:'add'|'remove';id:number}>).detail
      const product=byIdRef.current(id)
      track(type==='add'?'add_to_cart':'remove_from_cart',{productId:id,productName:product?.name})
    }
    addEventListener('vv-cart',onCart)
    return()=>removeEventListener('vv-cart',onCart)
  },[])
  return null
}
