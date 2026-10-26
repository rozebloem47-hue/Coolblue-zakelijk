import{createFileRoute,Link}from'@tanstack/react-router'
import{useEffect,useMemo,useRef,useState}from'react'
import{ArrowRight,Check,ChevronDown,ChevronRight,ChevronUp,Clock,FileText,Headphones,Minus,Package,Percent,Plus,RefreshCcw,ShieldCheck,ShoppingCart,Truck}from'lucide-react'
import{accessoriesFor,businessDiscountPercent,businessPrice,collectionSlug,exVat,money,similarProducts,specGroupsFor,specsFor,trailFor,variantOf,type Product}from'@/data/products'
import{photosForProduct}from'@/data/media'
import{useCatalog}from'@/lib/shop-products'
import{Price}from'@/components/Price'
import{ProductCard}from'@/components/ProductCard'
import{ProductGallery}from'@/components/ProductGallery'
import{Rating}from'@/components/Rating'
import{VariantPicker}from'@/components/VariantPicker'
import{HelpZone}from'@/components/HomepageInfo'
import{useCart}from'@/lib/cart-context'

export const Route=createFileRoute('/products/$productId')({
  // `uitvoering` is het artikelnummer van de gekozen kleur of opslag, zodat een gedeelde link dezelfde keuze opent.
  validateSearch:(search:Record<string,unknown>):{uitvoering?:string}=>typeof search.uitvoering==='string'||typeof search.uitvoering==='number'?{uitvoering:String(search.uitvoering)}:{},
  head:({params,matches})=>{
    // Toegevoegde producten komen uit de loader van de root-route.
    const extra=(matches as {routeId:string;loaderData?:unknown}[]).find(match=>match.routeId==='__root__')?.loaderData as Product[]|undefined
    const product=extra?.find(item=>item.slug===params.productId)
    return{meta:[
      {title:product?`${product.name} zakelijk kopen? | Coolblue Zakelijk`:'Product | Coolblue Zakelijk'},
      {name:'description',content:product?`${product.name} met ${businessDiscountPercent} ondernemerskorting, prijzen inclusief én exclusief btw en afrekenen op factuur.`:'Bekijk dit artikel in onze zakelijke winkel.'},
    ]}
  },
  component:ProductPage,
})

/** De blokken in de ankernavigatie onder de foto's en de koopkaart, in de volgorde van Coolblue. */
const anchors=[['productinformatie','Productinformatie'],['accessoires','Accessoires'],['specificaties','Specificaties'],['advies','Service en advies']] as const

/** Zoveel specificatiegroepen tonen we voordat je "alle specificaties" openklapt. */
const SPEC_GROUPS=3

function ProductPage(){
  const{productId}=Route.useParams()
  const{all,find}=useCatalog()
  const found=find(productId)
  const{uitvoering}=Route.useSearch()
  const navigate=Route.useNavigate()
  const variant=found?variantOf(found,uitvoering):undefined
  // De gekozen uitvoering bepaalt naam, prijs en foto's; de rest van de pagina blijft van het product.
  const product=useMemo(()=>found&&variant?{
    ...found,
    name:variant.name||found.name,
    price:variant.price,
    listPrice:variant.listPrice,
    dealPercent:variant.listPrice&&variant.listPrice>variant.price?Math.round((1-variant.price/variant.listPrice)*100):undefined,
    imageIds:variant.imageIds.length?variant.imageIds:found.imageIds,
    imageId:variant.imageIds[0]??found.imageId,
    colorName:Object.entries(variant.values).find(([title])=>found.variantOptions?.find(option=>option.title===title)?.type==='color')?.[1]??found.colorName,
  }:found,[found,variant])
  const pick=(sku:string)=>navigate({search:{uitvoering:sku},replace:true,resetScroll:false})
  const{add}=useCart()
  const[amount,setAmount]=useState(1)
  const[added,setAdded]=useState(false)
  const[allSpecs,setAllSpecs]=useState(false)
  const[buyVisible,setBuyVisible]=useState(true)
  const buyButton=useRef<HTMLButtonElement>(null)

  // Op mobiel verschijnt onderin een koopbalk zodra de knop "In mijn mandje" uit beeld is.
  useEffect(()=>{
    const button=buyButton.current
    if(!button||typeof IntersectionObserver==='undefined')return
    const observer=new IntersectionObserver(([entry])=>setBuyVisible(entry.isIntersecting||entry.boundingClientRect.top>0))
    observer.observe(button)
    return()=>observer.disconnect()
  },[productId])

  // Een ander product opent weer met ingeklapte specificaties en één stuk.
  useEffect(()=>{setAllSpecs(false);setAmount(1);setAdded(false)},[productId])

  const photos=useMemo(()=>product?photosForProduct(product,900):[],[product])

  if(!product)return <div className="wrap pdp-missing"><h1>Dit artikel bestaat niet (meer)</h1><p>Misschien is het uit ons assortiment gegaan. Bekijk de afdelingen in het menu of neem contact op met een van onze zakelijke adviseurs.</p><Link to="/" className="button primary">Naar de winkel</Link></div>

  const{category,collection}=trailFor(product)
  const accessories=accessoriesFor(product,all,6)
  const similar=similarProducts(product,all,4)
  // Specificaties horen bij de gekozen uitvoering: 512 GB toont ook 512 GB opslag.
  const groups=found?specGroupsFor(found,variant):[]
  const variantSpecs=found?specsFor(found,variant):[]
  const specs=variantSpecs.length?variantSpecs:product.bullets.map((bullet,index)=>[`Kenmerk ${index+1}`,bullet] as [string,string])
  const shownGroups=allSpecs?groups:groups.slice(0,SPEC_GROUPS)
  const hiddenSpecs=groups.slice(SPEC_GROUPS).reduce((sum,group)=>sum+group.specs.length,0)
  // Eén keer in het mandje leggen per stuk: het mandje bewaart losse artikelregels.
  const toCart=()=>{for(let i=0;i<amount;i++)add(product.id,variant?.sku);setAdded(true)}
  const openSpecs=()=>setAllSpecs(true)

  return <div className="pdp">
    <nav className="wrap pdp-trail" aria-label="Kruimelpad">
      <Link to="/">Zakelijk</Link>
      {category&&<><ChevronRight/><Link to="/categorie/$category" params={{category:category.slug}}>{category.name}</Link></>}
      {category&&collection&&<><ChevronRight/><Link to="/collectie/$category/$collection" params={{category:category.slug,collection:collectionSlug(collection.name)}}>{collection.name}</Link></>}
      {category&&collection&&<><ChevronRight/><Link to="/collectie/$category/$collection/$item" params={{category:category.slug,collection:collectionSlug(collection.name),item:collectionSlug(product.subcategory)}}>{product.subcategory}</Link></>}
      <ChevronRight/><span aria-current="page">{product.name}</span>
    </nav>

    <div className="wrap pdp-top">
      <header className="pdp-head">
        <span className="kicker">{product.brand} · {product.subcategory}</span>
        <h1>{product.name}</h1>
        <div className="pdp-head-meta">
          <Rating rating={product.rating} reviews={product.reviews} score/>
          <span>Artikelnummer {product.id}</span>
        </div>
      </header>

      <div className="pdp-visual">
        {product.dealPercent?<span className="pdp-deal">-{product.dealPercent}% tijdelijke actiekorting</span>:null}
        <ProductGallery key={`${product.slug}-${variant?.sku??''}`} photos={photos} alt={product.name} icon={product.icon} color={product.color}/>
      </div>

      <aside className="pdp-buy">
        {product.bullets.length>0&&<ul className="pdp-pros" aria-label="Pluspunten">{product.bullets.slice(0,4).map(bullet=><li key={bullet}><Plus/>{bullet}</li>)}</ul>}
        <div className="pdp-buy-box">
          {found&&variant&&<VariantPicker product={found} variant={variant} onPick={pick}/>}
          <Price value={product.price} className="pdp-price" note="excl. 21% btw" listPrice={product.listPrice} dealPercent={product.dealPercent}/>
          <p className="pdp-vat">Je betaalt {money(product.price)} inclusief btw, dat is {money(exVat(product.price))} exclusief 21% btw. Met je {businessDiscountPercent} ondernemerskorting rekenen we {money(businessPrice(product.price))} inclusief btw af.</p>
          <p className="temp-offer"><Clock/> <span><b>Tijdelijke ondernemersactie.</b> Deze korting geldt maar voor een beperkte periode, dus wacht niet te lang.</span></p>
          <div className="pdp-stock"><Check/> {product.stock}</div>
          <div className="pdp-delivery"><Truck/> {product.delivery??'Morgen bezorgd, ook op zakelijke adressen'}</div>
          <div className="pdp-amount">
            <span>Aantal</span>
            <div className="pdp-stepper">
              <button type="button" onClick={()=>setAmount(value=>Math.max(1,value-1))} aria-label="Eén minder"><Minus/></button>
              <output aria-live="polite">{amount}</output>
              <button type="button" onClick={()=>setAmount(value=>Math.min(99,value+1))} aria-label="Eén meer"><Plus/></button>
            </div>
          </div>
          <button className="button primary pdp-add" onClick={toCart} ref={buyButton}><ShoppingCart/>In mijn mandje</button>
          {added&&<p className="pdp-added"><Check/> Toegevoegd. <Link to="/checkout">Naar afrekenen op factuur</Link></p>}
        </div>
        <ul className="pdp-usps">
          <li><FileText/> Afrekenen op factuur, betaaltermijn 14 dagen</li>
          <li><Percent/> {businessDiscountPercent} ondernemerskorting op elk artikel</li>
          <li><Package/> Gratis bezorgd vanaf € 50,- op je zakelijke adres</li>
          <li><RefreshCcw/> 30 dagen retourrecht, ook zakelijk</li>
          <li><ShieldCheck/> Twee jaar garantie en reparatie in eigen huis</li>
        </ul>
      </aside>
    </div>

    <nav className="pdp-anchors" aria-label="Op deze pagina">
      <div className="wrap">{anchors.filter(([id])=>id!=='accessoires'||accessories.length>0).map(([id,label])=><a key={id} href={`#${id}`}>{label}</a>)}</div>
    </nav>

    <section className="wrap pdp-block pdp-info" id="productinformatie">
      <h2>Productinformatie</h2>
      <div className="pdp-story">
        <h3>Omschrijving</h3>
        <p>{product.description}</p>
        <p>Dit artikel hoort bij {product.subcategory.toLowerCase()}{collection?` uit onze collectie ${collection.name.toLowerCase()}`:''}. Onze adviseurs gebruiken het zelf, dus we weten waar het goed in is en waar niet. Twijfel je tussen twee artikelen? Bel ons, dan kiezen we samen.</p>
        {product.bullets.length>0&&<>
          <h3>Pluspunten</h3>
          <ul>{product.bullets.map(bullet=><li key={bullet}><Plus/>{bullet}</li>)}</ul>
        </>}
      </div>
      <div className="pdp-info-aside">
        <div className="pdp-info-card">
          <h3>Belangrijkste specificaties</h3>
          <dl className="pdp-quick">
            {specs.slice(0,6).map(([label,value],index)=><div key={`${label}-${index}`}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <a className="pdp-jump" href="#specificaties" onClick={openSpecs}>Alle {specs.length} specificaties bekijken<ArrowRight/></a>
        </div>
        <div className="pdp-story-aside">
          <h3>Zakelijk voordeel</h3>
          <p>{product.dealPercent?`Nu ${product.dealPercent}% actiekorting op de adviesprijs van ${money(product.listPrice??product.price)}. Daar komt je ${businessDiscountPercent} ondernemerskorting nog bovenop.`:`Je krijgt ${businessDiscountPercent} ondernemerskorting op dit artikel, verrekend in je mandje.`}</p>
          <table>
            <tbody>
              <tr><th>Inclusief btw</th><td>{money(product.price)}</td></tr>
              <tr><th>Exclusief 21% btw</th><td>{money(exVat(product.price))}</td></tr>
              <tr><th>Met {businessDiscountPercent} ondernemerskorting</th><td>{money(businessPrice(product.price))}</td></tr>
              <tr><th>Idem exclusief btw</th><td>{money(exVat(businessPrice(product.price)))}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    {accessories.length>0&&<section className="wrap pdp-block" id="accessoires">
      <h2>Geschikte accessoires</h2>
      <p className="pdp-lead">Deze artikelen passen bij je {product.subcategory.toLowerCase()}. Ook hier geldt je {businessDiscountPercent} ondernemerskorting.</p>
      <div className="product-grid pdp-grid">{accessories.map(item=><ProductCard key={item.id} product={item}/>)}</div>
    </section>}

    <section className="wrap pdp-block pdp-specs" id="specificaties">
      <h2>Specificaties</h2>
      <p className="pdp-lead">Alle eigenschappen van de {product.name}, zoals de fabrikant ze opgeeft.</p>
      {groups.length
        // Overgenomen producten houden de indeling in groepen van de bronpagina.
        ?<>
          <div className="pdp-spec-groups">
            <div className="pdp-spec-group">
              <h3>Algemeen</h3>
              <table className="pdp-spec-table">
                <tbody>
                  <tr><th>Merk</th><td>{product.brand}</td></tr>
                  <tr><th>Soort</th><td>{product.subcategory}</td></tr>
                  {product.series?<tr><th>Serie</th><td>{product.series}</td></tr>:null}
                  {product.colorName?<tr><th>Kleur</th><td>{product.colorName}</td></tr>:null}
                  {variant&&Object.entries(variant.values).filter(([title])=>found?.variantOptions?.find(option=>option.title===title)?.type!=='color').map(([title,value])=><tr key={title}><th>{title}</th><td>{value}</td></tr>)}
                  <tr><th>Artikelnummer</th><td>{product.id}</td></tr>
                  <tr><th>Garantie</th><td>2 jaar fabrieksgarantie, zakelijk uitbreidbaar</td></tr>
                </tbody>
              </table>
            </div>
            {shownGroups.map(group=><div className="pdp-spec-group" key={group.title}>
              <h3>{group.title}</h3>
              <table className="pdp-spec-table">
                <tbody>{group.specs.map(([label,value],index)=><tr key={`${label}-${index}`}><th>{label}</th><td>{value}</td></tr>)}</tbody>
              </table>
            </div>)}
          </div>
          {hiddenSpecs>0&&<button type="button" className="button pdp-more-specs" onClick={()=>setAllSpecs(value=>!value)} aria-expanded={allSpecs}>
            {allSpecs?<>Minder specificaties tonen<ChevronUp/></>:<>Toon alle specificaties ({hiddenSpecs} meer)<ChevronDown/></>}
          </button>}
        </>
        :<table className="pdp-spec-table">
        <tbody>
          <tr><th>Merk</th><td>{product.brand}</td></tr>
          <tr><th>Soort</th><td>{product.subcategory}</td></tr>
          {specs.map(([label,value],index)=><tr key={`${label}-${index}`}><th>{label}</th><td>{value}</td></tr>)}
          {product.series?<tr><th>Serie</th><td>{product.series}</td></tr>:null}
          {product.storage?<tr><th>Opslag</th><td>{product.storage}</td></tr>:null}
          <tr><th>Artikelnummer</th><td>{product.id}</td></tr>
          <tr><th>Garantie</th><td>2 jaar fabrieksgarantie, zakelijk uitbreidbaar</td></tr>
        </tbody>
      </table>}
    </section>


    {similar.length>0&&<section className="wrap pdp-block">
      <h2>Vergelijkbare artikelen</h2>
      <div className="product-grid pdp-grid">{similar.map(item=><ProductCard key={item.id} product={item}/>)}</div>
    </section>}

    <section className="wrap pdp-block pdp-advice" id="advies">
      <h2>Service en advies</h2>
      <div className="pdp-advice-grid">
        <article><Headphones/><h3>Zakelijk advies</h3><p>Onze adviseurs denken mee over aantallen, installatie en beheer. Ook als je later wilt uitbreiden.</p></article>
        <article><FileText/><h3>Altijd een btw-factuur</h3><p>Je rekent af op factuur. De factuur staat op de gegevens die je bij het afrekenen invult.</p></article>
        <article><Truck/><h3>Bezorging op afspraak</h3><p>Grote aantallen bezorgen we op een moment dat het je bedrijf uitkomt, ook buiten kantooruren.</p></article>
      </div>
    </section>

    <HelpZone/>

    <div className={`pdp-sticky${buyVisible?'':' is-shown'}`} aria-hidden={buyVisible}>
      <div>
        <strong>{money(product.price)}</strong>
        <small>{money(exVat(product.price))} excl. 21% btw</small>
      </div>
      <button type="button" className="button primary" onClick={toCart} tabIndex={buyVisible?-1:0}><ShoppingCart/>In mijn mandje</button>
    </div>
  </div>
}
