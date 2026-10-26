import{emailHref,phoneHref}from'@/data/contact';
import{createFileRoute,Link}from'@tanstack/react-router'
import{useMemo,useState}from'react'
import{ArrowRight,ChevronRight,Percent,RefreshCcw,Smartphone,Truck}from'lucide-react'
import{businessDiscountPercent,type Product}from'@/data/products'
import{matchKey,matchPrice}from'@/data/filters'
import{useCatalog}from'@/lib/shop-products'
import{useFilters}from'@/lib/use-filters'
import{ProductCard}from'@/components/ProductCard'
import{FilterFieldsets,FilterPanel,selectionCount,selectionLabel}from'@/components/ProductFilters'
import{HelpZone}from'@/components/HomepageInfo'

type Model='pro'|'pro-max'

/** De twee modellen van de iPhone 18-serie, in dezelfde volgorde als op de modelpagina. */
const models:{key:Model;name:string;fits:(product:Product)=>boolean}[]=[
  {key:'pro',name:'iPhone 18 Pro',fits:product=>!/pro max/i.test(product.name)},
  {key:'pro-max',name:'iPhone 18 Pro Max',fits:product=>/pro max/i.test(product.name)},
]
/** De iPhone 18-toestellen uit het assortiment; kleur en opslag zijn uitvoeringen van die producten. */
const isIPhone18=(product:Product)=>/iphone 18/i.test(product.name)&&!/hoes|case|screenprotector|glas|oplader/i.test(product.name)
const sorts=['Relevantie','Best beoordeeld','Prijs laag - hoog','Prijs hoog - laag','Meest populair']
const intro={
  pro:'Het is een klein toestel waar je altijd scherpe foto’s mee maakt. Je bedient iPhone 18 Pro gemakkelijk met 1 hand en het toestel past in je zak. Met de 3 lenzen maak je scherpe en kleurrijke foto’s, zelfs in het donker. Dankzij de telelens zijn je foto’s ook nog scherp als je tot 8 keer inzoomt. iPhone 18 Pro is een razendsnel toestel. Je hebt geen enkel probleem met de zwaarste apps en games en je gebruikt de nieuwste AI functies.',
  max:'Kijk comfortabel filmpjes en series op het grote 6,9 scherm van je iPhone 18 Pro Max. Dit grote toestel is vrij zwaar en past niet altijd in je zak. Je maakt altijd scherpe foto’s met heldere kleuren, dankzij de 3 camera’s achterop. Foto’s die je maakt met de telelens zijn zelfs scherp als je tot 8 keer inzoomt. Dankzij de razendsnelle processor werken de zwaarste apps en games soepel. Bovendien gebruik je de nieuwste AI functies.',
  closing:`Je koopt de iPhone 18 als los toestel, dus zonder abonnement. Ruil je je oude smartphone in, dan krijg je korting op je nieuwe iPhone. Als ondernemer krijg je bovendien ${businessDiscountPercent} ondernemerskorting, verrekend in je mandje.`,
}
const advice=[
  'Dit zijn de nieuwe kleuren van de iPhone 18 Pro',
  'Zo regel je de pre-order voor je hele team',
  'Wanneer komt de iPhone 18 Pro (Max) uit?',
]

export const Route=createFileRoute('/apple-iphone-18')({
  head:()=>({meta:[
    {title:'Apple iPhone 18 Pro en Pro Max kopen? | Coolblue Zakelijk'},
    {name:'description',content:'Alle uitvoeringen van de Apple iPhone 18 Pro en Pro Max, met prijzen inclusief én exclusief btw en ondernemerskorting voor zakelijke klanten.'},
  ]}),
  validateSearch:(search:Record<string,unknown>):{model?:Model}=>
    search.model==='pro'||search.model==='pro-max'?{model:search.model}:{},
  component:IPhone18Page,
})

function IPhone18Page(){
  const{model}=Route.useSearch()
  const{all}=useCatalog()
  const[sort,setSort]=useState(sorts[0])
  const[expanded,setExpanded]=useState(false)

  const range=useMemo(()=>all.filter(isIPhone18),[all])
  const active=models.find(item=>item.key===model)
  const scoped=useMemo(()=>active?range.filter(active.fits):range,[range,active])
  const filters=useFilters(scoped,model??'alle')

  const shown=useMemo(()=>{
    const order=[...filters.matches]
    if(sort==='Prijs laag - hoog')order.sort((a,b)=>matchPrice(a)-matchPrice(b))
    if(sort==='Prijs hoog - laag')order.sort((a,b)=>matchPrice(b)-matchPrice(a))
    if(sort==='Best beoordeeld')order.sort((a,b)=>b.product.rating-a.product.rating)
    if(sort==='Meest populair')order.sort((a,b)=>b.product.reviews-a.product.reviews)
    return order
  },[filters.matches,sort])

  const paragraphs=active?[active.key==='pro-max'?intro.max:intro.pro,intro.closing]:[intro.pro,intro.max,intro.closing]
  const title=active?`Apple ${active.name}`:'Apple iPhone 18 Pro en Pro Max'

  return <>
    <nav className="breadcrumbs wrap" aria-label="Kruimelpad">
      <Link to="/">Home</Link><ChevronRight/>
      <Link to="/categorie/$category" params={{category:'telefonie'}}>Telefonie</Link><ChevronRight/>
      <Link to="/collectie/$category/$collection" params={{category:'telefonie',collection:'mobiele-telefoons'}}>Mobiele telefoons</Link><ChevronRight/>
      <Link to="/collectie/$category/$collection/$item" params={{category:'telefonie',collection:'mobiele-telefoons',item:'apple-iphone'}}>Apple iPhone</Link><ChevronRight/>
      <span>{active?`Apple ${active.name}`:'Apple iPhone 18 serie'}</span>
    </nav>

    <nav className="model-strip wrap" aria-label="Andere iPhone-modellen">
      <Link to="/collectie/$category/$collection/$item" params={{category:'telefonie',collection:'mobiele-telefoons',item:'apple-iphone'}}>Apple iPhone</Link>
      <Link to="/apple-iphone-18" search={{}} className={model?undefined:'active'}>iPhone 18 serie</Link>
      {models.map(item=><Link key={item.key} to="/apple-iphone-18" search={{model:item.key}} className={model===item.key?'active':undefined}>{item.name}</Link>)}
      <Link to="/collectie/$category/$collection/$item" params={{category:'telefonie',collection:'mobiele-telefoons',item:'apple-iphone'}}>iPhone 17 serie</Link>
      <Link to="/collectie/$category/$collection/$item" params={{category:'telefonie',collection:'mobiele-telefoons',item:'refurbished-iphone'}}>Refurbished iPhone</Link>
    </nav>

    <header className="model-intro wrap">
      <h1>{title}</h1>
      {paragraphs.slice(0,expanded?undefined:1).map(text=><p key={text}>{text}</p>)}
      <button type="button" className="model-more" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Minder weergeven':'Meer weergeven'}</button>
      <div className="model-accessories">
        <Link to="/collectie/$category/$collection/$item" params={{category:'telefonie',collection:'iphone-accessoires',item:'iphone-hoesjes'}}>iPhone 18 hoesjes</Link>
        <Link to="/collectie/$category/$collection/$item" params={{category:'telefonie',collection:'iphone-accessoires',item:'iphone-screenprotectors'}}>iPhone 18 screenprotectors</Link>
        <Link to="/collectie/$category/$collection/$item" params={{category:'telefonie',collection:'iphone-accessoires',item:'iphone-opladers'}}>iPhone 18 opladers</Link>
      </div>
    </header>

    <section className="service-strip wrap" aria-label="Onze servicebeloftes">
      <div><Truck/><span><b>Gratis bezorgd</b><small>Op een moment dat jou past</small></span></div>
      <div><RefreshCcw/><span><b>Gratis ruilen</b><small>Binnen 30 dagen</small></span></div>
      <div><Smartphone/><span><b>Inruilkorting</b><small>Voor je oude toestel</small></span></div>
      <div><Percent/><span><b>{businessDiscountPercent} ondernemerskorting</b><small>Verrekend in je mandje</small></span></div>
    </section>

    <section className="catalog-zone" id="toestellen">
      <div className="wrap">
        <div className="catalog-head">
          <div><h2>{title}</h2><p>{shown.length} {shown.length===1?'uitvoering':'uitvoeringen'} van {scoped.length} {scoped.length===1?'model':'modellen'}</p></div>
          <select aria-label="Sorteren" value={sort} onChange={event=>setSort(event.target.value)}>{sorts.map(option=><option key={option}>{option}</option>)}</select>
        </div>
        <div className="catalog-layout">
          <FilterPanel className="model-filters" activeCount={selectionCount(filters.selection)+(model?1:0)}>
            <fieldset>
              <legend>Model</legend>
              <Link to="/apple-iphone-18" search={{}} className={model?undefined:'filter-active'}>Alle iPhone 18’s ({range.length})</Link>
              {models.map(item=><Link key={item.key} to="/apple-iphone-18" search={{model:item.key}} className={model===item.key?'filter-active':undefined}>{item.name} ({range.filter(item.fits).length})</Link>)}
            </fieldset>
            <FilterFieldsets facets={filters.facets.filter(facet=>facet.key!=='brand'&&facet.key!=='type')} selection={filters.selection} counts={filters.counts} onToggle={filters.toggle}/>
            <fieldset>
              <legend>Zakelijke service</legend>
              <p className="filter-note">Alle toestellen zijn inclusief btw-factuur en {businessDiscountPercent} ondernemerskorting.</p>
            </fieldset>
          </FilterPanel>
          <section>
            {filters.active&&<div className="active-filter"><span>{selectionLabel(filters.selection)}</span><button onClick={filters.clear}>Wis filters</button></div>}
            {shown.length
              ?<div className="product-grid">{shown.map(match=><ProductCard key={matchKey(match)} product={match.product} variant={match.variant} choices={match.choices} bulletCount={3}/>)}</div>
              :<div className="catalog-help"><b>Geen toestellen met deze combinatie</b><span>Wis een filter of vraag onze specialist naar de levertijd van jouw uitvoering.</span><button type="button" className="button secondary" onClick={filters.clear}>Wis filters</button></div>}
            <div className="catalog-help">
              <b>Meerdere toestellen voor je team?</b>
              <span>Onze zakelijke specialist regelt de levering, de inruil en één factuur.</span>
              <a href={emailHref}>Vraag een voorstel aan <ArrowRight/></a>
            </div>
          </section>
        </div>
      </div>
    </section>

    <section className="collection-advice">
      <div className="wrap">
        <div>
          <span className="kicker">Advies over de Apple iPhone 18</span>
          <h2>Onze specialisten schreven het voor je uit</h2>
          <p>Twijfel je tussen de Pro en de Pro Max, of wil je weten wanneer jouw uitvoering bezorgd wordt? Kom langs in een van onze 22 échte winkels of lees het advies van onze specialisten.</p>
          <a href={phoneHref}>Vraag advies aan <ArrowRight/></a>
        </div>
        <ul>{advice.map(item=><li key={item}><a href={phoneHref}>{item}<ChevronRight/></a></li>)}</ul>
      </div>
    </section>

    <HelpZone/>
  </>
}
