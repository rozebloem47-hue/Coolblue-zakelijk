import{createFileRoute,Link}from'@tanstack/react-router'
import{useEffect,useState}from'react'
import{ArrowRight,Check,FileText,Truck}from'lucide-react'
import{recallPaymentLink}from'@/lib/payment'

/** Hierheen stuurt bunq de klant terug na de betaling op de bunq.me-pagina. */
export const Route=createFileRoute('/bedankt')({
  validateSearch:(search:Record<string,unknown>)=>({ref:typeof search.ref==='string'?search.ref.slice(0,40):''}),
  head:()=>({meta:[
    {title:'Bedankt voor je bestelling | Coolblue Zakelijk'},
    {name:'robots',content:'noindex'},
  ]}),
  component:Thanks,
})

function Thanks(){
  const{ref}=Route.useSearch()

  // De betaallink staat in dit tabblad, zodat een weggeklikte betaling nog kan.
  const[paymentUrl,setPaymentUrl]=useState('')
  useEffect(()=>{setPaymentUrl(recallPaymentLink(ref))},[ref])

  return <div className="wrap co-done">
    <span className="kicker">Bestelling ontvangen</span>
    <h1>Bedankt voor je bestelling.</h1>
    <p className="co-done-lead">{ref?<>We hebben je bestelling met ordernummer <b>{ref}</b> in behandeling.</>:'We hebben je bestelling in behandeling.'} Zodra je betaling via bunq binnen is, pakken we hem in.</p>
    <div className="co-done-grid">
      <article>
        <h2>Je betaling</h2>
        <p className="co-invoice-note is-good"><Check/> Heb je op de bunq-pagina betaald? Dan hoef je niets meer te doen.</p>
        {paymentUrl&&<p className="co-invoice-note">Nog niet betaald of de betaalpagina weggeklikt? <a href={paymentUrl} rel="noreferrer">Ga terug naar de betaling</a> — het bedrag en je ordernummer staan er al bij.</p>}
      </article>
      <article>
        <h2>Je factuur</h2>
        <p className="co-invoice-note"><FileText/> De factuur met btw-specificatie gaat naar de gegevens die je hebt ingevuld.</p>
        <p className="co-invoice-note"><Truck/> Zodra we je bestelling inpakken, krijg je een bericht met het bezorgmoment.</p>
      </article>
    </div>
    <Link to="/" className="button primary">Verder winkelen<ArrowRight/></Link>
  </div>
}
