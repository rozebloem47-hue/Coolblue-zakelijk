import{contact,phoneHref}from'@/data/contact';
import{createFileRoute,Link}from'@tanstack/react-router'
import{useMemo,useState}from'react'
import{ArrowRight,Check,ChevronRight,Headphones}from'lucide-react'
import{businessDiscountPercent,categories,collectionSlug,productsForCollection}from'@/data/products'
import{matchKey,matchPrice,newestIPhonesFirst}from'@/data/filters'
import{useFilters}from'@/lib/use-filters'
import{FilterFieldsets,FilterPanel,selectionCount,selectionLabel}from'@/components/ProductFilters'
import{useCatalog}from'@/lib/shop-products'
import{collectionImageFor,subjectImage}from'@/data/media'
import{Photo}from'@/components/Photo'
import{ProductCard}from'@/components/ProductCard'

export const Route=createFileRoute('/collectie/$category/$collection')({component:CollectionPage})

const sorts=['Meest gekozen','Prijs laag - hoog','Prijs hoog - laag','Beste beoordeling']

function CollectionPage(){
  const{category,collection}=Route.useParams()
  const{all:products}=useCatalog()
  const info=categories.find(item=>item.slug===category)??categories[0]
  const selected=info.collections.find(item=>collectionSlug(item.name)===collection)??info.collections[0]
  // Alles wat in een van de subcollecties staat; zonder producten tonen we geen willekeurige artikelen uit een andere afdeling.
  const assortment=useMemo(()=>productsForCollection(selected,products),[selected,products])
  const filters=useFilters(assortment,`${category}/${collection}`)
  const[sort,setSort]=useState(sorts[0])
  const shown=useMemo(()=>{
    const order=newestIPhonesFirst(filters.matches)
    if(sort==='Prijs laag - hoog')order.sort((a,b)=>matchPrice(a)-matchPrice(b))
    if(sort==='Prijs hoog - laag')order.sort((a,b)=>matchPrice(b)-matchPrice(a))
    if(sort==='Beste beoordeling')order.sort((a,b)=>b.product.rating-a.product.rating||b.product.reviews-a.product.reviews)
    return order
  },[filters.matches,sort])
  const hero=collectionImageFor(selected.name,selected.items,category,840)
  return <>
    <nav className="breadcrumbs wrap"><Link to="/">Home</Link><ChevronRight/><Link to="/categorie/$category" params={{category}}>{info.name}</Link><ChevronRight/><span>{selected.name}</span></nav>
    <header className="collection-page-hero"><div className="wrap"><div><span className="kicker">{info.name}</span><h1>{selected.name}</h1><p>{info.blurb}. Bekijk het assortiment, vergelijk de mogelijkheden en kies wat bij jouw werkplek past.</p></div>{hero&&<div className="collection-hero-media"><Photo photo={hero} alt={selected.name} sizes="(max-width:950px) 90vw, 420px" eager/></div>}</div></header>
    <section className="wrap collection-page-links" aria-labelledby="collection-options"><h2 id="collection-options">Waar ben je naar op zoek?</h2><div>{selected.items.map(item=>{const photo=subjectImage(item,240);return <Link id={collectionSlug(item)} to="/collectie/$category/$collection/$item" params={{category,collection,item:collectionSlug(item)}} key={item}>{photo&&<Photo photo={photo} alt={item} sizes="52px" className="link-thumb"/>}<span>{item}</span><ChevronRight/></Link>})}</div></section>
    <section className="collection-advice"><div className="wrap"><div><span className="kicker">Hulp bij kiezen</span><h2>Zo maak je de juiste keuze</h2><p>Let op gebruik, aansluiting en capaciteit. Voor een complete zakelijke inrichting helpen onze specialisten je graag persoonlijk.</p><a href={phoneHref}>Vraag advies aan <ArrowRight/></a></div><ul><li><Check/>Duidelijke keuze per producttype</li><li><Check/>Prijzen inclusief én exclusief btw</li><li><Check/>Persoonlijk advies voor je bedrijf</li><li><Check/>{businessDiscountPercent} ondernemerskorting</li></ul></div></section>
    <section className="catalog-zone" id="producten"><div className="wrap">
      <div className="catalog-head"><div><h2>Producten in {selected.name.toLowerCase()}</h2><p>{shown.length} {shown.length===1?'product':'producten'}</p></div><select aria-label="Sorteren" value={sort} onChange={event=>setSort(event.target.value)}>{sorts.map(option=><option key={option}>{option}</option>)}</select></div>
      {assortment.length
        ?<div className="catalog-layout">
          <FilterPanel className="model-filters" activeCount={selectionCount(filters.selection)}><FilterFieldsets facets={filters.facets} selection={filters.selection} counts={filters.counts} onToggle={filters.toggle}/><p className="filter-note">Alle prijzen staan inclusief én exclusief 21% btw. Je {businessDiscountPercent} ondernemerskorting wordt in je mandje verrekend.</p></FilterPanel>
          <section>
            {filters.active&&<div className="active-filter"><span>{selectionLabel(filters.selection)}</span><button onClick={filters.clear}>Wis filters</button></div>}
            <div className="product-grid">{shown.map(match=><ProductCard key={matchKey(match)} product={match.product} variant={match.variant} choices={match.choices}/>)}</div>
          </section>
        </div>
        :<div className="item-empty"><Headphones/><div><b>Dit assortiment stellen we voor je samen</b><span>Vertel ons wat je zoekt in {selected.name.toLowerCase()} en hoeveel stuks je nodig hebt. Onze zakelijke specialist stuurt een voorstel met btw-factuur.</span></div><a className="button primary" href={phoneHref}>Bel {contact.phoneLabel}</a></div>}
    </div></section>
  </>
}
