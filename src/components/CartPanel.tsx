import{useEffect,useMemo}from'react'
import{Link}from'@tanstack/react-router'
import{ArrowRight,Check,Clock,ShoppingCart,X}from'lucide-react'
import{businessDiscount,businessDiscountPercent,exVat,money,priced}from'@/data/products'
import{photoForProduct}from'@/data/media'
import{useCatalog}from'@/lib/shop-products'
import{useCart}from'@/lib/cart-context'
import{ProductVisual}from'./ProductVisual'

/** Zoveel regels tonen we in het paneel; de rest staat op de afrekenpagina. */
const SHOWN_LINES=4

/** Uitklapmandje onder het winkelwagenicoon: opent na het toevoegen van een artikel en bij hover, met de weg naar afrekenen. */
export function CartPanel(){
  const{items,panelOpen,lastAdded,closePanel}=useCart()
  const{byId}=useCatalog()

  // Gelijke artikelen in dezelfde uitvoering tellen we samen, net als op de afrekenpagina.
  const lines=useMemo(()=>{
    const grouped=new Map<string,{id:number;variant?:string;quantity:number}>()
    for(const item of items){
      const key=`${item.id}|${item.variant??''}`
      const line=grouped.get(key)
      if(line)line.quantity++
      else grouped.set(key,{...item,quantity:1})
    }
    return[...grouped.entries()].flatMap(([key,{id,variant,quantity}])=>{
      const product=byId(id)
      return product?[{key,product,quantity,...priced(product,variant)}]:[]
    })
  },[items,byId])

  useEffect(()=>{
    if(!panelOpen)return
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')closePanel()}
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[panelOpen,closePanel])

  const lastKey=lastAdded?`${lastAdded.id}|${lastAdded.variant??''}`:null
  const added=lines.find(line=>line.key===lastKey)
  const subtotal=lines.reduce((sum,line)=>sum+line.price*line.quantity,0)
  const total=subtotal*(1-businessDiscount)
  const count=items.length

  return <div className="cart-panel" data-open={panelOpen} role="dialog" aria-label="Je winkelmandje" aria-hidden={!panelOpen}>
    <div className="cart-panel-head">
      <strong><ShoppingCart/> Je winkelmandje{count>0&&<small>{count} {count===1?'artikel':'artikelen'}</small>}</strong>
      <button type="button" onClick={closePanel} aria-label="Mandje sluiten" tabIndex={panelOpen?0:-1}><X/></button>
    </div>

    {added&&<p className="cart-panel-added"><Check/> <span><b>{added.name}</b> is toegevoegd aan je mandje.</span></p>}

    {lines.length===0
      ?<p className="cart-panel-empty">Je mandje is nog leeg.</p>
      :<>
        <ul className="cart-panel-lines">
          {lines.slice(0,SHOWN_LINES).map(({key,product,quantity,price,name,imageId})=><li key={key} data-new={key===lastKey}>
            <ProductVisual icon={product.icon} color={product.color} photo={photoForProduct({...product,imageId},120)} alt={name} sizes="48px"/>
            <span><b>{name}</b><small>{quantity} × {money(price)} · {money(exVat(price))} excl. btw</small>{product.delivery&&<small>{product.delivery}</small>}</span>
            <em>{money(price*quantity)}</em>
          </li>)}
        </ul>
        {lines.length>SHOWN_LINES&&<p className="cart-panel-more">en nog {lines.length-SHOWN_LINES} {lines.length-SHOWN_LINES===1?'artikel':'artikelen'} in je mandje</p>}

        <p className="cart-panel-promo"><Clock/> <span><b>Tijdelijke ondernemersactie:</b> je krijgt nu {businessDiscountPercent} ondernemerskorting op je hele bestelling. Deze kortingen zijn tijdelijk.</span></p>

        <dl className="cart-panel-totals">
          <div><dt>Subtotaal incl. btw</dt><dd>{money(subtotal)}</dd></div>
          <div className="cart-panel-discount"><dt>Met {businessDiscountPercent} ondernemerskorting</dt><dd>{money(total)}</dd></div>
          <div className="cart-panel-ex"><dt>Excl. 21% btw</dt><dd>{money(exVat(total))}</dd></div>
        </dl>
      </>}

    <div className="cart-panel-actions">
      {lines.length>0&&<Link to="/checkout" className="button primary" onClick={closePanel} tabIndex={panelOpen?0:-1}>Afrekenen <ArrowRight/></Link>}
      <button type="button" className="cart-panel-continue" onClick={closePanel} tabIndex={panelOpen?0:-1}>Verder winkelen</button>
    </div>
  </div>
}
