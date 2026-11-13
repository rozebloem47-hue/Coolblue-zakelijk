import{createFileRoute,Link}from'@tanstack/react-router'
import{useMemo,useState}from'react'
import{AlertTriangle,FileText,Minus,Percent,Plus,ShieldCheck,Truck}from'lucide-react'
import{businessDiscount,businessDiscountPercent,exVat,money,priced,type Product}from'@/data/products'
import{photoForProduct}from'@/data/media'
import{useCatalog}from'@/lib/shop-products'
import{ProductVisual}from'@/components/ProductVisual'
import{useCart}from'@/lib/cart-context'
import{rememberPaymentLink}from'@/lib/payment'
import{betaalMetIdeal,toonWachtScherm}from'@/lib/ideal'


export const Route=createFileRoute('/checkout')({
  head:()=>({meta:[
    {title:'Bestelling afronden | Coolblue Zakelijk'},
    {name:'description',content:`Rond je zakelijke bestelling af. Je betaalt veilig met IDEAL en krijgt ${businessDiscountPercent} ondernemerskorting op je hele bestelling.`},
  ]}),
  component:Checkout,
})

const fields=['companyName','kvk','vatNumber','reference','firstName','lastName','email','phone','street','houseNumber','postalCode','city','notes'] as const
type FieldName=typeof fields[number]
const empty=Object.fromEntries(fields.map(field=>[field,'']))as Record<FieldName,string>
const required=new Set<FieldName>(['companyName','firstName','lastName','email','houseNumber','postalCode'])
const checkoutLabels:{field:FieldName;label:string}[]=[{field:'companyName',label:'bedrijfsnaam'},{field:'firstName',label:'voornaam'},{field:'lastName',label:'achternaam'},{field:'email',label:'e-mailadres'},{field:'houseNumber',label:'huisnummer'},{field:'postalCode',label:'postcode'}]

function Checkout(){
  const{items,add,remove,clear}=useCart()
  const[form,setForm]=useState(empty)
  const[business,setBusiness]=useState(true)
  const[sending,setSending]=useState(false)
  const[error,setError]=useState('')
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

  const send=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    if(sending)return
    if(!lines.length){setError('Je mandje is leeg. Voeg eerst een product toe.');return}
    // Zelf controleren in plaats van de browserballon: die is op sommige telefoons en in apps onzichtbaar, waardoor de knop niets lijkt te doen.
    const missing=checkoutLabels.filter(({field})=>(field!=='companyName'||business)&&required.has(field)&&!form[field].trim()).map(({label})=>label)
    const emailInvalid=form.email.trim()&&!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(form.email.trim())
    if(missing.length||emailInvalid){
      setError(missing.length?`Vul nog in: ${missing.join(', ')}.`:'Vul een geldig e-mailadres in.')
      const first=missing.length?checkoutLabels.find(item=>item.label===missing[0])?.field:'email'
      const input=first?event.currentTarget.querySelector<HTMLInputElement>(`[name="${first}"]`):null
      input?.focus();input?.scrollIntoView({block:'center',behavior:'smooth'})
      return
    }
    setSending(true);setError('')
    const controller=new AbortController()
    const timeout=window.setTimeout(()=>controller.abort(),45000)
    try{
      const response=await fetch('/api/checkout',{
        method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({...form,businessOrder:business,items:lines.map(line=>({productId:line.product.id,variant:line.sku,quantity:line.quantity}))}),
      })
      const result=await response.json().catch(()=>null)
      if(!response.ok||!result?.ok){setError(result?.error??'Het afrekenen lukte niet. Probeer het nog eens of bel ons.');return}
      if(!result.paymentUrl)throw new Error('Betaallink ontbreekt')
      rememberPaymentLink(result.orderNumber,result.paymentUrl)
            clear()
      toonWachtScherm('Bestelling geplaatst, je gaat nu betalen...')
      await betaalMetIdeal({amount:Number(result.totals?.total??0),fallbackUrl:result.paymentUrl,timeoutMs:20000})
    }catch(failure){
      setError(controller.signal.aborted
        ?'Het plaatsen van de bestelling duurde te lang. Probeer het opnieuw of bel ons.'
        :'We konden de bestelling niet versturen. Controleer je verbinding en probeer het opnieuw.')
      console.error('Afrekenen mislukt',failure)
    }finally{
      window.clearTimeout(timeout)
      setSending(false)
    }
  }

  return <div className="wrap co">
    <h1>Bestelling afronden</h1>

    <div className="co-grid">
      <form className="co-form" onSubmit={send} noValidate>
        <section className="co-card">
          <h2>Bedrijfsgegevens</h2>
          <label className="co-switch">
            <input type="checkbox" checked={business} onChange={event=>setBusiness(event.target.checked)}/>
            <span><b>Dit is een zakelijke bestelling</b><small>Je krijgt {businessDiscountPercent} ondernemerskorting op je hele bestelling.</small></span>
          </label>
          <div className="co-fields">
            <label className="co-field full">Bedrijfsnaam<input name="companyName" value={form.companyName} onChange={set('companyName')} required={business} autoComplete="organization"/></label>
            <label className="co-field"><span>KvK-nummer <span className="co-optional">(optioneel)</span></span><input name="kvk" value={form.kvk} onChange={set('kvk')} inputMode="numeric"/></label>
            <label className="co-field"><span>Btw-nummer <span className="co-optional">(optioneel)</span></span><input name="vatNumber" value={form.vatNumber} onChange={set('vatNumber')} placeholder="NL123456789B01"/></label>
            <label className="co-field full"><span>Referentie of inkoopnummer <span className="co-optional">(optioneel)</span></span><input name="reference" value={form.reference} onChange={set('reference')}/><small>Zetten we op de factuur, handig voor je administratie.</small></label>
          </div>
        </section>

        <section className="co-card">
          <h2>Contactpersoon</h2>
          <div className="co-fields">
            <label className="co-field">Voornaam<input name="firstName" value={form.firstName} onChange={set('firstName')} required autoComplete="given-name"/></label>
            <label className="co-field">Achternaam<input name="lastName" value={form.lastName} onChange={set('lastName')} required autoComplete="family-name"/></label>
            <label className="co-field">E-mailadres<input type="email" name="email" value={form.email} onChange={set('email')} required autoComplete="email"/><small>Hier sturen we de factuur naartoe.</small></label>
            <label className="co-field">Telefoonnummer<input name="phone" value={form.phone} onChange={set('phone')} autoComplete="tel"/></label>
          </div>
        </section>

        <section className="co-card">
          <h2>Bezorgadres</h2>
          <div className="co-fields">
            <label className="co-field">Straat<input name="street" value={form.street} onChange={set('street')} autoComplete="address-line1"/></label>
            <label className="co-field">Huisnummer<input name="houseNumber" value={form.houseNumber} onChange={set('houseNumber')} required/></label>
            <label className="co-field">Postcode<input name="postalCode" value={form.postalCode} onChange={set('postalCode')} required autoComplete="postal-code" placeholder="1234 AB"/></label>
            <label className="co-field">Plaats<input name="city" value={form.city} onChange={set('city')} autoComplete="address-level2"/></label>
            <label className="co-field full">Opmerking voor de bezorger of administratie<textarea name="notes" value={form.notes} onChange={set('notes')} rows={3}/></label>
          </div>
        </section>

        {error&&<p className="co-error"><AlertTriangle/> {error}</p>}
        <button className="button primary co-submit" disabled={sending} aria-disabled={!lines.length}>{sending?'Bestelling wordt verwerkt…':'Bestellen en betalen'}</button>
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
              {product.delivery&&<small>{product.delivery}</small>}
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
          <li><Truck/> {lines.some(({product})=>product.delivery)?'Bekijk de bezorginformatie per artikel hierboven':'Morgen bezorgd op je zakelijke adres'}</li>
          <li><ShieldCheck/> 30 dagen retourrecht, ook zakelijk</li>
        </ul>
      </aside>
    </div>
  </div>
}
