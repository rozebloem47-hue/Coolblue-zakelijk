import{useEffect,useState,type ReactNode}from'react'
import{SlidersHorizontal,X}from'lucide-react'
import type{Facet,Selection}from'@/data/filters'

/**
 * De filterzijbalk. Op mobiel staat er een balk met "Filteren" en de extra
 * knoppen uit `toolbar` (zoals sorteren) die bij het scrollen bovenaan blijft,
 * zodat je meteen de producten ziet. De filters openen dan als paneel over het
 * hele scherm, met onderin een knop die het aantal resultaten toont.
 */
export function FilterPanel({className='',activeCount=0,resultCount,toolbar,children}:{className?:string;activeCount?:number;resultCount?:number;toolbar?:ReactNode;children:ReactNode}){
  const[open,setOpen]=useState(false)
  // Achter het open paneel scrollt de pagina niet mee; Escape sluit het paneel.
  useEffect(()=>{
    if(!open)return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)}
    window.addEventListener('keydown',onKey)
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey)}
  },[open])
  return <aside className={`filters ${className}${open?' is-open':''}`}>
    <div className="filter-bar">
      <button type="button" className="filter-toggle" aria-expanded={open} onClick={()=>setOpen(true)}>
        <SlidersHorizontal/> Filteren{activeCount?<span className="filter-toggle-count">{activeCount}</span>:null}
      </button>
      {toolbar&&<div className="filter-bar-extra">{toolbar}</div>}
    </div>
    <div className="filter-body" role={open?'dialog':undefined} aria-modal={open||undefined} aria-label="Filters"
      // Een link in het paneel (zoals een ander model) opent een nieuwe lijst: dan sluit het paneel.
      onClick={event=>{if((event.target as HTMLElement).closest('a'))setOpen(false)}}>
      <div className="filter-sheet-head">
        <h3><SlidersHorizontal/> Filteren</h3>
        <button type="button" className="filter-close" aria-label="Filters sluiten" onClick={()=>setOpen(false)}><X/></button>
      </div>
      <div className="filter-sheet-content">{children}</div>
      <div className="filter-sheet-foot">
        <button type="button" className="button primary" onClick={()=>setOpen(false)}>{resultCount==null?'Bekijk resultaten':`Toon ${resultCount} ${resultCount===1?'resultaat':'resultaten'}`}</button>
      </div>
    </div>
  </aside>
}

/** Sorteerkeuze voor in de mobiele filterbalk. */
export function SortSelect({value,options,onChange}:{value:string;options:string[];onChange:(value:string)=>void}){
  return <label className="sort-select"><span>Sorteren</span>
    <select aria-label="Sorteren" value={value} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option}>{option}</option>)}</select>
  </label>
}

/** De filterblokken in de zijbalk. Per filter zie je hoeveel producten bij een waarde passen. */
export function FilterFieldsets({facets,selection,counts,onToggle}:{facets:Facet[];selection:Selection;counts:(key:string,value:string)=>number;onToggle:(key:string,value:string)=>void}){
  return <>{facets.map(facet=><fieldset key={facet.key}>
    <legend>{facet.title}</legend>
    {facet.values.map(value=>{
      const checked=selection[facet.key]?.includes(value)??false
      const count=counts(facet.key,value)
      return <label key={value} className={!checked&&!count?'filter-empty':undefined}>
        <input type="checkbox" checked={checked} disabled={!checked&&!count} onChange={()=>onToggle(facet.key,value)}/>
        {value} <small className="filter-count">({count})</small>
      </label>
    })}
  </fieldset>)}</>
}

/** De gekozen filters als tekst, bijvoorbeeld "Apple, 256 GB". */
export const selectionLabel=(selection:Selection)=>Object.values(selection).flat().join(', ')

/** Hoeveel filterwaarden er zijn aangevinkt. */
export const selectionCount=(selection:Selection)=>Object.values(selection).flat().length
