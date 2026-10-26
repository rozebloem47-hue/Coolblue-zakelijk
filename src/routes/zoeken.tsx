import{contact,emailHref,phoneHref}from'@/data/contact';
import{createFileRoute,Link}from'@tanstack/react-router'
import{useMemo,useState}from'react'
import{ArrowRight,ChevronRight,Search}from'lucide-react'
import{businessDiscountPercent}from'@/data/products'
import{matchKey,matchPrice}from'@/data/filters'
import{searchProducts}from'@/data/search'
import{useCatalog}from'@/lib/shop-products'
import{ProductCard}from'@/components/ProductCard'

export const Route=createFileRoute('/zoeken')({
  // `q` is de zoekopdracht, zodat een zoekresultaat te delen en te bookmarken is.
  validateSearch:(search:Record<string,unknown>):{q?:string}=>typeof search.q==='string'&&search.q.trim()?{q:search.q}:typeof search.q==='number'?{q:String(search.q)}:{},
  head:()=>({meta:[{title:'Zoeken | Coolblue Zakelijk'}]}),
  component:SearchPage,
})

const sorts=['Best passend','Prijs laag - hoog','Prijs hoog - laag','Beste beoordeling']

function SearchPage(){
  const{q=''}=Route.useSearch()
  const{all}=useCatalog()
  const[sort,setSort]=useState(sorts[0])
  const[type,setType]=useState<string>()
  const results=useMemo(()=>searchProducts(all,q),[all,q])
  // Producttypes in de resultaten, om snel te verfijnen.
  const types=useMemo(()=>[...new Set(results.map(match=>match.product.subcategory))].sort((a,b)=>a.localeCompare(b,'nl')),[results])
  const activeType=type&&types.includes(type)?type:undefined
  const shown=useMemo(()=>{
    const order=results.filter(match=>!activeType||match.product.subcategory===activeType)
    if(sort==='Prijs laag - hoog')order.sort((a,b)=>matchPrice(a)-matchPrice(b))
    if(sort==='Prijs hoog - laag')order.sort((a,b)=>matchPrice(b)-matchPrice(a))
    if(sort==='Beste beoordeling')order.sort((a,b)=>b.product.rating-a.product.rating||b.product.reviews-a.product.reviews)
    return order
  },[results,activeType,sort])

  return <>
    <nav className="breadcrumbs wrap" aria-label="Kruimelpad"><Link to="/">Home</Link><ChevronRight/><span>Zoeken</span></nav>
    <header className="collection-page-hero"><div className="wrap"><div>
      <span className="kicker">Zoekresultaten</span>
      <h1>{q?<>Resultaten voor ‘{q}’</>:'Waar ben je naar op zoek?'}</h1>
      <p>{q?`${results.length} ${results.length===1?'uitvoering':'uitvoeringen'} gevonden. Alle prijzen staan inclusief én exclusief 21% btw, met ${businessDiscountPercent} ondernemerskorting in je mandje.`:'Typ een merk, model of producttype in de zoekbalk bovenaan de pagina.'}</p>
    </div></div></header>

    {q&&<section className="catalog-zone" id="resultaten"><div className="wrap">
      {results.length
        ?<>
          <div className="catalog-head">
            <div><h2>{activeType??'Alle resultaten'}</h2><p>{shown.length} {shown.length===1?'uitvoering':'uitvoeringen'}</p></div>
            <select aria-label="Sorteren" value={sort} onChange={event=>setSort(event.target.value)}>{sorts.map(option=><option key={option}>{option}</option>)}</select>
          </div>
          {types.length>1&&<div className="brand-cloud search-types" role="group" aria-label="Producttype">
            <button type="button" className={`brand-pill ${activeType?'':'active'}`} aria-pressed={!activeType} onClick={()=>setType(undefined)}>Alles ({results.length})</button>
            {types.map(item=><button type="button" key={item} className={`brand-pill ${activeType===item?'active':''}`} aria-pressed={activeType===item} onClick={()=>setType(item)}>{item} ({results.filter(match=>match.product.subcategory===item).length})</button>)}
          </div>}
          <div className="product-grid search-grid">{shown.map(match=><ProductCard key={matchKey(match)} product={match.product} variant={match.variant} choices={match.choices}/>)}</div>
        </>
        :<div className="item-empty"><Search/><div><b>Geen producten gevonden voor ‘{q}’</b><span>Controleer de spelling of zoek op een algemener woord, zoals een merk of producttype. Onze zakelijke specialist helpt je ook graag verder.</span></div><a className="button primary" href={phoneHref}>Bel {contact.phoneLabel}</a></div>}
      <div className="catalog-help"><b>Niet gevonden wat je zoekt?</b><span>Onze zakelijke specialist zoekt het voor je uit.</span><a href={emailHref}>Neem contact op <ArrowRight/></a></div>
    </div></section>}
  </>
}
