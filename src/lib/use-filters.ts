import{useCallback,useEffect,useMemo,useState}from'react'
import{applyFilters,facetsFor,type Selection}from'@/data/filters'
import type{Product}from'@/data/products'

/** Filterkeuzes voor een lijst producten. Een andere pagina (`resetKey`) begint weer zonder filters. */
export function useFilters(pool:Product[],resetKey:string){
  const[selection,setSelection]=useState<Selection>({})
  useEffect(()=>setSelection({}),[resetKey])
  const facets=useMemo(()=>facetsFor(pool),[pool])
  const matches=useMemo(()=>applyFilters(pool,selection),[pool,selection])
  // Hoeveel producten je overhoudt als je binnen dit filter alleen deze waarde kiest.
  const counts=useCallback((key:string,value:string)=>applyFilters(pool,{...selection,[key]:[value]}).length,[pool,selection])
  const toggle=useCallback((key:string,value:string)=>setSelection(current=>{
    const values=current[key]??[]
    return{...current,[key]:values.includes(value)?values.filter(item=>item!==value):[...values,value]}
  }),[])
  const clear=useCallback(()=>setSelection({}),[])
  const active=Object.values(selection).some(values=>values.length)
  return{selection,facets,matches,counts,toggle,clear,active}
}
