import{useEffect}from'react';import{useRouterState}from'@tanstack/react-router';
/**
 * Meet paginabezoek per route, de bron van het bezoek en een hartslag zolang het
 * tabblad open staat. De beheeromgeving zelf meten we niet mee.
 */
const sessionId=()=>{let id=sessionStorage.getItem('vv-session');if(!id){id=crypto.randomUUID();sessionStorage.setItem('vv-session',id)}return id};
const send=(body:Record<string,unknown>)=>{try{navigator.sendBeacon('/api/track',new Blob([JSON.stringify(body)],{type:'application/json'}))}catch{}};
export function Analytics(){
  const path=useRouterState({select:state=>state.location.pathname});
  useEffect(()=>{
    if(path.startsWith('/admin'))return;
    const id=sessionId();
    // Alleen de herkomst buiten onze eigen winkel is interessant als bron.
    const referrer=document.referrer&&!document.referrer.includes(location.host)?new URL(document.referrer).hostname:'';
    send({sessionId:id,eventType:'page_view',path,referrer});
    const timer=setInterval(()=>send({sessionId:id,eventType:'heartbeat',path}),30000);
    const leave=()=>send({sessionId:id,eventType:'leave',path});
    addEventListener('pagehide',leave);
    return()=>{clearInterval(timer);removeEventListener('pagehide',leave)};
  },[path]);
  return null
}
