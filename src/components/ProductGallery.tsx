/**
 * Fotogalerij op de productpagina, naar het voorbeeld van Coolblue. Op desktop
 * een grote foto met pijlen en een rij miniaturen eronder; op mobiel een
 * veegbare strook over de volle breedte met bolletjes en een teller. Een klik
 * op de foto opent alle foto's schermvullend. Geef de pagina een `key` per
 * product mee, zodat een ander product weer bij de eerste foto begint.
 */
import{useCallback,useEffect,useRef,useState}from'react'
import{ChevronLeft,ChevronRight,Expand,X}from'lucide-react'
import type{Photo as PhotoSource}from'@/data/media'
import{Photo}from'./Photo'
import{ProductVisual}from'./ProductVisual'

/** Zoveel miniaturen tonen we; de laatste plek wordt dan een "+ nog meer"-tegel. */
const THUMBS=7

export function ProductGallery({photos,alt,icon,color}:{photos:PhotoSource[];alt:string;icon:string;color:string}){
  const track=useRef<HTMLUListElement>(null)
  const[active,setActive]=useState(0)
  const[zoom,setZoom]=useState<number|null>(null)
  const count=photos.length

  const go=useCallback((index:number)=>{
    const list=track.current
    if(!list)return
    const next=Math.max(0,Math.min(count-1,index))
    list.scrollTo({left:next*list.clientWidth,behavior:'smooth'})
    setActive(next)
  },[count])

  // De actieve foto volgt het vegen, ook zonder pijlen of miniaturen.
  const onScroll=()=>{
    const list=track.current
    if(list&&list.clientWidth)setActive(Math.round(list.scrollLeft/list.clientWidth))
  }

  if(!count)return <div className="gallery"><div className="gallery-stage"><ProductVisual icon={icon} color={color}/></div></div>

  const extra=count>THUMBS?count-(THUMBS-1):0
  const thumbs=extra?photos.slice(0,THUMBS-1):photos

  return <div className="gallery">
    <div className="gallery-stage">
      <ul className="gallery-track" ref={track} onScroll={onScroll} aria-label={`Foto's van ${alt}`}>
        {photos.map((photo,index)=><li key={photo.src} aria-label={`Foto ${index+1} van ${count}`}>
          <button type="button" onClick={()=>setZoom(index)} aria-label={`Foto ${index+1} groot bekijken`}>
            <Photo photo={photo} alt={index===0?alt:`${alt}, foto ${index+1}`} sizes="(max-width:767px) 100vw, (max-width:1180px) 55vw, 640px" eager={index===0}/>
          </button>
        </li>)}
      </ul>
      {count>1&&<>
        <button type="button" className="gallery-arrow is-prev" onClick={()=>go(active-1)} disabled={active===0} aria-label="Vorige foto"><ChevronLeft/></button>
        <button type="button" className="gallery-arrow is-next" onClick={()=>go(active+1)} disabled={active===count-1} aria-label="Volgende foto"><ChevronRight/></button>
        <span className="gallery-count" aria-live="polite">{active+1}/{count}</span>
      </>}
      <button type="button" className="gallery-expand" onClick={()=>setZoom(active)} aria-label="Foto's schermvullend bekijken"><Expand/></button>
    </div>

    {count>1&&<>
      <ol className="gallery-dots" aria-hidden="true">{photos.map((photo,index)=><li key={photo.src} className={index===active?'is-active':''}/>)}</ol>
      <ul className="gallery-thumbs">
        {thumbs.map((photo,index)=><li key={photo.src}>
          <button type="button" className={index===active?'is-active':''} onClick={()=>go(index)} aria-label={`Toon foto ${index+1}`} aria-current={index===active||undefined}>
            <Photo photo={photo} alt="" sizes="80px"/>
          </button>
        </li>)}
        {extra>0&&<li>
          <button type="button" className={`gallery-more${active>=THUMBS-1?' is-active':''}`} onClick={()=>setZoom(THUMBS-1)} aria-label={`Nog ${extra} foto's bekijken`}>
            <Photo photo={photos[THUMBS-1]} alt="" sizes="80px"/>
            <span>+{extra}</span>
          </button>
        </li>}
      </ul>
    </>}

    {zoom!=null&&<Lightbox photos={photos} alt={alt} start={zoom} onClose={index=>{setZoom(null);go(index)}}/>}
  </div>
}

/** Alle foto's schermvullend, te bedienen met pijltjestoetsen, vegen en Escape. */
function Lightbox({photos,alt,start,onClose}:{photos:PhotoSource[];alt:string;start:number;onClose:(index:number)=>void}){
  const[index,setIndex]=useState(start)
  const touch=useRef<number|null>(null)
  const close=useRef<HTMLButtonElement>(null)
  const count=photos.length
  const step=useCallback((delta:number)=>setIndex(current=>(current+delta+count)%count),[count])

  useEffect(()=>{
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    close.current?.focus()
    return()=>{document.body.style.overflow=previous}
  },[])

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape')onClose(index)
      else if(event.key==='ArrowLeft')step(-1)
      else if(event.key==='ArrowRight')step(1)
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[index,onClose,step])

  const photo=photos[index]
  return <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Foto's van ${alt}`}>
    <header className="lightbox-bar">
      <span>{alt}</span>
      <b>{index+1}/{count}</b>
      <button type="button" ref={close} onClick={()=>onClose(index)} aria-label="Sluiten"><X/></button>
    </header>
    <div className="lightbox-stage"
      onTouchStart={event=>{touch.current=event.touches[0].clientX}}
      onTouchEnd={event=>{
        if(touch.current==null)return
        const distance=event.changedTouches[0].clientX-touch.current
        if(Math.abs(distance)>40)step(distance<0?1:-1)
        touch.current=null
      }}>
      {count>1&&<button type="button" className="gallery-arrow is-prev" onClick={()=>step(-1)} aria-label="Vorige foto"><ChevronLeft/></button>}
      <Photo key={photo.src} photo={photo} alt={`${alt}, foto ${index+1}`} sizes="100vw" eager/>
      {count>1&&<button type="button" className="gallery-arrow is-next" onClick={()=>step(1)} aria-label="Volgende foto"><ChevronRight/></button>}
    </div>
    {count>1&&<ul className="lightbox-thumbs">
      {photos.map((item,thumb)=><li key={item.src}>
        <button type="button" className={thumb===index?'is-active':''} onClick={()=>setIndex(thumb)} aria-label={`Toon foto ${thumb+1}`} aria-current={thumb===index||undefined}>
          <Photo photo={item} alt="" sizes="72px"/>
        </button>
      </li>)}
    </ul>}
  </div>
}
