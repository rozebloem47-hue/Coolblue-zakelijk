import{createFileRoute}from'@tanstack/react-router'
import{Fragment,useCallback,useEffect,useMemo,useState}from'react'
import{AlertTriangle,Ban,BarChart3,CheckCircle2,Clock,Download,ExternalLink,Eye,EyeOff,FileText,Link2,LogOut,Package,Pencil,Plus,RefreshCw,Settings2,ShoppingBag,Tag,Trash2,Users,X}from'lucide-react'
import{categories}from'@/data/products'
import{parseEuro,placements}from'@/data/imported-products'

export const Route=createFileRoute('/admin')({
  // De beheeromgeving hoort niet in een zoekmachine en heeft geen winkelchroom.
  head:()=>({meta:[{title:'Beheer · VoltVoorraad'},{name:'robots',content:'noindex, nofollow'}]}),
  component:AdminPage,
})

type Counts={views:number;sessions:number}
type Sales={revenue:string;count:number}
type Order={id:number;orderNumber:string;companyName:string|null;email:string;total:string;status:string;firstName:string|null;lastName:string|null;phone:string|null;kvk:string|null;vatNumber:string|null;reference:string|null;street:string|null;houseNumber:string|null;postalCode:string|null;city:string|null;country:string|null;subtotal:string|null;discount:string|null;vatAmount:string|null;paymentMethod:string;businessOrder:boolean;notes:string|null;bunqPaymentUrl:string;bunqTabId:number|null;createdAt:string|null}
type Invoice={id:number;orderId:number;number:string|null;status:string;amount:string;pdfUrl:string|null;dueDate:string|null;error:string|null;createdAt:string|null;orderNumber:string|null;companyName:string|null;email:string|null}
type Integration={provider:string;baseUrl:string;invoicePath:string;keyLast4:string|null;keyUpdatedAt:string|null;senderCompany:string|null;senderVat:string|null;senderIban:string|null;senderAddress:string|null;paymentTermDays:number;autoCreate:boolean;active:boolean;lastCheckAt:string|null;lastCheckOk:boolean|null;lastCheckMessage:string|null}
type Bunq={configured:boolean;source:'omgeving'|'beheer'|'geen';keyLast4:string|null;connected:boolean;iban:string;lastError:string}
type Settings={siteName:string;tagline:string|null;supportEmail:string|null;supportPhone:string|null;logoKey:string|null}
type Data={
  generatedAt:string
  visits:{today:Counts;week:Counts;month:Counts;active:number}
  revenue:{today:Sales;week:Sales;month:Sales;all:Sales;averageOrder:number;conversion:number}
  timeline:{day:string;views:number;sessions:number}[]
  topPages:{path:string;views:number}[]
  referrers:{referrer:string;views:number}[]
  funnel:{eventType:string;count:number}[]
  recentEvents:{id:number;eventType:string;path:string;productId:number|null;referrer:string|null;isActive:boolean;createdAt:string|null}[]
  orders:Order[]
  invoices:Invoice[]
  invoiceStatus:{status:string;count:number;amount:string}[]
  topProducts:{name:string;sold:number;revenue:string}[]
  catalog:{products:number;departments:number;collections:number;items:number;brands:number;deals:number;dealShare:number;averageDeal:number;businessDiscount:string;perDepartment:{slug:string;name:string;products:number;deals:number}[];topDeals:{name:string;department:string;dealPercent?:number;price:number;listPrice?:number}[]}
  settings:Settings
  integration:Integration
  bunq:Bunq
}

const views=[
  {key:'overzicht',label:'Overzicht',icon:BarChart3},
  {key:'bezoek',label:'Bezoekers en tracking',icon:Users},
  {key:'orders',label:'Orders',icon:ShoppingBag},
  {key:'facturen',label:'Facturen',icon:FileText},
  {key:'producten',label:'Producten',icon:Tag},
  {key:'catalogus',label:'Assortiment',icon:Package},
  {key:'koppeling',label:'Koppelingen FINOM en bunq',icon:Link2},
  {key:'merk',label:'Merk en instellingen',icon:Settings2},
]as const
type ViewKey=typeof views[number]['key']

const orderStatuses=['nieuw','gefactureerd','betaald','verzonden','geannuleerd','factuur mislukt']
const eventLabels:Record<string,string>={page_view:'Paginabezoek',heartbeat:'Nog actief',leave:'Vertrokken',add_to_cart:'In mandje gelegd'}

const euro=(value:number|string)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(value)||0)
const count=(value:number)=>new Intl.NumberFormat('nl-NL').format(value||0)
const moment=(value:string|null)=>value?new Intl.DateTimeFormat('nl-NL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—'
const day=(value:string)=>new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`))
const address=(order:Order)=>[order.street&&`${order.street} ${order.houseNumber??''}`.trim(),[order.postalCode,order.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')||'—'

/** Statuswoord met een eigen teken, zodat kleur nooit de enige aanwijzing is. */
function Status({value}:{value:string}){
  const good=['betaald','gefactureerd','verzonden','open','paid','verstuurd','zichtbaar'].includes(value)
  const bad=value.includes('mislukt')||value==='error'
  const off=value==='geannuleerd'||value==='verborgen'
  const Icon=bad?AlertTriangle:off?Ban:good?CheckCircle2:Clock
  return <span className={`db-status ${bad?'is-bad':off?'is-off':good?'is-good':'is-wait'}`}><Icon/>{value}</span>
}

function Tile({label,value,hint,live=false}:{label:string;value:string;hint?:string;live?:boolean}){
  return <div className={`db-tile ${live?'db-tile-live':''}`}><small>{label}</small><b>{value}</b>{hint&&<span>{hint}</span>}</div>
}

/** Ranglijst met liggende staven: één tint, waarde altijd als tekst erbij. */
function Ranks({rows}:{rows:{label:string;value:string;share:number}[]}){
  if(!rows.length)return <p className="db-empty">Nog geen gegevens.</p>
  return <ol className="db-rank">{rows.map(row=><li key={row.label}><span title={row.label}>{row.label}</span><b>{row.value}</b><i style={{width:`${Math.max(row.share,2)}%`}}/></li>)}</ol>
}

/** Paginaweergaven per dag. Eén reeks, dus geen legenda: de kop benoemt de reeks. */
function Days({rows}:{rows:{day:string;views:number;sessions:number}[]}){
  if(!rows.length)return <p className="db-empty">Nog geen bezoek gemeten.</p>
  const top=Math.max(...rows.map(row=>row.views))
  return <>
    <div className="db-bars">{rows.map((row,index)=><div key={row.day} title={`${day(row.day)}: ${count(row.views)} weergaven van ${count(row.sessions)} sessies`}>
      <div className="db-bar" style={{height:`${Math.max((row.views/top)*100,1.5)}%`}}>{row.views===top||index===rows.length-1?<span className="db-bar-value">{count(row.views)}</span>:null}</div>
    </div>)}</div>
    <div className="db-ticks">{rows.map((row,index)=><span key={row.day}>{index===0||index===rows.length-1||index===Math.floor(rows.length/2)?day(row.day):''}</span>)}</div>
  </>
}

function AdminPage(){
  const[state,setState]=useState<'laden'|'aanmelden'|'open'>('laden')
  const[data,setData]=useState<Data|null>(null)
  const[view,setView]=useState<ViewKey>('overzicht')
  const[loginError,setLoginError]=useState('')
  const[busy,setBusy]=useState(false)
  const[notice,setNotice]=useState<{text:string;ok:boolean}|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/admin-data')
    if(response.status===401){setState('aanmelden');setData(null);return}
    if(!response.ok){setNotice({text:'De gegevens konden niet worden geladen.',ok:false});return}
    setData(await response.json())
    setState('open')
  },[])

  useEffect(()=>{load()},[load])

  const signIn=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    const form=new FormData(event.currentTarget)
    setBusy(true);setLoginError('')
    try{
      const response=await fetch('/api/admin-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:String(form.get('password')??'')})})
      if(!response.ok){
        const result=await response.json().catch(()=>({}))
        setLoginError(result.error??'Aanmelden lukte niet. Probeer het nog eens.')
        return
      }
      await load()
    }catch{
      setLoginError('De server reageerde niet. Probeer het opnieuw.')
    }finally{
      setBusy(false)
    }
  }

  const signOut=async()=>{
    await fetch('/api/admin-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{})
    setData(null);setState('aanmelden')
  }

  /** Eén plek voor alle beheerhandelingen: versturen, melden en opnieuw inlezen. */
  const post=useCallback(async(url:string,body:BodyInit|Record<string,unknown>)=>{
    setBusy(true);setNotice(null)
    try{
      const json=!(body instanceof FormData)
      const response=await fetch(url,{method:'POST',...(json?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{body:body as FormData})})
      if(response.status===401){setState('aanmelden');return}
      const result=await response.json().catch(()=>({}))
      setNotice({text:result.error??result.message??(response.ok?'Opgeslagen.':'Dat lukte niet.'),ok:response.ok&&!result.error})
      if(response.ok)await load()
    }catch{
      setNotice({text:'De server reageerde niet. Probeer het opnieuw.',ok:false})
    }finally{
      setBusy(false)
    }
  },[load])

  if(state==='laden')return <div className="db-login"><div className="db-login-card"><h1>Beheer</h1><p>We kijken of je al bent aangemeld…</p></div></div>

  if(state==='aanmelden')return <div className="db-login">
    <form onSubmit={signIn}>
      <h1>Beheer van VoltVoorraad</h1>
      <p>Vul het beheerwachtwoord in. Meer is niet nodig.</p>
      <label>Wachtwoord<input name="password" type="password" required autoFocus autoComplete="current-password"/></label>
      {loginError&&<p className="db-message is-bad">{loginError}</p>}
      <button className="db-button" disabled={busy}>{busy?'Aanmelden…':'Aanmelden'}</button>
    </form>
  </div>

  if(!data)return <div className="db-login"><div className="db-login-card"><h1>Beheer</h1><p>Gegevens laden…</p><button className="db-button ghost" onClick={()=>load()}>Opnieuw proberen</button></div></div>

  return <div className="db-app">
    <nav className="db-rail">
      <div className="db-brand"><b>{data.settings.siteName}</b><small>Beheeromgeving</small></div>
      <div className="db-nav">{views.map(item=><button key={item.key} aria-current={view===item.key} onClick={()=>{setView(item.key);setNotice(null)}}><item.icon/>{item.label}</button>)}</div>
      <div className="db-rail-foot">
        <span>Aangemeld als<br/><b>Beheerder</b></span>
        <button className="db-signout" onClick={signOut}><LogOut/>Afmelden</button>
      </div>
    </nav>

    <main className="db-main">
      <header className="db-head">
        <div>
          <h1>{views.find(item=>item.key===view)?.label}</h1>
          <p>{data.visits.active>0?`${count(data.visits.active)} bezoeker(s) nu actief in de winkel.`:'Op dit moment is er geen bezoeker in de winkel.'}</p>
        </div>
        <div className="db-head-meta">
          <span>Bijgewerkt {moment(data.generatedAt)}</span>
          <button className="db-refresh" onClick={()=>load()} disabled={busy}><RefreshCw/>Verversen</button>
        </div>
      </header>

      {notice&&<p className={`db-message ${notice.ok?'is-good':'is-bad'}`}>{notice.text}</p>}

      {view==='overzicht'&&<Overzicht data={data}/>}
      {view==='bezoek'&&<Bezoek data={data}/>}
      {view==='orders'&&<Orders data={data} busy={busy} post={post}/>}
      {view==='facturen'&&<Facturen data={data} busy={busy} post={post}/>}
      {view==='producten'&&<Producten/>}
      {view==='catalogus'&&<Catalogus data={data}/>}
      {view==='koppeling'&&<Koppeling data={data} busy={busy} post={post}/>}
      {view==='merk'&&<Merk data={data} busy={busy} post={post}/>}
    </main>
  </div>
}

type Post=(url:string,body:BodyInit|Record<string,unknown>)=>Promise<void>

function Overzicht({data}:{data:Data}){
  const share=(value:number,total:number)=>total?Math.round((value/total)*100):0
  const pages=data.topPages.slice(0,6)
  const pageTop=Math.max(1,...pages.map(row=>row.views))
  return <>
    <section className="db-section">
      <h2>Vandaag</h2>
      <p className="db-lead">De stand van zaken sinds middernacht.</p>
      <div className="db-grid cols-4">
        <Tile label="Bezoekers nu" value={count(data.visits.active)} hint="actief in de laatste 5 minuten" live/>
        <Tile label="Sessies vandaag" value={count(data.visits.today.sessions)} hint={`${count(data.visits.today.views)} paginaweergaven`}/>
        <Tile label="Orders vandaag" value={count(data.revenue.today.count)} hint="allemaal op factuur"/>
        <Tile label="Omzet vandaag" value={euro(data.revenue.today.revenue)} hint="inclusief btw"/>
      </div>
    </section>

    <section className="db-section">
      <h2>Laatste 30 dagen</h2>
      <div className="db-grid cols-4">
        <Tile label="Sessies" value={count(data.visits.month.sessions)} hint={`${count(data.visits.month.views)} paginaweergaven`}/>
        <Tile label="Orders" value={count(data.revenue.month.count)} hint={`${count(data.revenue.week.count)} in de laatste 7 dagen`}/>
        <Tile label="Omzet" value={euro(data.revenue.month.revenue)} hint={`gemiddelde order ${euro(data.revenue.averageOrder)}`}/>
        <Tile label="Conversie" value={`${data.revenue.conversion}%`} hint="orders per sessie"/>
      </div>
    </section>

    <section className="db-section">
      <h2>Bezoek en verkoop</h2>
      <div className="db-grid split">
        <div className="db-panel">
          <h3>Paginaweergaven per dag</h3>
          <p className="db-note">Laatste 14 dagen. Wijs een staaf aan voor de sessies van die dag.</p>
          <Days rows={data.timeline}/>
        </div>
        <div className="db-panel">
          <h3>Drukste pagina's</h3>
          <p className="db-note">Weergaven in de laatste 30 dagen.</p>
          <Ranks rows={pages.map(row=>({label:row.path,value:count(row.views),share:share(row.views,pageTop)}))}/>
        </div>
      </div>
    </section>

    <section className="db-section">
      <h2>Best verkocht</h2>
      <div className="db-grid split">
        <div className="db-panel db-scroll">
          <h3>Producten</h3>
          <p className="db-note">Op basis van alle orderregels.</p>
          {data.topProducts.length
            ?<table className="db-table"><thead><tr><th>Product</th><th className="db-num">Aantal</th><th className="db-num">Omzet</th></tr></thead>
              <tbody>{data.topProducts.map(row=><tr key={row.name}><td>{row.name}</td><td className="db-num">{count(row.sold)}</td><td className="db-num">{euro(row.revenue)}</td></tr>)}</tbody></table>
            :<p className="db-empty">Nog geen verkopen.</p>}
        </div>
        <div className="db-panel">
          <h3>Totaal sinds de start</h3>
          <p className="db-note">Alle orders bij elkaar.</p>
          <table className="db-table"><tbody>
            <tr><td>Orders</td><td className="db-num">{count(data.revenue.all.count)}</td></tr>
            <tr><td>Omzet incl. btw</td><td className="db-num">{euro(data.revenue.all.revenue)}</td></tr>
            <tr><td>Gemiddelde order</td><td className="db-num">{euro(data.revenue.averageOrder)}</td></tr>
            <tr><td>Ondernemerskorting</td><td className="db-num">{data.catalog.businessDiscount}</td></tr>
          </tbody></table>
        </div>
      </div>
    </section>
  </>
}

function Bezoek({data}:{data:Data}){
  const referrerTop=Math.max(1,...data.referrers.map(row=>row.views))
  const funnelTop=Math.max(1,...data.funnel.map(row=>row.count))
  const pageTop=Math.max(1,...data.topPages.map(row=>row.views))
  return <>
    <section className="db-section">
      <h2>Bezoek</h2>
      <p className="db-lead">We meten paginabezoek, herkomst en artikelen die in een mandje gaan. De beheeromgeving zelf meten we niet mee.</p>
      <div className="db-grid cols-4">
        <Tile label="Nu actief" value={count(data.visits.active)} hint="sessies in 5 minuten" live/>
        <Tile label="Sessies vandaag" value={count(data.visits.today.sessions)}/>
        <Tile label="Sessies 7 dagen" value={count(data.visits.week.sessions)} hint={`${count(data.visits.week.views)} weergaven`}/>
        <Tile label="Sessies 30 dagen" value={count(data.visits.month.sessions)} hint={`${count(data.visits.month.views)} weergaven`}/>
      </div>
    </section>

    <section className="db-section">
      <div className="db-panel">
        <h3>Paginaweergaven per dag</h3>
        <p className="db-note">Laatste 14 dagen.</p>
        <Days rows={data.timeline}/>
      </div>
    </section>

    <section className="db-section">
      <div className="db-grid cols-3">
        <div className="db-panel">
          <h3>Herkomst</h3>
          <p className="db-note">Weergaven per bron, 30 dagen.</p>
          <Ranks rows={data.referrers.map(row=>({label:row.referrer==='direct'?'Rechtstreeks':row.referrer,value:count(row.views),share:Math.round((row.views/referrerTop)*100)}))}/>
        </div>
        <div className="db-panel">
          <h3>Soorten gebeurtenissen</h3>
          <p className="db-note">Wat bezoekers deden, 30 dagen.</p>
          <Ranks rows={data.funnel.map(row=>({label:eventLabels[row.eventType]??row.eventType,value:count(row.count),share:Math.round((row.count/funnelTop)*100)}))}/>
        </div>
        <div className="db-panel">
          <h3>Drukste pagina's</h3>
          <p className="db-note">Weergaven, 30 dagen.</p>
          <Ranks rows={data.topPages.map(row=>({label:row.path,value:count(row.views),share:Math.round((row.views/pageTop)*100)}))}/>
        </div>
      </div>
    </section>

    <section className="db-section">
      <div className="db-panel db-scroll">
        <h3>Laatste gebeurtenissen</h3>
        <p className="db-note">De 25 meest recente meetpunten, nieuwste eerst.</p>
        {data.recentEvents.length
          ?<table className="db-table"><thead><tr><th>Tijd</th><th>Gebeurtenis</th><th>Pagina</th><th>Bron</th><th>Product</th></tr></thead>
            <tbody>{data.recentEvents.map(event=><tr key={event.id}>
              <td>{moment(event.createdAt)}</td>
              <td>{eventLabels[event.eventType]??event.eventType}</td>
              <td>{event.path}</td>
              <td>{event.referrer||'rechtstreeks'}</td>
              <td className="db-num">{event.productId??'—'}</td>
            </tr>)}</tbody></table>
          :<p className="db-empty">Nog geen gebeurtenissen gemeten.</p>}
      </div>
    </section>
  </>
}

function Orders({data,busy,post}:{data:Data;busy:boolean;post:Post}){
  const[open,setOpen]=useState<number|null>(null)
  const perStatus=useMemo(()=>{
    const map=new Map<string,number>()
    for(const order of data.orders)map.set(order.status,(map.get(order.status)??0)+1)
    return[...map].sort((a,b)=>b[1]-a[1])
  },[data.orders])
  const top=Math.max(1,...perStatus.map(([,value])=>value))
  return <>
    <section className="db-section">
      <h2>Orders</h2>
      <p className="db-lead">Klanten betalen via een bunq.me-link met het ordernummer als beschrijving; lukt die link niet, dan betalen ze op factuur. Klap een order open voor de factuurgegevens en de betaallink.</p>
      <div className="db-grid cols-4">
        <Tile label="Orders vandaag" value={count(data.revenue.today.count)} hint={euro(data.revenue.today.revenue)}/>
        <Tile label="Orders 7 dagen" value={count(data.revenue.week.count)} hint={euro(data.revenue.week.revenue)}/>
        <Tile label="Orders 30 dagen" value={count(data.revenue.month.count)} hint={euro(data.revenue.month.revenue)}/>
        <Tile label="Gemiddelde order" value={euro(data.revenue.averageOrder)} hint="inclusief btw"/>
      </div>
    </section>

    <section className="db-section">
      <div className="db-grid split">
        <div className="db-panel db-scroll">
          <h3>Laatste 25 orders</h3>
          <p className="db-note">Pas de status aan zodra je een order oppakt.</p>
          {data.orders.length
            ?<table className="db-table"><thead><tr><th>Order</th><th>Klant</th><th className="db-num">Totaal</th><th>Status</th><th/></tr></thead>
              <tbody>{data.orders.map(order=><tr key={order.id}>
                <td><b>{order.orderNumber}</b><small>{moment(order.createdAt)}</small></td>
                <td><b>{order.companyName??`${order.firstName??''} ${order.lastName??''}`.trim()}</b><small>{order.email}</small>
                  {open===order.id&&<small>{address(order)}<br/>{order.kvk?`KvK ${order.kvk}`:''} {order.vatNumber??''}<br/>{order.reference?`Referentie: ${order.reference}`:''}{order.notes?<><br/>Opmerking: {order.notes}</>:null}<br/>{order.bunqPaymentUrl?<>Betaling: <a href={order.bunqPaymentUrl} target="_blank" rel="noreferrer">bunq.me-link van deze order</a> — betaalde de klant nog niet? Stuur deze link door.</>:'Betaling: op factuur, er is geen bunq.me-link gemaakt.'}</small>}
                </td>
                <td className="db-num">{euro(order.total)}<small>{order.discount&&Number(order.discount)>0?`−${euro(order.discount)} korting`:'geen korting'}</small></td>
                <td>
                  <Status value={order.status}/>
                  <select className="db-inline-select" value={order.status} disabled={busy} onChange={event=>post('/api/admin-actions',{action:'order-status',orderId:order.id,status:event.target.value})}>
                    {orderStatuses.map(status=><option key={status} value={status}>{status}</option>)}
                  </select>
                </td>
                <td><button className="db-button ghost" onClick={()=>setOpen(open===order.id?null:order.id)}>{open===order.id?'Minder':'Details'}</button></td>
              </tr>)}</tbody></table>
            :<p className="db-empty">Er zijn nog geen orders.</p>}
        </div>
        <div className="db-panel">
          <h3>Orders per status</h3>
          <p className="db-note">Van de laatste 25 orders.</p>
          <Ranks rows={perStatus.map(([status,value])=>({label:status,value:count(value),share:Math.round((value/top)*100)}))}/>
        </div>
      </div>
    </section>
  </>
}

function Facturen({data,busy,post}:{data:Data;busy:boolean;post:Post}){
  const failed=data.invoices.filter(invoice=>invoice.error||invoice.status.includes('mislukt'))
  const outstanding=data.invoiceStatus.filter(row=>row.status!=='betaald').reduce((sum,row)=>sum+Number(row.amount),0)
  return <>
    <section className="db-section">
      <h2>Facturen</h2>
      <p className="db-lead">Facturen maken we via de FINOM-koppeling aan, op naam van de gegevens uit de checkout.</p>
      <div className="db-grid cols-4">
        <Tile label="Facturen totaal" value={count(data.invoiceStatus.reduce((sum,row)=>sum+row.count,0))}/>
        <Tile label="Openstaand bedrag" value={euro(outstanding)} hint="nog niet als betaald gemeld"/>
        <Tile label="Mislukte pogingen" value={count(failed.length)} hint="in de laatste 25 facturen"/>
        <Tile label="Betaaltermijn" value={`${data.integration.paymentTermDays} dagen`} hint="uit de koppelinginstellingen"/>
      </div>
    </section>

    <section className="db-section">
      <div className="db-grid split">
        <div className="db-panel db-scroll">
          <h3>Laatste 25 facturen</h3>
          <p className="db-note">Mislukt een factuur? Dan kun je hem hier opnieuw laten aanmaken.</p>
          {data.invoices.length
            ?<table className="db-table"><thead><tr><th>Factuur</th><th>Order</th><th className="db-num">Bedrag</th><th>Status</th><th/></tr></thead>
              <tbody>{data.invoices.map(invoice=><tr key={invoice.id}>
                <td><b>{invoice.number??'zonder nummer'}</b><small>{moment(invoice.createdAt)}</small></td>
                <td><b>{invoice.orderNumber??'—'}</b><small>{invoice.companyName??invoice.email??''}</small></td>
                <td className="db-num">{euro(invoice.amount)}</td>
                <td><Status value={invoice.status}/>{invoice.error&&<small>{invoice.error}</small>}</td>
                <td>
                  {invoice.pdfUrl&&<a className="db-button ghost" href={invoice.pdfUrl} rel="noreferrer" target="_blank">Pdf</a>}
                  {(invoice.error||invoice.status.includes('mislukt'))&&<button className="db-button" disabled={busy} onClick={()=>post('/api/admin-actions',{action:'invoice',orderId:invoice.orderId})}>Opnieuw</button>}
                </td>
              </tr>)}</tbody></table>
            :<p className="db-empty">Er zijn nog geen facturen aangemaakt.</p>}
        </div>
        <div className="db-panel">
          <h3>Facturen per status</h3>
          <p className="db-note">Aantal en bedrag per status.</p>
          {data.invoiceStatus.length
            ?<table className="db-table"><tbody>{data.invoiceStatus.map(row=><tr key={row.status}><td><Status value={row.status}/></td><td className="db-num">{count(row.count)}</td><td className="db-num">{euro(row.amount)}</td></tr>)}</tbody></table>
            :<p className="db-empty">Nog niets te melden.</p>}
        </div>
      </div>
    </section>
  </>
}

function Catalogus({data}:{data:Data}){
  const top=Math.max(1,...data.catalog.perDepartment.map(row=>row.products))
  return <>
    <section className="db-section">
      <h2>Assortiment</h2>
      <p className="db-lead">Het vaste assortiment staat in de code van de winkel; eigen producten voeg je toe onder Producten. Hier zie je hoe het vaste assortiment ervoor staat.</p>
      <div className="db-grid cols-4">
        <Tile label="Producten" value={count(data.catalog.products)} hint={`${count(data.catalog.brands)} merken`}/>
        <Tile label="Afdelingen" value={count(data.catalog.departments)} hint={`${count(data.catalog.collections)} collecties, ${count(data.catalog.items)} onderwerpen`}/>
        <Tile label="Met actiekorting" value={count(data.catalog.deals)} hint={`${data.catalog.dealShare}% van het assortiment`}/>
        <Tile label="Gemiddelde actiekorting" value={`${data.catalog.averageDeal}%`} hint={`naast ${data.catalog.businessDiscount} ondernemerskorting`}/>
      </div>
    </section>

    <section className="db-section">
      <div className="db-grid split">
        <div className="db-panel">
          <h3>Producten per afdeling</h3>
          <p className="db-note">Aantal artikelen, met tussen haakjes het aantal met actiekorting.</p>
          <Ranks rows={data.catalog.perDepartment.map(row=>({label:`${row.name} (${count(row.deals)} in de actie)`,value:count(row.products),share:Math.round((row.products/top)*100)}))}/>
        </div>
        <div className="db-panel db-scroll">
          <h3>Hoogste actiekortingen</h3>
          <p className="db-note">Adviesprijs tegenover wat de klant nu betaalt.</p>
          <table className="db-table"><thead><tr><th>Product</th><th className="db-num">Korting</th><th className="db-num">Nu</th></tr></thead>
            <tbody>{data.catalog.topDeals.map(row=><tr key={row.name}><td>{row.name}<small>{row.department}</small></td><td className="db-num">-{row.dealPercent}%</td><td className="db-num">{euro(row.price)}<small>was {euro(row.listPrice??row.price)}</small></td></tr>)}</tbody></table>
        </div>
      </div>
    </section>
  </>
}

function Koppeling({data,busy,post}:{data:Data;busy:boolean;post:Post}){
  const integration=data.integration
  const[form,setForm]=useState({
    apiKey:'',
    baseUrl:integration.baseUrl,
    invoicePath:integration.invoicePath,
    paymentTermDays:String(integration.paymentTermDays),
    senderCompany:integration.senderCompany??'',
    senderVat:integration.senderVat??'',
    senderIban:integration.senderIban??'',
    senderAddress:integration.senderAddress??'',
    autoCreate:integration.autoCreate,
    active:integration.active,
  })
  const set=(field:keyof typeof form)=>(event:React.ChangeEvent<HTMLInputElement>)=>setForm(current=>({...current,[field]:event.target.type==='checkbox'?event.target.checked:event.target.value}))

  return <>
    <BunqKoppeling bunq={data.bunq} busy={busy} post={post}/>

    <section className="db-section">
      <h2>Bankkoppeling FINOM</h2>
      <p className="db-lead">Met je FINOM-API-sleutel maken we bij elke bestelling automatisch een factuur aan, gericht aan de gegevens die de klant bij het afrekenen invult. De sleutel bewaren we versleuteld buiten de code en is na opslaan niet meer te lezen.</p>
      <div className="db-grid cols-4">
        <Tile label="Koppeling" value={integration.active?'Aan':'Uit'} hint={integration.autoCreate?'facturen worden automatisch aangemaakt':'facturen maak je met de hand aan'}/>
        <Tile label="API-sleutel" value={integration.keyLast4?`•••• ${integration.keyLast4}`:'niet ingesteld'} hint={integration.keyUpdatedAt?`bijgewerkt ${moment(integration.keyUpdatedAt)}`:'voeg je sleutel hieronder toe'}/>
        <Tile label="Laatste controle" value={integration.lastCheckAt?moment(integration.lastCheckAt):'nog niet getest'} hint={integration.lastCheckMessage??''}/>
        <Tile label="Betaaltermijn" value={`${integration.paymentTermDays} dagen`} hint="staat op elke factuur"/>
      </div>
    </section>

    <section className="db-section">
      <div className="db-panel">
        <h3>Instellingen van de koppeling</h3>
        <p className="db-note">De sleutel vind je in FINOM onder Instellingen, API. Laat het sleutelveld leeg om de bestaande sleutel te bewaren.</p>
        <form className="db-form cols-2" onSubmit={event=>{event.preventDefault();post('/api/admin-integrations',{action:'save',...form,paymentTermDays:Number(form.paymentTermDays)})}}>
          <label className="db-field full">FINOM API-sleutel
            <input type="password" value={form.apiKey} onChange={set('apiKey')} placeholder={integration.keyLast4?`bewaard, eindigt op ${integration.keyLast4}`:'plak hier je sleutel'} autoComplete="off"/>
            <small>We bewaren de sleutel buiten de code en tonen alleen de laatste vier tekens.</small>
          </label>
          <label className="db-field">Api-adres<input value={form.baseUrl} onChange={set('baseUrl')} placeholder="https://api.finom.co"/><small>Alleen https.</small></label>
          <label className="db-field">Pad voor facturen<input value={form.invoicePath} onChange={set('invoicePath')} placeholder="/v1/invoices"/></label>
          <label className="db-field">Betaaltermijn in dagen<input type="number" min={1} max={90} value={form.paymentTermDays} onChange={set('paymentTermDays')}/></label>
          <label className="db-field">Bedrijfsnaam afzender<input value={form.senderCompany} onChange={set('senderCompany')}/></label>
          <label className="db-field">Btw-nummer afzender<input value={form.senderVat} onChange={set('senderVat')}/></label>
          <label className="db-field">IBAN<input value={form.senderIban} onChange={set('senderIban')}/></label>
          <label className="db-field full">Adres afzender<input value={form.senderAddress} onChange={set('senderAddress')}/></label>
          <label className="db-check"><input type="checkbox" checked={form.active} onChange={set('active')}/><span>Koppeling aan: facturen mogen naar FINOM.</span></label>
          <label className="db-check"><input type="checkbox" checked={form.autoCreate} onChange={set('autoCreate')}/><span>Maak de factuur automatisch aan zodra een klant afrekent.</span></label>
          <div className="db-actions">
            <button className="db-button" disabled={busy}>Instellingen opslaan</button>
            <button type="button" className="db-button ghost" disabled={busy} onClick={()=>post('/api/admin-integrations',{action:'test'})}>Verbinding testen</button>
            {integration.keyLast4&&<button type="button" className="db-button danger" disabled={busy} onClick={()=>post('/api/admin-integrations',{action:'remove-key'})}>Sleutel verwijderen</button>}
          </div>
        </form>
      </div>
    </section>

    <section className="db-section">
      <div className="db-panel">
        <h3>Wat er op de factuur komt</h3>
        <p className="db-note">Zo ziet FINOM de bestelling.</p>
        <p className="db-hint">
          Afzender: <b>{integration.senderCompany||'nog niet ingevuld'}</b>{integration.senderVat?` · btw ${integration.senderVat}`:''}{integration.senderIban?` · ${integration.senderIban}`:''}<br/>
          Ontvanger: de bedrijfsnaam, contactpersoon, adres en het btw-nummer uit de checkout.<br/>
          Regels: elk artikel met aantal, prijs exclusief btw en 21% btw, plus de {data.catalog.businessDiscount} ondernemerskorting als kortingsregel.<br/>
          Betaling: binnen {integration.paymentTermDays} dagen, met het ordernummer als referentie.
        </p>
      </div>
    </section>
  </>
}

/**
 * De koppeling met bunq. Bij elke bestelling maakt de winkel hiermee een
 * bunq.me-link met het bedrag en het ordernummer erop. De sleutel is na het
 * opslaan niet meer te bekijken, alleen te vervangen.
 */
function BunqKoppeling({bunq,busy,post}:{bunq:Bunq;busy:boolean;post:Post}){
  const[apiKey,setApiKey]=useState('')
  return <section className="db-section">
    <h2>Betalingen via bunq</h2>
    <p className="db-lead">Elke bestelling krijgt automatisch een bunq.me-betaallink met het totaalbedrag en het ordernummer als beschrijving. De klant gaat na het bestellen meteen naar die link en kiest daar iDEAL, Bancontact of creditcard.</p>
    <div className="db-grid cols-4">
      <Tile label="API-sleutel" value={bunq.source==='omgeving'?'via de omgeving':bunq.source==='beheer'?(bunq.keyLast4?`•••• ${bunq.keyLast4}`:'hier ingesteld'):'niet ingesteld'} hint={bunq.source==='omgeving'?'BUNQ_API_KEY heeft voorrang':'voeg je sleutel hieronder toe'}/>
      <Tile label="Rekening" value={bunq.connected?(bunq.iban||'gekoppeld'):'nog niet gekoppeld'} hint={bunq.connected?'hier komen de betalingen binnen':'wordt bij de eerste bestelling gekoppeld'}/>
      <Tile label="Betaallinks" value={bunq.configured?'Aan':'Uit'} hint={bunq.configured?'elke order krijgt een bunq.me-link':'klanten betalen nu op factuur'}/>
      <Tile label="Laatste fout" value={bunq.lastError?'zie hieronder':'geen'}/>
    </div>
    {bunq.lastError&&<p className="db-message is-bad"><AlertTriangle/> {bunq.lastError}</p>}
    <div className="db-panel">
      <h3>API-sleutel van bunq</h3>
      <p className="db-note">Te vinden in de bunq-app onder Instellingen, Ontwikkelaars, API-sleutels. Na opslaan is de sleutel niet meer te bekijken.</p>
      <form className="db-form cols-2" onSubmit={event=>{event.preventDefault();post('/api/admin-bunq',{action:'save',apiKey}).then(()=>setApiKey(''))}}>
        <label className="db-field full">{bunq.configured?'Nieuwe API-sleutel':'API-sleutel van bunq'}
          <input type="password" value={apiKey} onChange={event=>setApiKey(event.target.value)} placeholder={bunq.keyLast4?`bewaard, eindigt op ${bunq.keyLast4}`:'plak hier je sleutel'} autoComplete="off"/>
          {bunq.source==='omgeving'&&<small>De sleutel uit de omgevingsvariabele BUNQ_API_KEY heeft voorrang op wat je hier invult.</small>}
        </label>
        <div className="db-actions">
          <button className="db-button" disabled={busy||apiKey.trim().length===0}>Sleutel opslaan</button>
          {bunq.source==='beheer'&&<button type="button" className="db-button danger" disabled={busy} onClick={()=>post('/api/admin-bunq',{action:'remove-key'})}>Sleutel verwijderen</button>}
        </div>
      </form>
    </div>
  </section>
}

function Merk({data,busy,post}:{data:Data;busy:boolean;post:Post}){
  return <>
    <section className="db-section">
      <h2>Merk en instellingen</h2>
      <p className="db-lead">De naam, de contactgegevens en het logo van de winkel. Het logo bewaren we als bestand buiten de code, de teksten in de database.</p>
      <div className="db-panel">
        <h3>Winkelgegevens</h3>
        <p className="db-note">Deze gegevens gebruiken we in de winkel en op facturen.</p>
        <form className="db-form cols-2" onSubmit={event=>{event.preventDefault();post('/api/site-settings',new FormData(event.currentTarget))}}>
          <label className="db-field">Naam van de winkel<input name="siteName" defaultValue={data.settings.siteName} required/></label>
          <label className="db-field">Slogan<input name="tagline" defaultValue={data.settings.tagline??''} placeholder="Alles voor je bedrijf"/></label>
          <label className="db-field">E-mailadres klantenservice<input name="supportEmail" type="email" defaultValue={data.settings.supportEmail??''}/></label>
          <label className="db-field">Telefoonnummer klantenservice<input name="supportPhone" defaultValue={data.settings.supportPhone??''}/></label>
          <label className="db-field full">Logo<input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"/><small>PNG, JPG, WebP of SVG tot 2 MB.</small></label>
          <div className="db-actions">
            <button className="db-button" disabled={busy}>Opslaan</button>
            {data.settings.logoKey&&<a className="db-button ghost" href="/api/brand-logo" target="_blank" rel="noreferrer">Huidig logo bekijken</a>}
          </div>
        </form>
      </div>
    </section>

    <section className="db-section">
      <div className="db-grid cols-2">
        <div className="db-panel">
          <h3>Beheeraccounts</h3>
          <p className="db-note">Toegang regel je met Netlify Identity.</p>
          <p className="db-hint">De beheeromgeving werkt met één wachtwoord; er zijn geen accounts. Wil je het wachtwoord wijzigen, zet dan de omgevingsvariabele <span className="db-key">ADMIN_PASSWORD</span> in het Netlify-dashboard. De aanmelding blijft twaalf uur geldig.</p>
        </div>
        <div className="db-panel">
          <h3>Winkelafspraken</h3>
          <p className="db-note">Vast ingesteld in de winkel.</p>
          <table className="db-table"><tbody>
            <tr><td>Ondernemerskorting</td><td className="db-num">{data.catalog.businessDiscount}</td></tr>
            <tr><td>Btw-tarief</td><td className="db-num">21%</td></tr>
            <tr><td>Betaalwijze</td><td className="db-num">alleen op factuur</td></tr>
            <tr><td>Betaaltermijn</td><td className="db-num">{data.integration.paymentTermDays} dagen</td></tr>
          </tbody></table>
        </div>
      </div>
    </section>
  </>
}

type SpecGroup={title:string;specs:[string,string][]}
type VariantOption={title:string;type:'color'|'choice';values:string[]}
/** Een uitvoering (kleur, opslag) met een eigen prijs. Bedragen als tekst, zoals in de prijsvelden. */
type VariantDraft={sku:string;name:string;values:Record<string,string>;price:string;listPrice:string;imageIds:string[]}
type CatalogItem={id:number;slug:string;name:string;brand:string;category:string;collection:string|null;subcategory:string;series:string|null;colorName:string|null;description:string;bullets:string[];specGroups:SpecGroup[];price:string;listPrice:string|null;imageId:string|null;imageIds:string[]|null;sourceUrl:string|null;sourceSku:string|null;rating:string|null;reviews:number|null;stock:string|null;active:boolean;createdAt:string|null;variantOptions:VariantOption[]|null;variants:{sku:string;name:string;values:Record<string,string>;price:string;listPrice:string|null;imageIds:string[];specs?:[string,string][]}[]|null}
/** Wat in het productformulier staat. Bedragen blijven tekst zodat je ze typt zoals je gewend bent. */
type Draft={id?:number;name:string;brand:string;category:string;collection:string;subcategory:string;series:string;colorName:string;description:string;bullets:string;price:string;listPrice:string;stock:string;active:boolean;specGroups:SpecGroup[];imageId:string|null;imageIds:string[];sourceUrl:string|null;sourceSku:string|null;rating:number|null;reviews:number|null;variantOptions:VariantOption[];variants:VariantDraft[]}

const VAT=0.21
const places=placements()
const placeKey=(place:{category:string;collection:string|null;subcategory:string})=>`${place.category}|${place.collection??''}|${place.subcategory}`
const categoryName=(slug:string)=>categories.find(category=>category.slug===slug)?.name??slug
/** Bedrag voor in een invoerveld: 1299,95 */
const plain=(value:number|string|null|undefined)=>value==null||value===''?'':new Intl.NumberFormat('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false}).format(Number(value))
const specTotal=(groups:SpecGroup[])=>groups.reduce((sum,group)=>sum+group.specs.length,0)
const thumb=(imageId:string|null)=>imageId?`https://image.coolblue.nl/transparent/max/120xauto/products/${imageId}`:null

const toDraft=(item:CatalogItem):Draft=>({id:item.id,name:item.name,brand:item.brand,category:item.category,collection:item.collection??'',subcategory:item.subcategory,series:item.series??'',colorName:item.colorName??'',description:item.description,bullets:item.bullets.join('\n'),price:plain(item.price),listPrice:plain(item.listPrice),stock:item.stock??'',active:item.active,specGroups:item.specGroups,imageId:item.imageId,imageIds:item.imageIds?.length?item.imageIds:item.imageId?[item.imageId]:[],sourceUrl:item.sourceUrl,sourceSku:item.sourceSku,rating:item.rating?Number(item.rating):null,reviews:item.reviews,variantOptions:item.variantOptions??[],variants:(item.variants??[]).map(variant=>({...variant,price:plain(variant.price),listPrice:plain(variant.listPrice)}))})

/** Prijsveld inclusief btw, met direct eronder de prijs exclusief 21% btw. */
function PriceField({label,value,onChange,hint,optional=false}:{label:string;value:string;onChange:(value:string)=>void;hint?:string;optional?:boolean}){
  const amount=parseEuro(value)
  return <label className="db-field db-price-field">{label}
    <span className="db-price-input"><i>€</i><input inputMode="decimal" value={value} onChange={event=>onChange(event.target.value)} placeholder={optional?'leeg = geen korting':'0,00'} required={!optional}/><em>incl. btw</em></span>
    <small className="db-price-ex">{amount&&amount>0?<><b>{euro(amount/(1+VAT))}</b> excl. 21% btw · btw {euro(amount-amount/(1+VAT))}</>:hint??'Vul het bedrag inclusief btw in; wij rekenen de prijs zonder btw uit.'}</small>
  </label>
}

/** Korting uit prijs en was-prijs, of een waarschuwing als dat niet klopt. */
function DealLine({price,listPrice}:{price:string;listPrice:string}){
  const now=parseEuro(price)
  const was=parseEuro(listPrice)
  if(!listPrice.trim())return <p className="db-deal-line">Geen was-prijs: het product staat zonder doorgestreepte prijs in de winkel.</p>
  if(!now||!was)return null
  if(was<=now)return <p className="db-deal-line is-bad">De was-prijs moet hoger zijn dan de prijs.</p>
  return <p className="db-deal-line is-good">Klant ziet <s>{euro(was)}</s> → <b>{euro(now)}</b>: {Math.round((1-now/was)*100)}% korting, je bespaart {euro(was-now)} inclusief btw.</p>
}

/**
 * Alle uitvoeringen van het product, elk met een eigen prijs inclusief btw.
 * De uitvoering van de geplakte link volgt de prijs hierboven. Uitvoeringen die
 * je niet wilt verkopen haal je weg.
 */
function VariantTable({form,setForm}:{form:Draft;setForm:React.Dispatch<React.SetStateAction<Draft>>}){
  const update=(sku:string,field:'price'|'listPrice',value:string)=>setForm(current=>({...current,variants:current.variants.map(variant=>variant.sku===sku?{...variant,[field]:value}:variant)}))
  const drop=(sku:string)=>setForm(current=>({...current,variants:current.variants.filter(variant=>variant.sku!==sku)}))
  return <div className="db-variants full">
    <h4>Uitvoeringen <small>{form.variants.length} uitvoeringen · {form.variantOptions.map(option=>`${option.values.length} × ${option.title.toLowerCase()}`).join(', ')}</small></h4>
    <p className="db-note">Klanten kiezen deze uitvoeringen op één productpagina; de prijs verandert mee met hun keuze. Alle prijzen zijn inclusief 21% btw. De uitvoering van de geplakte link gebruikt de prijs hierboven.</p>
    <div className="db-scroll">
      <table className="db-table db-variant-table">
        <thead><tr><th/>{form.variantOptions.map(option=><th key={option.title}>{option.title}</th>)}<th className="db-num">Prijs incl. btw</th><th className="db-num">Was eerst</th><th/></tr></thead>
        <tbody>{form.variants.map(variant=>{
          const own=variant.sku===form.sourceSku
          const price=parseEuro(own?form.price:variant.price)
          return <tr key={variant.sku} className={own?'is-own':''}>
            <td className="db-thumb">{thumb(variant.imageIds[0]??null)?<img src={thumb(variant.imageIds[0])!} alt="" referrerPolicy="no-referrer"/>:<Package/>}</td>
            {form.variantOptions.map(option=><td key={option.title}>{variant.values[option.title]}</td>)}
            <td className="db-num">
              {own?<b>{form.price?euro(price??0):'—'}</b>:<input className="db-variant-price" inputMode="decimal" value={variant.price} onChange={event=>update(variant.sku,'price',event.target.value)} aria-label={`Prijs ${variant.name}`} required/>}
              <small>{price&&price>0?`${euro(price/(1+VAT))} excl. btw`:'vul een prijs in'}</small>
            </td>
            <td className="db-num">{own?<small>zie hierboven</small>:<input className="db-variant-price" inputMode="decimal" value={variant.listPrice} onChange={event=>update(variant.sku,'listPrice',event.target.value)} placeholder="leeg" aria-label={`Was-prijs ${variant.name}`}/>}</td>
            <td>{own?<small>standaard</small>:<button type="button" className="db-button ghost" onClick={()=>drop(variant.sku)} aria-label={`${variant.name} weghalen`}><X/></button>}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </div>
}

function ProductForm({draft,busy,onSave,onCancel}:{draft:Draft;busy:boolean;onSave:(draft:Draft)=>void;onCancel:()=>void}){
  const[form,setForm]=useState(draft)
  const[showSpecs,setShowSpecs]=useState(false)
  useEffect(()=>setForm(draft),[draft])
  const set=(field:keyof Draft)=>(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setForm(current=>({...current,[field]:event.target.type==='checkbox'?(event.target as HTMLInputElement).checked:event.target.value}))
  const setPlace=(event:React.ChangeEvent<HTMLSelectElement>)=>{const[category,collection,subcategory]=event.target.value.split('|');setForm(current=>({...current,category,collection,subcategory}))}
  const grouped=useMemo(()=>categories.map(category=>({category,options:places.filter(place=>place.category===category.slug)})),[])
  const image=thumb(form.imageIds[0]??form.imageId)
  const removePhoto=(id:string)=>setForm(current=>{const imageIds=current.imageIds.filter(item=>item!==id);return{...current,imageIds,imageId:imageIds[0]??current.imageId}})
  return <form className="db-form cols-2" onSubmit={event=>{event.preventDefault();onSave(form)}}>
    <div className="db-product-head full">
      {image?<img src={image} alt="" referrerPolicy="no-referrer"/>:<span className="db-product-noimg"><Package/></span>}
      <div>
        <b>{form.name||'Nieuw product'}</b>
        <small>{form.imageIds.length} {form.imageIds.length===1?'foto':"foto's"} · {specTotal(form.specGroups)} specificaties in {form.specGroups.length} groepen{form.sourceUrl?<> · <a href={form.sourceUrl} target="_blank" rel="noreferrer">bronpagina</a></>:null}</small>
      </div>
    </div>
    {form.imageIds.length>1&&<div className="db-photos full">
      <span>Productfoto's <small>De eerste foto is de hoofdfoto. Haal foto's weg die je niet in de winkel wilt tonen.</small></span>
      <ul>{form.imageIds.map((id,index)=><li key={id} className={index===0?'is-main':''}>
        <img src={thumb(id)!} alt={`Foto ${index+1}`} referrerPolicy="no-referrer" loading="lazy"/>
        {form.imageIds.length>1&&<button type="button" onClick={()=>removePhoto(id)} aria-label={`Foto ${index+1} weghalen`}><X/></button>}
      </li>)}</ul>
    </div>}
    <label className="db-field full">Productnaam<input value={form.name} onChange={set('name')} required/></label>
    <label className="db-field">Merk<input value={form.brand} onChange={set('brand')} required/></label>
    <label className="db-field">{form.variants.length>1?"Kleur (standaarduitvoering)":"Kleur"}<input value={form.colorName} onChange={set('colorName')} placeholder="bijvoorbeeld Zwart"/></label>
    <label className="db-field full">Collectie in de winkel
      <select value={placeKey(form)} onChange={setPlace} required>
        {grouped.map(({category,options})=><optgroup key={category.slug} label={category.name}>{options.map(place=><option key={placeKey(place)} value={placeKey(place)}>{place.collection} › {place.subcategory}</option>)}</optgroup>)}
      </select>
      <small>Automatisch herkend uit het kruimelpad van Coolblue: {categoryName(form.category)} › {form.collection} › {form.subcategory}.</small>
    </label>
    <label className="db-field">Serie<input value={form.series} onChange={set('series')} placeholder="bijvoorbeeld Apple iPhone 16"/></label>
    <label className="db-field">Levertijd<input value={form.stock} onChange={set('stock')} placeholder="Morgen in huis"/></label>

    <div className="db-price-box full">
      <h4>Prijs</h4>
      <p className="db-note">Alles wat je hier invult is inclusief 21% btw. De prijs exclusief btw rekenen we zelf uit en staat in de winkel altijd ernaast.</p>
      <div className="db-form cols-2">
        <PriceField label="Prijs (nu)" value={form.price} onChange={value=>setForm(current=>({...current,price:value}))}/>
        <PriceField label="Was eerst" value={form.listPrice} onChange={value=>setForm(current=>({...current,listPrice:value}))} optional hint="Optioneel. Hoger dan de prijs = doorgestreepte was-prijs met korting."/>
      </div>
      <DealLine price={form.price} listPrice={form.listPrice}/>
    </div>
    {form.variants.length>1&&<VariantTable form={form} setForm={setForm}/>}

    <label className="db-field full">Omschrijving<textarea rows={4} value={form.description} onChange={set('description')}/></label>
    <label className="db-field full">Belangrijkste kenmerken<textarea rows={3} value={form.bullets} onChange={set('bullets')}/><small>Eén kenmerk per regel; de eerste twee staan op de producttegel.</small></label>
    {form.specGroups.length>0&&<div className="full">
      <button type="button" className="db-button ghost" onClick={()=>setShowSpecs(value=>!value)}>{showSpecs?'Specificaties verbergen':`Alle ${specTotal(form.specGroups)} specificaties bekijken`}</button>
      {showSpecs&&<div className="db-spec-list">{form.specGroups.map(group=><div key={group.title}><h5>{group.title}</h5><table className="db-table"><tbody>{group.specs.map(([label,value],index)=><tr key={`${label}-${index}`}><td>{label}</td><td>{value}</td></tr>)}</tbody></table></div>)}</div>}
    </div>}
    <label className="db-check"><input type="checkbox" checked={form.active} onChange={set('active')}/><span>Direct zichtbaar in de winkel.</span></label>
    <div className="db-actions">
      <button className="db-button" disabled={busy}>{form.id?'Wijzigingen opslaan':'Toevoegen aan winkel'}</button>
      <button type="button" className="db-button ghost" disabled={busy} onClick={onCancel}>Annuleren</button>
    </div>
  </form>
}

/** Prijs en was-prijs van één product snel aanpassen, direct in de lijst. */
function QuickPrice({item,busy,onSave,onClose}:{item:CatalogItem;busy:boolean;onSave:(price:string,listPrice:string)=>void;onClose:()=>void}){
  const[price,setPrice]=useState(plain(item.price))
  const[listPrice,setListPrice]=useState(plain(item.listPrice))
  return <form className="db-quick-price" onSubmit={event=>{event.preventDefault();onSave(price,listPrice)}}>
    <div className="db-form cols-2">
      <PriceField label="Prijs (nu)" value={price} onChange={setPrice}/>
      <PriceField label="Was eerst" value={listPrice} onChange={setListPrice} optional hint="Leeg laten = geen korting."/>
    </div>
    <DealLine price={price} listPrice={listPrice}/>
    <div className="db-actions">
      <button className="db-button" disabled={busy}>Prijs opslaan</button>
      {item.listPrice&&<button type="button" className="db-button ghost" disabled={busy} onClick={()=>onSave(price,'')}>Korting stoppen</button>}
      <button type="button" className="db-button ghost" onClick={onClose}>Sluiten</button>
    </div>
  </form>
}

function Producten(){
  const[items,setItems]=useState<CatalogItem[]|null>(null)
  const[url,setUrl]=useState('')
  const[draft,setDraft]=useState<Draft|null>(null)
  const[existing,setExisting]=useState<{id:number;name:string}|null>(null)
  const[pricing,setPricing]=useState<number|null>(null)
  const[busy,setBusy]=useState(false)
  const[message,setMessage]=useState<{text:string;ok:boolean}|null>(null)
  const[query,setQuery]=useState('')

  const load=useCallback(async()=>{
    const response=await fetch('/api/admin-products').catch(()=>null)
    if(!response?.ok){setMessage({text:'De producten konden niet worden geladen.',ok:false});setItems([]);return}
    setItems((await response.json()).products)
  },[])
  useEffect(()=>{load()},[load])

  /** Eén plek voor alle producthandelingen. Geeft het antwoord terug bij succes. */
  const call=async(body:Record<string,unknown>)=>{
    setBusy(true);setMessage(null)
    try{
      const response=await fetch('/api/admin-products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const result=await response.json().catch(()=>({}))
      const ok=response.ok&&!result.error
      setMessage({text:result.error??result.message??(ok?'Opgeslagen.':'Dat lukte niet.'),ok})
      if(!ok)return null
      if(body.action!=='fetch')await load()
      return result
    }catch{
      setMessage({text:'De server reageerde niet. Probeer het opnieuw.',ok:false})
      return null
    }finally{
      setBusy(false)
    }
  }

  const fetchUrl=async(event:React.FormEvent)=>{
    event.preventDefault()
    const result=await call({action:'fetch',url})
    if(!result)return
    const source=result.draft
    setExisting(result.existing)
    setDraft({name:source.name,brand:source.brand,category:source.category,collection:source.collection,subcategory:source.subcategory,series:source.series??'',colorName:source.colorName??'',description:source.description,bullets:source.bullets.join('\n'),price:plain(source.price),listPrice:plain(source.listPrice),stock:'',active:true,specGroups:source.specGroups,imageId:source.imageId,imageIds:source.imageIds??(source.imageId?[source.imageId]:[]),sourceUrl:source.sourceUrl,sourceSku:source.sourceSku,rating:source.rating,reviews:source.reviews,variantOptions:source.variantOptions??[],variants:(source.variants??[]).map((variant:{sku:string;name:string;values:Record<string,string>;price:number|null;listPrice:number|null;imageIds:string[]})=>({...variant,price:plain(variant.price),listPrice:plain(variant.listPrice)}))})
  }

  const save=async(form:Draft)=>{
    const result=await call({action:'save',product:{...form,bullets:form.bullets.split('\n')}})
    if(result){setDraft(null);setExisting(null);setUrl('')}
  }

  const shown=(items??[]).filter(item=>!query||`${item.name} ${item.brand} ${item.subcategory}`.toLowerCase().includes(query.toLowerCase()))
  const active=(items??[]).filter(item=>item.active).length
  const onSale=(items??[]).filter(item=>item.listPrice).length

  return <>
    <section className="db-section">
      <h2>Producten</h2>
      <p className="db-lead">Voeg producten toe door de link van een Coolblue-productpagina te plakken. Naam, merk, alle kleuren en opslagvarianten, serie, collectie, prijzen, foto's en alle specificaties nemen we over als één product; jij controleert en past de prijzen aan.</p>
      <div className="db-grid cols-4">
        <Tile label="Toegevoegde producten" value={count(items?.length??0)} hint="naast het vaste assortiment"/>
        <Tile label="Zichtbaar in de winkel" value={count(active)} hint={`${count((items?.length??0)-active)} verborgen`}/>
        <Tile label="Met was-prijs" value={count(onSale)} hint="tonen een doorgestreepte prijs"/>
        <Tile label="Btw-tarief" value="21%" hint="prijzen die je invult zijn inclusief btw"/>
      </div>
    </section>

    {message&&<p className={`db-message ${message.ok?'is-good':'is-bad'}`}>{message.text}</p>}

    <section className="db-section">
      <div className="db-panel">
        <h3>Product toevoegen vanaf coolblue.nl</h3>
        <p className="db-note">Plak de volledige link, bijvoorbeeld https://www.coolblue.nl/product/952114/apple-iphone-16-128gb-zwart.html</p>
        <form className="db-import" onSubmit={fetchUrl}>
          <input type="url" value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://www.coolblue.nl/product/…" required aria-label="Link naar de productpagina"/>
          <button className="db-button" disabled={busy}><Download/>{busy&&!draft?'Ophalen…':'Gegevens ophalen'}</button>
          <button type="button" className="db-button ghost" disabled={busy} onClick={()=>{setExisting(null);setDraft({name:'',brand:'',...places[0],series:'',colorName:'',description:'',bullets:'',price:'',listPrice:'',stock:'',active:true,specGroups:[],imageId:null,imageIds:[],sourceUrl:null,sourceSku:null,rating:null,reviews:null,variantOptions:[],variants:[]})}}><Plus/>Zelf invullen</button>
        </form>
      </div>
    </section>

    {draft&&<section className="db-section">
      <div className="db-panel">
        <h3>{draft.id?'Product bewerken':'Controleren en toevoegen'}</h3>
        <p className="db-note">{draft.id?'Pas de gegevens aan en sla op.':'Dit hebben we van de pagina gehaald. Pas aan wat nodig is.'}</p>
        {existing&&!draft.id&&<p className="db-message is-bad">Let op: dit Coolblue-artikel staat al in de winkel als “{existing.name}”. Opslaan maakt een tweede product aan. <button type="button" className="db-link" onClick={()=>setDraft(current=>current&&{...current,id:existing.id})}>Bestaand product bijwerken met deze foto's en gegevens</button></p>}
        <ProductForm draft={draft} busy={busy} onSave={save} onCancel={()=>{setDraft(null);setExisting(null)}}/>
      </div>
    </section>}

    <section className="db-section">
      <div className="db-panel db-scroll">
        <div className="db-panel-head">
          <div><h3>Alle toegevoegde producten</h3><p className="db-note">Prijzen inclusief btw, met eronder de prijs exclusief 21% btw.</p></div>
          <input className="db-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Zoek op naam of merk" aria-label="Zoek producten"/>
        </div>
        {items===null?<p className="db-empty">Producten laden…</p>:shown.length===0?<p className="db-empty">{items.length?'Geen producten gevonden.':'Nog geen producten toegevoegd. Plak hierboven een link om te beginnen.'}</p>:
        <table className="db-table db-products">
          <thead><tr><th/><th>Product</th><th className="db-num">Prijs</th><th className="db-num">Was eerst</th><th>Status</th><th/></tr></thead>
          <tbody>{shown.map(item=><Fragment key={item.id}>
            <tr>
              <td className="db-thumb">{thumb(item.imageId)?<img src={thumb(item.imageId)!} alt="" referrerPolicy="no-referrer"/>:<Package/>}</td>
              <td><b>{item.name}</b><small>{categoryName(item.category)} › {item.subcategory}{item.variants?.length?` · ${item.variants.length} uitvoeringen`:item.colorName?` · ${item.colorName}`:''} · {specTotal(item.specGroups)} specs</small></td>
              <td className="db-num"><b>{euro(item.price)}</b><small>{euro(Number(item.price)/(1+VAT))} excl. btw</small></td>
              <td className="db-num">{item.listPrice?<><s>{euro(item.listPrice)}</s><small>-{Math.round((1-Number(item.price)/Number(item.listPrice))*100)}% · {euro(Number(item.listPrice)/(1+VAT))} excl.</small></>:<small>—</small>}</td>
              <td><Status value={item.active?'zichtbaar':'verborgen'}/></td>
              <td className="db-row-actions">
                <button className="db-button ghost" disabled={busy} onClick={()=>setPricing(pricing===item.id?null:item.id)}><Tag/>Prijs</button>
                <button className="db-button ghost" disabled={busy} onClick={()=>{setExisting(null);setDraft(toDraft(item));window.scrollTo({top:0,behavior:'smooth'})}}><Pencil/>Bewerken</button>
                <button className="db-button ghost" disabled={busy} onClick={()=>call({action:'toggle',id:item.id,active:!item.active})}>{item.active?<><EyeOff/>Verbergen</>:<><Eye/>Tonen</>}</button>
                {item.active&&<a className="db-button ghost" href={`/products/${item.slug}`} target="_blank" rel="noreferrer"><ExternalLink/>Bekijk</a>}
                <button className="db-button danger" disabled={busy} onClick={()=>{if(confirm(`${item.name} definitief verwijderen?`))call({action:'delete',id:item.id})}}><Trash2/>Verwijderen</button>
              </td>
            </tr>
            {pricing===item.id&&<tr className="db-price-row"><td/><td colSpan={5}><QuickPrice item={item} busy={busy} onClose={()=>setPricing(null)} onSave={async(price,listPrice)=>{if(await call({action:'price',id:item.id,price,listPrice}))setPricing(null)}}/></td></tr>}
          </Fragment>)}</tbody>
        </table>}
      </div>
    </section>
  </>
}
