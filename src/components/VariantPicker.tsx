import{Check,ChevronDown}from'lucide-react'
import{exVat,money,type Product,type ProductVariant}from'@/data/products'
import{productImage}from'@/data/media'

/**
 * De uitvoering die hoort bij een klik op een waarde: dezelfde keuzes als nu,
 * met alleen deze waarde anders. Bestaat die combinatie niet, dan de uitvoering
 * met deze waarde die de meeste andere keuzes gelijk houdt.
 */
const closest=(variants:ProductVariant[],current:ProductVariant,title:string,value:string)=>{
  const wanted={...current.values,[title]:value}
  const score=(variant:ProductVariant)=>Object.entries(wanted).filter(([key,item])=>variant.values[key]===item).length
  return variants.filter(variant=>variant.values[title]===value).sort((a,b)=>score(b)-score(a))[0]
}

/**
 * Kleur kies je met knoppen met een foto. De overige keuzes (opslag, processor,
 * werkgeheugen) staan samen in één keuzemenu "Kies je variant", met per
 * uitvoering in de gekozen kleur de prijs inclusief en exclusief btw.
 */
export function VariantPicker({product,variant,onPick}:{product:Product;variant:ProductVariant;onPick:(sku:string)=>void}){
  const variants=product.variants??[]
  const options=product.variantOptions??[]
  const colorTitle=options.find(option=>option.type==='color')?.title
  const specs=options.filter(option=>option.type!=='color')
  const sameColor=variants.filter(item=>!colorTitle||item.values[colorTitle]===variant.values[colorTitle])
  // Verschillen de uitvoeringen ook in model (zoals JURA E8 of C9), dan staat de naam van het model erbij.
  const models=new Set(sameColor.map(item=>item.name.replace(/\s*\(.*\)$/,''))).size>1
  const label=(item:ProductVariant)=>{
    const values=specs.map(option=>item.values[option.title]).filter(Boolean).join(' · ')
    return models&&values?`${item.name} · ${values}`:values||item.name
  }
  return <div className="pdp-variants">
    {options.filter(option=>option.type==='color').map(option=>{
      const selected=variant.values[option.title]
      return <fieldset key={option.title} className={`pdp-variant-group is-${option.type}`}>
        <legend>{option.title}: <b>{selected}</b></legend>
        <div className="pdp-variant-options">
          {option.values.map(value=>{
            const target=closest(variants,variant,option.title,value)
            if(!target)return null
            const active=value===selected
            // Andere keuzes veranderen mee als deze combinatie niet bestaat.
            const exact=Object.entries(variant.values).every(([key,item])=>key===option.title||target.values[key]===item)
            const photo=option.type==='color'&&target.imageIds[0]?productImage(target.imageIds[0],80):null
            return <button key={value} type="button" className={`pdp-variant${active?' is-active':''}${exact?'':' is-other'}`} aria-pressed={active} onClick={()=>onPick(target.sku)} title={exact?undefined:`Alleen leverbaar als ${Object.entries(target.values).filter(([key])=>key!==option.title).map(([key,item])=>`${key.toLowerCase()} ${item}`).join(', ')}`}>
              {photo&&<img src={photo.src} alt="" loading="lazy" referrerPolicy="no-referrer"/>}
              <span className="pdp-variant-name">{active&&<Check/>}{value}</span>
            </button>
          })}
        </div>
      </fieldset>
    })}
    {specs.length>0&&sameColor.length>1&&<label className="pdp-variant-select">
      <span>Kies je variant</span>
      <select value={variant.sku} onChange={event=>onPick(event.target.value)}>
        {sameColor.map(item=><option key={item.sku} value={item.sku}>{`${label(item)} — ${money(item.price)} (${money(exVat(item.price))} excl. btw)`}</option>)}
      </select>
      <ChevronDown aria-hidden/>
    </label>}
  </div>
}
