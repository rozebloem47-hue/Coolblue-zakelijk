import{useEffect,useState}from'react'
import{Pause,Play,ShoppingBag}from'lucide-react'
import{getRecentDuoOrders,type DuoOrderNotice}from'@/lib/duo-orders'

export function DuoOrderTicker(){
  const[orders,setOrders]=useState<DuoOrderNotice[]>([])
  const[index,setIndex]=useState(0)
  const[paused,setPaused]=useState(false)
  const[now,setNow]=useState(Date.now)

  useEffect(()=>{
    let active=true
    let pending=false
    const refresh=async()=>{
      if(pending||document.hidden)return
      pending=true
      try{
        const result=await getRecentDuoOrders()
        if(active){setOrders(result);setNow(Date.now())}
      }catch{
        if(active)setOrders([])
      }finally{pending=false}
    }
    void refresh()
    const poll=window.setInterval(()=>void refresh(),30000)
    document.addEventListener('visibilitychange',refresh)
    return()=>{active=false;window.clearInterval(poll);document.removeEventListener('visibilitychange',refresh)}
  },[])

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      setNow(Date.now())
      if(!paused&&!document.hidden)setIndex(value=>value+1)
    },6000)
    return()=>window.clearInterval(timer)
  },[paused])

  const recent=orders.filter(order=>order.expiresAt>now)
  const order=recent[index%recent.length]
  if(!order)return null
  return <div className="duo-order-ticker">
    <ShoppingBag aria-hidden="true"/>
    <p role="status" aria-live="polite" aria-atomic="true"><b>{order.name}</b> bestelde zojuist de {order.product}.</p>
    <button type="button" onClick={()=>setPaused(value=>!value)} aria-label={paused?'Bestelmeldingen hervatten':'Bestelmeldingen pauzeren'} aria-pressed={paused}>
      {paused?<Play aria-hidden="true"/>:<Pause aria-hidden="true"/>}
    </button>
  </div>
}
