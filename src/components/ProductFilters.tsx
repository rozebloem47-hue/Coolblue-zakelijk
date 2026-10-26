import{useState,type ReactNode}from'react'
import{ChevronDown,SlidersHorizontal}from'lucide-react'
import type{Facet,Selection}from'@/data/filters'

/** De filterzijbalk. Op mobiel is die ingeklapt achter een knop "Filters", zodat je meteen de producten ziet. */
export function FilterPanel({className='',activeCount=0,children}:{className?:string;activeCount?:number;children:ReactNode}){
  const[open,setOpen]=useState(false)
  return <aside className={`filters ${className}${open?' is-open':''}`}>
    <button type="button" className="filter-toggle" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
      <SlidersHorizontal/> Filters{activeCount?<span className="filter-toggle-count">{activeCount}</span>:null}<ChevronDown className="filter-toggle-chevron"/>
    </button>
    <div className="filter-body">
      <h3><SlidersHorizontal/> Filteren</h3>
      {children}
    </div>
  </aside>
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
