import{createFileRoute,Link}from'@tanstack/react-router'
import{useMemo,useState}from'react'
import{AlertTriangle,ArrowRight,Check,FileText,Minus,Percent,Plus,ShieldCheck,Truck}from'lucide-react'
import{businessDiscount,businessDiscountPercent,exVat,money,priced,type Product}from'@/data/products'
import{photoForProduct}from'@/data/media'
import{useCatalog}from'@/lib/shop-products'
import{ProductVisual}from'@/components/ProductVisual'
import{useCart}from'@/lib/cart-context'

export const Route=createFileRoute('/checkout')({
  head:()=>({meta:[
    {title:'Bestelling afronden | Coolblue Zakelijk'},
    {name:'description',content:`Rond je zakelijke bestelling af. Je rekent af op factuur en krijgt ${businessDiscountPercent} ondernemerskorting op je hele bestelling.`},
  ]}),
  component:Checkout,
})

type Confirmation={orderNumber:string;totals:{subtotal:number;discount:number;total:number;vatAmount:number};paymentTermDays:number;invoice:{status:string;number?:string|null;pdfUrl?:string|null;error?:string|null}}

const fields=['companyName','kvk','vatNumber','reference','firstName','lastName','email','phone','street','houseNumber','postalCode','city','notes'] as const
type FieldName=typeof fields[number]
const empty=Object.fromEntries(fields.map(field=>[field,'']))as Record<FieldName,string>

function Checkout(){
  const{items,add,remove,clear}=useCart()
  const[form,setForm]=useState(empty)
  const[business,setBusiness]=useState(true)
  const[sending,setSending]=useState(false)
  const[error,setError]=useState('')
  const[done,setDone]=useState<Confirmation|null>(null)
  const set=(field:FieldName)=>(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setForm(current=>({...current,[field]:event.target.value}))

  // Het mandje bewaart losse regels; gelijke artikelen in dezelfde uitvoering tellen we samen tot één orderregel.
  const{byId}=useCatalog()
  const lines=useMemo(()=>{
    const grouped=new Map<string,{id:number;variant?:string;quantity:number}>()
    for(const item of items){
      const key=`${item.id}|${item.variant??''}`
      const line=grouped.get(key)
      if(line)line.quantity++
      else grouped.set(key,{...item,quantity:1})
    }
    return[...grouped.entries()].map(([key,{id,variant,quantity}])=>{
      const product=byId(id)
      return product?{key,product,quantity,...priced(product,variant),sku:variant}:null
    }).filter((line):line is{key:string;product:Product;quantity:number;sku:string|undefined}&ReturnType<typeof priced>=>Boolean(line))
  },[items,byId])

  const subtotal=lines.reduce((sum,line)=>sum+line.price*line.quantity,0)
  const discount=business?subtotal*businessDiscount:0
  const total=subtotal-discount
  const vatAmount=total-exVat(total)

  const send=async(event:React.FormEvent)=>{
    event.preventDefault()
    setSending(true);setError('')
    try{
      const response=await fetch('/api/checkout',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,businessOrder:business,items:lines.map(line=>({productId:line.product.id,variant:line.sku,quantity:line.quantity}))}),
      })
      const result=await response.json().catch(()=>null)
      if(!response.ok||!result?.ok){setError(result?.error??'Het afrekenen lukte niet. Probeer het nog eens of bel ons.');return}
      setDone(result as Confirmation)
      clear()
    }catch{
      setError('We konden de bestelling niet versturen. Controleer je verbinding en probeer het opnieuw.')
    }finally{
      setSending(false)
    }
  }

  if(done)return <div className="wrap co-done">
    <span className="kicker">Bestelling ontvangen</span>
    <h1>Bedankt, je bestelling staat op factuur.</h1>
    <p className="co-done-lead">We hebben je bestelling met ordernummer <b>{done.orderNumber}</b> in behandeling. De factuur gaat naar de gegevens die je hebt ingevuld en je hebt {done.paymentTermDays} dagen om te betalen.</p>
    <div className="co-done-grid">
      <article>
        <h2>Bedragen</h2>
        <table className="co-table">
          <tbody>
            <tr><th>Subtotaal incl. btw</th><td>{money(done.totals.subtotal)}</td></tr>
            {done.totals.discount>0&&<tr><th>Tijdelijke ondernemerskorting ({businessDiscountPercent})</th><td>−{money(done.totals.discount)}</td></tr>}
            <tr><th>Totaal incl. btw</th><td><b>{money(done.totals.total)}</b></td></tr>
            <tr><th>Waarvan 21% btw</th><td>{money(done.totals.vatAmount)}</td></tr>
            <tr><th>Totaal excl. btw</th><td>{money(done.totals.total-done.totals.vatAmount)}</td></tr>
          </tbody>
        </table>
      </article>
      <article>
        <h2>Je factuur</h2>
        {done.invoice.status==='niet aangemaakt'
          ?<p className="co-invoice-note"><FileText/> Je factuur wordt met de hand opgemaakt en per e-mail verstuurd.</p>
          :done.invoice.error
            ?<p className="co-invoice-note is-bad"><AlertTriangle/> De factuur is nog niet klaar. Onze administratie pakt dit op en stuurt je de factuur per e-mail.</p>
            :<p className="co-invoice-note is-good"><Check/> Factuur {done.invoice.number??'is aangemaakt'} staat klaar.{done.invoice.pdfUrl?<> <a href={done.invoice.pdfUrl} rel="noreferrer">Download de pdf</a>.</>:null}</p>}
        <p className="co-invoice-note"><Truck/> Zodra we je bestelling inpakken, krijg je een bericht met het bezorgmoment.</p>
      </article>
    </div>
    <Link to="/" className="button primary">Verder winkelen<ArrowRight/></Link>
  </div>

  return <div className="wrap co">
    <h1>Bestelling afronden</h1>

    <div className="co-grid">
      <form className="co-form" onSubmit={send}>
        <section className="co-card">
          <h2>Bedrijfsgegevens</h2>
          <label className="co-switch">
            <input type="checkbox" checked={business} onChange={event=>setBusiness(event.target.checked)}/>
            <span><b>Dit is een zakelijke bestelling</b><small>Je krijgt {businessDiscountPercent} ondernemerskorting op je hele bestelling.</small></span>
          </label>
          <div className="co-fields">
            <label className="co-field full">Bedrijfsnaam<input value={form.companyName} onChange={set('companyName')} required={business} autoComplete="organization"/></label>
            <label className="co-field"><span>KvK-nummer <span className="co-optional">(optioneel)</span></span><input value={form.kvk} onChange={set('kvk')} inputMode="numeric"/></label>
            <label className="co-field"><span>Btw-nummer <span className="co-optional">(optioneel)</span></span><input value={form.vatNumber} onChange={set('vatNumber')} placeholder="NL123456789B01"/></label>
            <label className="co-field full"><span>Referentie of inkoopnummer <span className="co-optional">(optioneel)</span></span><input value={form.reference} onChange={set('reference')}/><small>Zetten we op de factuur, handig voor je administratie.</small></label>
          </div>
        </section>

        <section className="co-card">
          <h2>Contactpersoon</h2>
          <div className="co-fields">
            <label className="co-field">Voornaam<input value={form.firstName} onChange={set('firstName')} required autoComplete="given-name"/></label>
            <label className="co-field">Achternaam<input value={form.lastName} onChange={set('lastName')} required autoComplete="family-name"/></label>
            <label className="co-field">E-mailadres<input type="email" value={form.email} onChange={set('email')} required autoComplete="email"/><small>Hier sturen we de factuur naartoe.</small></label>
            <label className="co-field">Telefoonnummer<input value={form.phone} onChange={set('phone')} autoComplete="tel"/></label>
          </div>
        </section>

        <section className="co-card">
          <h2>Bezorgadres</h2>
          <div className="co-fields">
            <label className="co-field">Straat<input value={form.street} onChange={set('street')} autoComplete="address-line1"/></label>
            <label className="co-field">Huisnummer<input value={form.houseNumber} onChange={set('houseNumber')} required/></label>
            <label className="co-field">Postcode<input value={form.postalCode} onChange={set('postalCode')} required autoComplete="postal-code" placeholder="1234 AB"/></label>
            <label className="co-field">Plaats<input value={form.city} onChange={set('city')} autoComplete="address-level2"/></label>
            <label className="co-field full">Opmerking voor de bezorger of administratie<textarea value={form.notes} onChange={set('notes')} rows={3}/></label>
          </div>
        </section>

        <section className="co-card co-payment">
          <h2>Betaalwijze</h2>
          <div className="co-payment-row">
            <FileText/>
            <div><b>Op factuur</b></div>
            <Check className="co-payment-check"/>
          </div>
          <p className="co-hint">We maken je factuur automatisch aan via onze bankkoppeling, op naam van de bedrijfsgegevens die je hierboven invult.</p>
        </section>

        {error&&<p className="co-error"><AlertTriangle/> {error}</p>}
        <button className="button primary co-submit" disabled={!lines.length||sending}>{sending?'Bestelling wordt verwerkt…':'Bestelling op factuur plaatsen'}</button>
      </form>

      <aside className="co-summary">
        <h2>Jouw bestelling</h2>
        {lines.length===0
          ?<p className="co-empty">Je mandje is nog leeg. <Link to="/">Bekijk het assortiment</Link>.</p>
          :lines.map(({key,product,sku:variant,quantity,price,name,imageId,label})=><div className="co-line" key={key}>
            <ProductVisual icon={product.icon} color={product.color} photo={photoForProduct({...product,imageId},200)} alt={name} sizes="64px"/>
            <div className="co-line-body">
              <Link to="/products/$productId" params={{productId:product.slug}} search={variant?{uitvoering:variant}:{}}>{name}</Link>
              {label&&<small className="co-line-variant">{label}</small>}
              <small>{money(price)} per stuk · {money(exVat(price))} excl. btw</small>
              <div className="co-line-amount">
                <button type="button" onClick={()=>remove(product.id,variant)} aria-label={`Eén ${name} minder`}><Minus/></button>
                <span>{quantity}</span>
                <button type="button" onClick={()=>add(product.id,variant,{quiet:true})} aria-label={`Eén ${name} meer`}><Plus/></button>
              </div>
            </div>
            <b>{money(price*quantity)}</b>
          </div>)}

        {lines.length>0&&<table className="co-table">
          <tbody>
            <tr><th>Subtotaal incl. btw</th><td>{money(subtotal)}</td></tr>
            {discount>0&&<tr className="co-discount"><th>Tijdelijke ondernemerskorting ({businessDiscountPercent})</th><td>−{money(discount)}</td></tr>}
            <tr><th>Bezorging</th><td>Gratis</td></tr>
            <tr className="co-total"><th>Totaal incl. btw</th><td>{money(total)}</td></tr>
            <tr><th>Waarvan 21% btw</th><td>{money(vatAmount)}</td></tr>
            <tr><th>Totaal excl. btw</th><td>{money(exVat(total))}</td></tr>
          </tbody>
        </table>}

        <ul className="co-usps">
          <li><FileText/> Factuur met btw-specificatie in je mailbox</li>
          <li><Percent/> {businessDiscountPercent} ondernemerskorting verrekend, tijdelijke actie</li>
          <li><Truck/> Morgen bezorgd op je zakelijke adres</li>
          <li><ShieldCheck/> 30 dagen retourrecht, ook zakelijk</li>
        </ul>
      </aside>
    </div>
  </div>
}
