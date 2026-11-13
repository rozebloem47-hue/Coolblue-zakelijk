import{contact,emailHref,phoneHref}from'@/data/contact';
import{createFileRoute,Link}from'@tanstack/react-router'
import{useMemo,useState}from'react'
import{ArrowRight,Check,ChevronRight,FileText,Headphones,Percent,RefreshCcw,Truck}from'lucide-react'
import{businessDiscountPercent,categoryAdvice,collectionSlug,findCategory,findCollection,findItem,productsForCollection,productsForItem,productsNearItem}from'@/data/products'
import{brandImageFor,collectionImageFor,subjectImage}from'@/data/media'
import{Photo}from'@/components/Photo'
import{ProductCard}from'@/components/ProductCard'
import{HelpZone}from'@/components/HomepageInfo'
import{useCatalog}from'@/lib/shop-products'
import{useFilters}from'@/lib/use-filters'
import{FilterFieldsets,FilterPanel,selectionCount,selectionLabel}from'@/components/ProductFilters'
import{matchKey,matchPrice,newestIPhonesFirst}from'@/data/filters'

const sorts=['Relevantie','Best beoordeeld','Prijs laag - hoog','Prijs hoog - laag']

export const Route=createFileRoute('/collectie/$category/$collection_/$item')({
  head:({params})=>{
    const category=findCategory(params.category)
    const collection=category&&findCollection(category,params.collection)
    const item=collection&&findItem(collection,params.item)
    return{meta:[
      {title:item?`${item} zakelijk kopen? | Coolblue Zakelijk`:'Subcollectie | Coolblue Zakelijk'},
      {name:'description',content:item?`${item} voor zakelijke klanten, met prijzen inclusief én exclusief btw, bezorging op je zakelijke adres en ${businessDiscountPercent} ondernemerskorting.`:'Bekijk het zakelijke assortiment van Coolblue.'},
    ]}
  },
  component:ItemPage,
})

function ItemPage(){
  const{category:categorySlug,collection:collectionParam,item:itemParam}=Route.useParams()
  const category=findCategory(categorySlug)
  const collection=category&&findCollection(category,collectionParam)
  const item=collection&&findItem(collection,itemParam)
  const[sort,setSort]=useState(sorts[0])
  const{all}=useCatalog()

  // Eerst wat echt bij dit onderwerp hoort, dan een verwant producttype, dan de hele collectie.
  const own=useMemo(()=>item?productsForItem(item,all):[],[item,all])
  const related=useMemo(()=>{
    if(!item||!collection||own.length)return[]
    const near=productsNearItem(item,all)
    return near.length?near:productsForCollection(collection,all)
  },[item,collection,own.length,all])
  const pool=own.length?own:related
  const filters=useFilters(pool,`${categorySlug}/${collectionParam}/${itemParam}`)
  const shown=useMemo(()=>{
    const order=newestIPhonesFirst(filters.matches)
    if(sort==='Prijs laag - hoog')order.sort((a,b)=>matchPrice(a)-matchPrice(b))
    if(sort==='Prijs hoog - laag')order.sort((a,b)=>matchPrice(b)-matchPrice(a))
    if(sort==='Best beoordeeld')order.sort((a,b)=>b.product.rating-a.product.rating||b.product.reviews-a.product.reviews)
    return order
  },[filters.matches,sort])

  if(!category||!collection||!item)return <div className="wrap categories"><h1>Deze pagina bestaat niet</h1><p>Kies een afdeling uit het menu of bekijk <Link to="/">de homepage</Link>.</p></div>

  const siblings=collection.items.filter(other=>other!==item)
  const photo=subjectImage(item,640)??brandImageFor(item,640)??collectionImageFor(collection.name,collection.items,category.slug,640)

  return <>
    <nav className="breadcrumbs wrap">
      <Link to="/">Home</Link><ChevronRight/>
      <Link to="/categorie/$category" params={{category:category.slug}}>{category.name}</Link><ChevronRight/>
      <Link to="/collectie/$category/$collection" params={{category:category.slug,collection:collectionSlug(collection.name)}}>{collection.name}</Link><ChevronRight/>
      <span>{item}</span>
    </nav>

    <header className="item-hero"><div className="wrap">
      <div>
        <span className="kicker">{collection.name}</span>
        <h1>{item}</h1>
        <p>{item} voor zakelijk gebruik, met prijzen inclusief en exclusief btw. Besteld op een werkdag voor 23.59 uur? Dan bezorgen we morgen gratis op je zakelijke adres.</p>
        <p>{categoryAdvice[category.slug]??`Onze specialisten helpen je graag bij het kiezen binnen ${category.name.toLowerCase()}.`} Als ondernemer krijg je {businessDiscountPercent} ondernemerskorting, verrekend in je mandje.</p>
        <a className="item-hero-advice" href={phoneHref}>Vraag advies aan een specialist<ArrowRight/></a>
      </div>
      {photo&&<div className="item-hero-media"><Photo photo={photo} alt={item} sizes="(max-width:950px) 90vw, 380px" eager/></div>}
    </div></header>

    {siblings.length>0&&<nav className="model-strip wrap" aria-label={`Meer uit ${collection.name}`}>
      <Link to="/collectie/$category/$collection" params={{category:category.slug,collection:collectionSlug(collection.name)}}>Alles uit {collection.name.toLowerCase()}</Link>
      {siblings.map(other=><Link key={other} to="/collectie/$category/$collection/$item" params={{category:category.slug,collection:collectionSlug(collection.name),item:collectionSlug(other)}}>{other}</Link>)}
    </nav>}

    <section className="service-strip wrap" aria-label="Onze servicebeloftes">
      <div><Truck/><span><b>Gratis bezorgd</b><small>Op een moment dat jou past</small></span></div>
      <div><RefreshCcw/><span><b>Gratis ruilen</b><small>Binnen 30 dagen</small></span></div>
      <div><FileText/><span><b>Btw-factuur</b><small>Direct in je mailbox</small></span></div>
      <div><Percent/><span><b>{businessDiscountPercent} ondernemerskorting</b><small>Verrekend in je mandje</small></span></div>
    </section>

    <section className="catalog-zone" id="producten"><div className="wrap">
      <div className="catalog-head">
        <div>
          <h2>{own.length?`Alle ${item.toLowerCase()}`:`Populair binnen ${collection.name.toLowerCase()}`}</h2>
          <p>{shown.length} {shown.length===1?'product':'producten'}</p>
        </div>
        <select aria-label="Sorteren" value={sort} onChange={event=>setSort(event.target.value)}>{sorts.map(option=><option key={option}>{option}</option>)}</select>
      </div>
      {!own.length&&pool.length>0&&<p className="item-note">We breiden het assortiment {item.toLowerCase()} nog uit. Dit is wat zakelijke klanten nu kiezen binnen {collection.name.toLowerCase()}.</p>}
      <div className="catalog-layout">
        <FilterPanel className="model-filters" activeCount={selectionCount(filters.selection)}>
          <FilterFieldsets facets={filters.facets} selection={filters.selection} counts={filters.counts} onToggle={filters.toggle}/>
          <fieldset><legend>Meer uit {collection.name.toLowerCase()}</legend>{collection.items.map(other=><Link key={other} className={other===item?'filter-active':undefined} to="/collectie/$category/$collection/$item" params={{category:category.slug,collection:collectionSlug(collection.name),item:collectionSlug(other)}}>{other}</Link>)}</fieldset>
          <p className="filter-note">Alle prijzen staan inclusief én exclusief 21% btw. Je ontvangt altijd een btw-factuur en je {businessDiscountPercent} ondernemerskorting wordt in je mandje verrekend.</p>
        </FilterPanel>
        <section>
          {filters.active&&<div className="active-filter"><span>{selectionLabel(filters.selection)}</span><button onClick={filters.clear}>Wis filters</button></div>}
          {shown.length>0
            ?<div className="product-grid">{shown.map(match=><ProductCard key={matchKey(match)} product={match.product} variant={match.variant} choices={match.choices}/>)}</div>
            :<div className="item-empty">
              <Headphones/>
              <div>
                <b>Dit assortiment stellen we voor je samen</b>
                <span>Vertel ons wat je zoekt in {item.toLowerCase()} en hoeveel stuks je nodig hebt. Onze zakelijke specialist zoekt het voor je uit en stuurt een voorstel met btw-factuur.</span>
              </div>
              <a className="button primary" href={phoneHref}>Bel {contact.phoneLabel}</a>
            </div>}
          <div className="catalog-help">
            <b>Staat jouw combinatie er niet tussen?</b>
            <span>Onze zakelijke specialist zoekt hem voor je uit.</span>
            <a href={emailHref}>Neem contact op <ArrowRight/></a>
          </div>
        </section>
      </div>
    </div></section>

    <section className="collection-advice"><div className="wrap">
      <div>
        <span className="kicker">Hulp bij kiezen</span>
        <h2>Zo kies je de juiste {item.toLowerCase()}</h2>
        <p>Let op gebruik, aansluitingen en hoeveel gebruikers ermee werken. Twijfel je tussen twee opties, dan leggen onze specialisten het verschil uit in gewone taal.</p>
        <Link to="/categorie/$category" params={{category:category.slug}}>Bekijk de hele afdeling {category.name.toLowerCase()}<ArrowRight/></Link>
      </div>
      <ul>
        <li><Check/>Prijzen inclusief én exclusief btw</li>
        <li><Check/>Bezorgd op je zakelijke adres</li>
        <li><Check/>Veilig betalen met iDEAL</li>
        <li><Check/>{businessDiscountPercent} ondernemerskorting</li>
      </ul>
    </div></section>

    <HelpZone/>
  </>
}
