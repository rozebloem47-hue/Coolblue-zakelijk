import{useEffect,useId,useMemo,useRef,useState,type FormEvent,type KeyboardEvent}from'react'
import{Link,useNavigate,useRouterState}from'@tanstack/react-router'
import{ChevronRight,Search,X}from'lucide-react'
import{exVat,money}from'@/data/products'
import{matchPrice}from'@/data/filters'
import{searchProducts}from'@/data/search'
import{photoForProduct}from'@/data/media'
import{useCatalog}from'@/lib/shop-products'

const SUGGESTIONS=6

/**
 * De zoekbalk in de koptekst. Tijdens het typen verschijnen de best passende
 * uitvoeringen; Enter of de zoekknop opent alle resultaten op /zoeken.
 */
export function HeaderSearch({onNavigate}:{onNavigate?:()=>void}){
  const navigate=useNavigate()
  const{all}=useCatalog()
  const location=useRouterState({select:state=>state.location})
  const current=location.pathname==='/zoeken'?String((location.search as {q?:string}).q??''):''
  const[query,setQuery]=useState(current)
  const[open,setOpen]=useState(false)
  const[active,setActive]=useState(-1)
  const box=useRef<HTMLDivElement>(null)
  const input=useRef<HTMLInputElement>(null)
  const listId=useId()

  // Op de zoekpagina toont het veld de zoekopdracht uit de url; elders begint het leeg.
  useEffect(()=>{setQuery(current);setOpen(false)},[current,location.pathname])

  const results=useMemo(()=>searchProducts(all,query),[all,query])
  const suggestions=results.slice(0,SUGGESTIONS)
  const showList=open&&query.trim().length>0

  useEffect(()=>setActive(-1),[query])
  useEffect(()=>{
    if(!showList)return
    const onPointer=(event:PointerEvent)=>{if(!box.current?.contains(event.target as Node))setOpen(false)}
    document.addEventListener('pointerdown',onPointer)
    return()=>document.removeEventListener('pointerdown',onPointer)
  },[showList])

  const finish=()=>{setOpen(false);input.current?.blur();onNavigate?.()}
  const submit=(event:FormEvent)=>{
    event.preventDefault()
    const q=query.trim()
    if(!q){input.current?.focus();return}
    const pick=active>=0?suggestions[active]:undefined
    if(pick)navigate({to:'/products/$productId',params:{productId:pick.product.slug},search:pick.variant?{uitvoering:pick.variant.sku}:{}})
    else navigate({to:'/zoeken',search:{q}})
    finish()
  }
  const onKeyDown=(event:KeyboardEvent<HTMLInputElement>)=>{
    if(event.key==='Escape'){setOpen(false);return}
    if(!suggestions.length)return
    if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setActive(index=>(index+1)%suggestions.length)}
    if(event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(index=>index<=0?suggestions.length-1:index-1)}
  }

  return <div className="header-search" ref={box}>
    <form className="search" role="search" onSubmit={submit}>
      <input ref={input} type="search" name="q" value={query} placeholder="Zoeken naar..." aria-label="Zoeken naar producten" autoComplete="off" enterKeyHint="search"
        role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active>=0?`${listId}-${active}`:undefined}
        onChange={event=>{setQuery(event.target.value);setOpen(true)}} onFocus={()=>setOpen(true)} onKeyDown={onKeyDown}/>
      {query&&<button type="button" className="search-clear" aria-label="Zoekopdracht wissen" onClick={()=>{setQuery('');input.current?.focus()}}><X/></button>}
      <button type="submit" aria-label="Zoeken"><Search/></button>
    </form>
    {showList&&<div className="search-suggest" id={listId} role="listbox" aria-label="Zoeksuggesties">
      {suggestions.length
        ?<>
          {suggestions.map((match,index)=>{
            const name=match.variant?.name||match.product.name
            const photo=photoForProduct({...match.product,imageId:match.variant?.imageIds[0]??match.product.imageId},120)
            const price=matchPrice(match)
            return <Link key={`${match.product.id}:${match.variant?.sku??''}`} id={`${listId}-${index}`} role="option" aria-selected={index===active} className={index===active?'is-active':undefined}
              to="/products/$productId" params={{productId:match.product.slug}} search={match.variant?{uitvoering:match.variant.sku}:{}} onMouseEnter={()=>setActive(index)} onClick={finish}>
              <span className="search-suggest-thumb">{photo&&<img src={photo.src} alt="" loading="lazy" referrerPolicy="no-referrer"/>}</span>
              <span className="search-suggest-name"><small>{match.product.brand}</small>{name}</span>
              <span className="search-suggest-price"><b>{money(price)}</b><small>{money(exVat(price))} excl. btw</small></span>
            </Link>
          })}
          <Link className="search-suggest-all" to="/zoeken" search={{q:query.trim()}} onClick={finish}>Bekijk alle {results.length} {results.length===1?'resultaat':'resultaten'}<ChevronRight/></Link>
        </>
        :<p className="search-suggest-empty">Geen producten gevonden voor ‘{query.trim()}’. Probeer een merk of producttype.</p>}
    </div>}
  </div>
}
