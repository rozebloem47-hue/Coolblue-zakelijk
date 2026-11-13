import{contact,phoneHref}from'@/data/contact';import{blackFriday,campaignPhase,daysUntilBlackFriday,earlyBlackFriday}from'@/data/campaign';
import{useEffect,useRef,useState}from'react';import{Link}from'@tanstack/react-router';import{HeaderSearch}from'./HeaderSearch';import{ArrowLeft,ChevronDown,ChevronRight,Clock,Headphones,Menu,ShoppingCart,X}from'lucide-react';import{businessDiscountPercent,categories,collectionSlug,type Category}from'@/data/products';import{useCart}from'@/lib/cart-context';import{CartPanel}from'./CartPanel';

type Collection=Category['collections'][number]

/** Volgorde van de balk onder de koptekst, zoals op coolblue.nl. */
const navOrder=['computers-tablets','telefonie','beeld-geluid','zakelijk-thuiswerken','huishouden-wonen','keuken','foto-video','energie','acties-merken']
const navCategories=navOrder.map(slug=>categories.find(category=>category.slug===slug)).filter((category):category is Category=>Boolean(category))
const allCategories=[...navCategories,...categories.filter(category=>!navOrder.includes(category.slug))]

/** Vier kolommen, gevuld zoals in het uitklapmenu: vaste indeling waar die bestaat, anders evenwichtig verdeeld. */
function columnsFor(category:Category):Collection[][]{
  if(category.dropdownColumns)return category.dropdownColumns.map(column=>column.map(name=>category.collections.find(collection=>collection.name===name)).filter((collection):collection is Collection=>Boolean(collection))).filter(column=>column.length>0)
  const columns:Collection[][]=[[],[],[],[]];const weights=[0,0,0,0]
  for(const collection of category.collections){
    const index=weights.indexOf(Math.min(...weights))
    columns[index].push(collection);weights[index]+=collection.items.length+2
  }
  return columns.filter(column=>column.length>0)
}

export function SiteHeader(){
  const phase=campaignPhase();const{items,panelOpen,openPanel,closePanel}=useCart()
  const cartTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  // Het mandje klapt open zodra je eroverheen beweegt en sluit kort nadat je het verlaat.
  const hoverCart=()=>{if(cartTimer.current)clearTimeout(cartTimer.current);openPanel()}
  const leaveCart=()=>{if(cartTimer.current)clearTimeout(cartTimer.current);cartTimer.current=setTimeout(closePanel,300)}
  const[openKey,setOpenKey]=useState<string|null>(null)
  const[shownKey,setShownKey]=useState<string|null>(null)
  const[drawerOpen,setDrawerOpen]=useState(false)
  const[drawerSlug,setDrawerSlug]=useState<string|null>(null)
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null)

  const stopTimer=()=>{if(closeTimer.current){clearTimeout(closeTimer.current);closeTimer.current=null}}
  const open=(key:string)=>{stopTimer();setOpenKey(key);setShownKey(key)}
  const close=()=>{stopTimer();setOpenKey(null)}
  // Korte genadetijd: het menu blijft staan als de muis er even langs schiet.
  const deferClose=()=>{stopTimer();closeTimer.current=setTimeout(()=>setOpenKey(null),140)}
  const closeAll=()=>{close();setDrawerOpen(false);setDrawerSlug(null)}

  useEffect(()=>stopTimer,[])
  useEffect(()=>{
    if(!openKey&&!drawerOpen)return
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')closeAll()}
    document.addEventListener('keydown',onKeyDown)
    return()=>document.removeEventListener('keydown',onKeyDown)
  },[openKey,drawerOpen])
  useEffect(()=>{
    if(!drawerOpen)return
    const previous=document.body.style.overflow;document.body.style.overflow='hidden'
    return()=>{document.body.style.overflow=previous}
  },[drawerOpen])

  const shown=openKey??shownKey
  const shownCategory=navCategories.find(category=>category.slug===shown)
  const drawerCategory=allCategories.find(category=>category.slug===drawerSlug)

  const groups=(collections:Collection[],slug:string)=>collections.map(collection=><section key={collection.name}>
    <Link className="mega-collection" to="/collectie/$category/$collection" params={{category:slug,collection:collectionSlug(collection.name)}} onClick={closeAll}>{collection.name}</Link>
    {collection.items.map(item=><Link key={item} to="/collectie/$category/$collection/$item" params={{category:slug,collection:collectionSlug(collection.name),item:collectionSlug(item)}} onClick={closeAll}>{item}</Link>)}
  </section>)

  return <>
    <header className="site-header">
      <div className="header-bar">
        <div className="header-inner">
          <button className="drawer-button" aria-label="Menu openen" aria-expanded={drawerOpen} onClick={()=>{setDrawerSlug(null);setDrawerOpen(true)}}><Menu/></button>
          <Link to="/" className="logo" aria-label="Coolblue Zakelijk homepage" onClick={closeAll}><span className="logo-tile">cool<br/>blue</span><small>zakelijk</small></Link>
          <div className="assortment" onMouseEnter={()=>open('*')} onMouseLeave={deferClose}>
            <button type="button" className="assortment-button" aria-expanded={openKey==='*'} aria-haspopup="true" onClick={()=>openKey==='*'?close():open('*')}>
              <span className="assortment-label">Bekijk alle<strong>categorieën</strong></span>
              <ChevronDown/>
            </button>
          </div>
          <HeaderSearch onNavigate={closeAll}/>
          <nav className="header-actions" aria-label="Persoonlijke navigatie">
            <a className="action-text" href={phoneHref}>Advies</a>
            <div className="cart-menu" onMouseEnter={hoverCart} onMouseLeave={leaveCart}><Link to="/checkout" aria-label="Winkelmandje" aria-expanded={panelOpen} onFocus={hoverCart}><ShoppingCart/><ChevronDown className="action-caret"/>{items.length>0&&<b>{items.length}</b>}</Link><CartPanel/></div>
          </nav>
        </div>
      </div>

      <nav className="category-nav" aria-label="Productcategorieën" onMouseEnter={stopTimer} onMouseLeave={deferClose}>
        <div className="category-nav-inner">
          {navCategories.map(category=><Link key={category.slug} to="/categorie/$category" params={{category:category.slug}} className={openKey===category.slug?'active':undefined} aria-expanded={openKey===category.slug} onMouseEnter={()=>open(category.slug)} onFocus={()=>open(category.slug)} onClick={closeAll}>{category.name}</Link>)}
        </div>

        <div className="mega-menu" data-open={Boolean(openKey)} aria-hidden={!openKey} onMouseEnter={stopTimer}>
          <div className="mega-inner">
            {shown==='*'
              ?<>
                <div className="mega-departments">
                  {allCategories.map(category=><Link key={category.slug} to="/categorie/$category" params={{category:category.slug}} onClick={closeAll}>
                    <span aria-hidden="true">{category.icon}</span>
                    <span><strong>{category.name}</strong><small>{category.blurb}</small></span>
                    <ChevronRight/>
                  </Link>)}
                </div>
                <aside className="mega-advice">
                  <Headphones/>
                  <span><strong>Hulp nodig bij je keuze?</strong><small>Onze productspecialisten denken met je mee.</small></span>
                  <a href={phoneHref}>Bel {contact.phoneLabel}<ChevronRight/></a>
                </aside>
              </>
              :shownCategory&&<>
                <div className="mega-columns">
                  {columnsFor(shownCategory).map((column,index)=><div key={index}>{groups(column,shownCategory.slug)}</div>)}
                </div>
                <aside className="mega-advice">
                  <Headphones/>
                  <span><strong>Alles voor {shownCategory.name.toLowerCase()}</strong><small>{shownCategory.blurb}</small></span>
                  <Link to="/categorie/$category" params={{category:shownCategory.slug}} onClick={closeAll}>Bekijk de hele afdeling<ChevronRight/></Link>
                </aside>
              </>}
          </div>
        </div>
      </nav>
    </header>

    <div className="header-scrim" data-open={Boolean(openKey)} aria-hidden="true" onClick={close}/>
    <div className="promise-bar"><div><span>Voor 23.59 uur besteld, morgen gratis bezorgd</span><span>Gratis ruilen binnen 30 dagen</span><span>Zakelijke prijzen incl. én excl. btw</span><span className="promise-temp">{phase==='early'?<>Early Black Friday: tot 50% korting</>:<>Tijdelijke ondernemersactie: {businessDiscountPercent} ondernemerskorting</>}</span></div></div>
    <div className={`action-banner${phase==='off'?'':` bf-${phase}`}`}><div><Clock/>{phase==='early'?<span><b>Early Black Friday · {earlyBlackFriday.label}</b> Korting op het hele assortiment, tot 50%. Je {businessDiscountPercent} ondernemerskorting komt er nog bovenop.</span>:phase==='waiting'?<span><b>Black Friday · {blackFriday.label}</b> De Early Black Friday-sale is voorbij. Nog {daysUntilBlackFriday()} {daysUntilBlackFriday()===1?'dag':'dagen'} tot de echte Black Friday.</span>:<span><b>Tijdelijke ondernemersactie</b> Onze actiekortingen en de {businessDiscountPercent} ondernemerskorting gelden maar voor een beperkte periode.</span>}<Link to="/categorie/$category" params={{category:'acties-merken'}}>{phase==='early'?'Bekijk alle Black Friday-deals':'Bekijk de acties'} <ChevronRight/></Link></div></div>

    <div className="nav-drawer-scrim" data-open={drawerOpen} aria-hidden="true" onClick={closeAll}/>
    <aside className="nav-drawer" data-open={drawerOpen} aria-label="Menu" aria-hidden={!drawerOpen}>
      <div className="nav-drawer-head">
        <strong>Menu</strong>
        <button aria-label="Menu sluiten" onClick={closeAll}><X/></button>
      </div>
      <ul className="nav-drawer-list">
        {allCategories.map(category=><li key={category.slug}>
          <button onClick={()=>setDrawerSlug(category.slug)}>
            <span aria-hidden="true">{category.icon}</span>
            <span>{category.name}</span>
            <ChevronRight/>
          </button>
        </li>)}
      </ul>
      <div className="nav-drawer-sub" data-open={Boolean(drawerCategory)}>
        {drawerCategory&&<>
          <div className="nav-drawer-sub-head">
            <button aria-label="Terug naar het menu" onClick={()=>setDrawerSlug(null)}><ArrowLeft/></button>
            <strong>{drawerCategory.name}</strong>
          </div>
          <Link className="nav-drawer-all" to="/categorie/$category" params={{category:drawerCategory.slug}} onClick={closeAll}>Bekijk de hele afdeling<ChevronRight/></Link>
          {groups(drawerCategory.collections,drawerCategory.slug)}
        </>}
      </div>
    </aside>
  </>
}
