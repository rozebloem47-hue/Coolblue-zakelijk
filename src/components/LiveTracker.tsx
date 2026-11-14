import{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState}from'react'
import{Eye,LogOut,Monitor,Pause,Play,ShoppingCart,Smartphone,Tablet,CreditCard,PackageCheck,MinusCircle,Send}from'lucide-react'

/**
 * Live meekijken in de winkel: tellers voor mandjes, afrekenen en orders, wie
 * er nu actief is en een doorlopende ticker van elke gebeurtenis met apparaat,
 * browser en mandjesbedrag. Haalt elke paar seconden alleen nieuwe
 * gebeurtenissen op en pauzeert zodra het tabblad niet zichtbaar is.
 */
type LiveEvent={id:number;sessionId:string;eventType:string;path:string;productId:number|null;productName:string|null;referrer:string|null;device:string|null;browser:string|null;os:string|null;cartValue:string|null;cartItems:number|null;cartLines:CartLine[]|null;createdAt:string|null}
type CartLine={name:string;quantity:number;price:number}
type Tally={label:string;count:number}[]
type Live={
  generatedAt:string;active:number;online?:string[]
  totals:{addToCart:number;addToCart30:number;removeFromCart:number;checkouts:number;checkouts30:number;submits:number;placed:number;pageViews:number;pageViews30:number;sessions:number;cartSessions:number;checkoutSessions:number;orders:number;revenue:string}
  openCarts:{count:number;value:number}
  devices:Tally;browsers:Tally;systems:Tally
  events:LiveEvent[]
}

const POLL=4000
const KEEP=150
/** Mandje- en afrekenmomenten blijven bovenaan staan zolang die bezoeker online is. */
const PIN=new Set(['add_to_cart','begin_checkout','checkout_submit'])
const MOVE_MS=700
const kinds:Record<string,{label:string;icon:typeof Eye;tone:string}>={
  page_view:{label:'Bekijkt pagina',icon:Eye,tone:'view'},
  add_to_cart:{label:'In mandje gelegd',icon:ShoppingCart,tone:'cart'},
  remove_from_cart:{label:'Uit mandje gehaald',icon:MinusCircle,tone:'off'},
  begin_checkout:{label:'Naar afrekenen',icon:CreditCard,tone:'checkout'},
  checkout_submit:{label:'Bestelling verstuurd',icon:Send,tone:'checkout'},
  order_placed:{label:'Order geplaatst',icon:PackageCheck,tone:'order'},
  leave:{label:'Vertrokken',icon:LogOut,tone:'off'},
}
const euro=(value:number|string)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(value)||0)
const count=(value:number)=>new Intl.NumberFormat('nl-NL').format(value||0)
const clock=(value:string|null)=>value?new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value)):'—'
/** Gebeurtenissen waarbij de inhoud van het mandje telt. */
const WITH_CART=new Set(['add_to_cart','remove_from_cart','begin_checkout','checkout_submit','order_placed'])
const CHECKOUT=new Set(['begin_checkout','checkout_submit','order_placed'])

/** Wat er gebeurde: welk product erin of eruit ging, en wat er op dat moment in het mandje of de checkout zat. */
function What({event}:{event:LiveEvent}){
  const lines=event.cartLines??[]
  if(!WITH_CART.has(event.eventType))return <span className="lt-what" title={event.path}>{event.productName??event.path}{event.productName&&<small>{event.path}</small>}{event.eventType==='page_view'&&event.referrer&&<small>via {event.referrer}</small>}</span>
  const added=event.eventType==='add_to_cart'
  const removed=event.eventType==='remove_from_cart'
  const order=event.eventType==='order_placed'
  return <span className="lt-what lt-what-cart">
    {(added||removed)&&<span className={`lt-product ${removed?'is-removed':''}`} title={event.productName??''}>{added?'+ ':'− '}{event.productName??'Onbekend product'}</span>}
    {order&&event.productName&&<span className="lt-product">Order {event.productName}</span>}
    {lines.length
      ?<>
        <small className="lt-lines-title">{CHECKOUT.has(event.eventType)?(order?'Besteld':'In de checkout'):'Nu in het mandje'}</small>
        <ul className="lt-lines">{lines.map((line,index)=><li key={index} title={line.name}><b>{line.quantity}×</b><span>{line.name}</span><em>{euro(line.price*line.quantity)}</em></li>)}</ul>
      </>
      :CHECKOUT.has(event.eventType)&&<small>Inhoud niet bekend (oudere meting)</small>}
  </span>
}

const DeviceIcon=({device}:{device:string|null})=>device==='mobiel'?<Smartphone/>:device==='tablet'?<Tablet/>:<Monitor/>

function Split({title,rows,total}:{title:string;rows:Tally;total:number}){
  return <div className="lt-split"><h4>{title}</h4>
    {rows.length?<ol>{rows.map(row=><li key={row.label}><span>{row.label}</span><b>{count(row.count)}</b><i style={{width:`${Math.max(Math.round(row.count/Math.max(total,1)*100),3)}%`}}/></li>)}</ol>:<p className="db-empty">Niemand actief.</p>}
  </div>
}

export function LiveTracker(){
  const[live,setLive]=useState<Live|null>(null)
  const[events,setEvents]=useState<LiveEvent[]>([])
  const[fresh,setFresh]=useState<Set<number>>(new Set())
  const[paused,setPaused]=useState(false)
  const[failed,setFailed]=useState(false)
  const cursor=useRef(0)
  const busy=useRef(false)
  const errors=useRef(0)
  const online=useRef<Set<string>>(new Set())
  const rows=useRef(new Map<number,HTMLLIElement>())
  const tops=useRef(new Map<number,number>())

  const poll=useCallback(async()=>{
    if(busy.current)return
    busy.current=true
    try{
      const response=await fetch(`/api/admin-live?after=${cursor.current}`,{cache:'no-store'})
      if(!response.ok)throw new Error(String(response.status))
      const data:Live=await response.json()
      errors.current=0;setFailed(false)
      online.current=new Set(data.online??[])
      setLive(data)
      if(data.events.length){
        const first=cursor.current===0
        cursor.current=Math.max(cursor.current,...data.events.map(event=>event.id))
        setEvents(current=>{
          const seen=new Set(current.map(event=>event.id))
          const merged=[...data.events.filter(event=>!seen.has(event.id)),...current]
          // Vastgepinde regels nooit wegsnoeien, ook niet als ze buiten de laatste KEEP vallen.
          return merged.filter((event,index)=>index<KEEP||(PIN.has(event.eventType)&&online.current.has(event.sessionId)))
        })
        if(!first)setFresh(new Set(data.events.map(event=>event.id)))
      }
    }catch{
      errors.current++;setFailed(true)
    }finally{busy.current=false}
  },[])

  useEffect(()=>{
    if(paused)return
    let timer=0
    const tick=async()=>{
      if(document.visibilityState==='visible')await poll()
      // Bij storingen rustiger opnieuw proberen, tot maximaal een halve minuut.
      timer=window.setTimeout(tick,Math.min(POLL*2**errors.current,30000))
    }
    void tick()
    const wake=()=>{if(document.visibilityState==='visible')void poll()}
    document.addEventListener('visibilitychange',wake)
    return()=>{window.clearTimeout(timer);document.removeEventListener('visibilitychange',wake)}
  },[paused,poll])

  // Vastgepind bovenaan (nieuwste eerst), daarna de rest in tijdsvolgorde.
  const onlineKey=(live?.online??[]).join('|')
  const ordered=useMemo(()=>{
    const now=new Set(live?.online??[])
    const pinned:LiveEvent[]=[],rest:LiveEvent[]=[]
    for(const event of events)(PIN.has(event.eventType)&&now.has(event.sessionId)?pinned:rest).push(event)
    return{list:[...pinned,...rest],pinned:new Set(pinned.map(event=>event.id))}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[events,onlineKey])

  // Regels die van plek wisselen schuiven zichtbaar naar hun nieuwe positie in plaats van te verspringen.
  useLayoutEffect(()=>{
    const next=new Map<number,number>()
    for(const[id,el]of rows.current){
      const top=el.offsetTop
      next.set(id,top)
      const before=tops.current.get(id)
      if(before===undefined||before===top)continue
      el.style.transition='none'
      el.style.transform=`translateY(${before-top}px)`
      void el.offsetHeight
      el.style.transition=`transform ${MOVE_MS}ms var(--ease)`
      el.style.transform=''
    }
    tops.current=next
  },[ordered])

  const t=live?.totals
  const cartShare=t&&t.sessions?Math.round(t.cartSessions/t.sessions*100):0
  const checkoutShare=t&&t.cartSessions?Math.round(t.checkoutSessions/t.cartSessions*100):0
  return <section className="db-section lt">
    <div className="lt-head">
      <div>
        <h2><span className={`lt-pulse ${paused||failed?'is-off':''}`} aria-hidden/>Live in de winkel</h2>
        <p className="db-lead">{paused?'Gepauzeerd.':failed?'Verbinding hapert, we proberen het opnieuw…':`Ververst elke ${POLL/1000} seconden. Bots en scripts worden niet meegeteld.`}</p>
      </div>
      <button className="db-button ghost" onClick={()=>setPaused(value=>!value)}>{paused?<><Play/>Hervatten</>:<><Pause/>Pauzeren</>}</button>
    </div>

    {!live?<p className="db-empty">Live gegevens laden…</p>:<>
      <div className="db-grid cols-4 lt-tiles">
        <div className="db-tile db-tile-live"><small>Nu actief</small><b>{count(live.active)}</b><span>bezoekers in de laatste 5 minuten</span></div>
        <div className="db-tile"><small>In mandje vandaag</small><b>{count(t!.addToCart)}</b><span>{count(t!.addToCart30)} in het laatste halfuur · {count(t!.cartSessions)} bezoekers ({cartShare}%)</span></div>
        <div className="db-tile"><small>Afrekenen gestart</small><b>{count(t!.checkouts)}</b><span>{count(t!.checkouts30)} in het laatste halfuur · {checkoutShare}% van de mandjes · {count(t!.submits)} verstuurd</span></div>
        <div className="db-tile"><small>Orders vandaag</small><b>{count(t!.orders)}</b><span>{euro(t!.revenue)} incl. btw · {euro(Number(t!.revenue)/1.21)} excl. btw</span></div>
      </div>
      <div className="db-grid split lt-body">
        <div className="db-panel lt-ticker">
          <h3>Ticker</h3>
          <p className="db-note">Elke gebeurtenis, nieuwste bovenaan. Mandjes en afrekenen van bezoekers die nog online zijn blijven bovenaan staan en zakken pas naar hun plek als de bezoeker vertrekt. Bij mandjes en afrekenen zie je welk product erbij kwam en wat er op dat moment in het mandje of de checkout zat. Het mandbedrag is de stand op dat moment.</p>
          {ordered.list.length?<ol>{ordered.list.map(event=>{
            const kind=kinds[event.eventType]??{label:event.eventType,icon:Eye,tone:'view'}
            const value=Number(event.cartValue)
            const pinned=ordered.pinned.has(event.id)
            return <li key={event.id} ref={el=>{if(el)rows.current.set(event.id,el);else rows.current.delete(event.id)}} className={`is-${kind.tone} ${fresh.has(event.id)?'is-new':''} ${pinned?'is-pinned':''}`}>
              <time>{clock(event.createdAt)}</time>
              <span className="lt-kind"><kind.icon/>{kind.label}{pinned&&<em className="lt-online" title="Deze bezoeker is nu online">online</em>}</span>
              <What event={event}/>
              <span className="lt-agent" title={`${event.device??'onbekend'} · ${event.browser??''} · ${event.os??''}`}><DeviceIcon device={event.device}/>{event.browser??'Onbekend'}<small>{event.os??''}</small></span>
              <span className="lt-cart">{value>0?<><b>{euro(value)}</b><small>{euro(value/1.21)} excl. · {count(event.cartItems??0)} st.</small></>:<small>leeg mandje</small>}</span>
            </li>
          })}</ol>:<p className="db-empty">Nog geen activiteit vandaag.</p>}
        </div>
        <div className="db-panel lt-side">
          <h3>Nu actief</h3>
          <p className="db-note">Bezoekers van de laatste 5 minuten.</p>
          <div className="lt-carts"><small>Open mandjes</small><b>{euro(live.openCarts.value)}</b><span>{count(live.openCarts.count)} mandjes · {euro(live.openCarts.value/1.21)} excl. btw</span></div>
          <Split title="Apparaat" rows={live.devices} total={live.active}/>
          <Split title="Browser" rows={live.browsers} total={live.active}/>
          <Split title="Besturingssysteem" rows={live.systems} total={live.active}/>
        </div>
      </div>
    </>}
  </section>
}
