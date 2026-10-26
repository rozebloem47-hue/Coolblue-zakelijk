import{accessoryFallback,accessoryRules}from'./catalog/accessories'

/** Een specificatieregel op de productpagina: label en waarde. */
export type SpecTuple = [label: string, value: string]
export type Product = { id:number; slug:string; name:string; brand:string; category:string; subcategory:string; price:number; rating:number; reviews:number; stock:string; color:string; icon:string; bullets:string[]; description:string; series?:string; storage?:string; colorName?:string; pickup?:string; delivery?:string; tradeIn?:number; listPrice?:number; dealPercent?:number; specs?:SpecTuple[]; accessories?:string[]; specGroups?:{title:string;specs:SpecTuple[]}[]; imageId?:string; imageIds?:string[]; variantOptions?:VariantOption[]; variants?:ProductVariant[]; defaultVariant?:string }
/** Een keuze op de productpagina (kleur, opslag) met alle waarden die de klant kan kiezen. */
export type VariantOption={title:string;type:'color'|'choice';values:string[]}
/** Eén uitvoering van een product met een eigen prijs inclusief btw en eigen foto's. */
export type ProductVariant={sku:string;name:string;values:Record<string,string>;price:number;listPrice?:number;imageIds:string[];specs?:SpecTuple[]}

/** De gekozen uitvoering van een product, of de standaarduitvoering. Producten zonder varianten geven `undefined`. */
export const variantOf=(product:Product,sku?:string|null)=>product.variants?.length?product.variants.find(variant=>variant.sku===sku)??product.variants.find(variant=>variant.sku===product.defaultVariant)??product.variants[0]:undefined

/** Prijs, naam en foto van een product in een bepaalde uitvoering, zoals het mandje en de checkout ze tonen. */
export const priced=(product:Product,sku?:string|null)=>{
  const variant=variantOf(product,sku)
  return{variant,price:variant?.price??product.price,name:variant?.name||product.name,imageId:variant?.imageIds[0]??product.imageId,label:variant?Object.values(variant.values).join(' · '):''}
}
export type Category={slug:string;name:string;icon:string;blurb:string;collections:{name:string;items:string[]}[];dropdownColumns?:string[][]}
export const categories:Category[] = [
  {slug:'computers-tablets',name:'Computers & tablets',icon:'⌨',blurb:'Laptops, tablets, monitoren en accessoires',collections:[{name:'Laptops, desktops & monitoren',items:['Laptops','Windows laptops','Apple MacBook','Zakelijke laptops','Laptop workstations','Copilot+ laptops','Chromebooks','Monitoren','Zakelijke monitoren','Desktops','Zakelijke desktops','Laptophoezen','Muizen','Toetsenborden']},{name:'Tablets & e-readers',items:['Tablets','Zakelijke tablets','Apple iPad','Samsung tablets','Tablethoezen','E-readers','Digitale notitieblokken']},{name:'Netwerk & internet',items:['Mesh wifi routers','Routers','Access points','Powerline adapters','Switches','Wifi versterkers']},{name:'Computer onderdelen',items:['Videokaarten','Processoren','Moederborden','RAM geheugen','Computervoedingen','Computerbehuizingen']},{name:'Geheugen & opslag',items:['Interne harde schijven','Interne SSD','Externe harde schijven','Externe SSD','NAS']},{name:'Printers, inkt & scanners',items:['Printers','Zakelijke printers','All-in-one printers','Scanners','Printer inkt']}]},
  {slug:'telefonie',name:'Telefonie',icon:'☎',blurb:'Smartphones, smartwatches en accessoires',collections:[{name:'Mobiele telefoons',items:['Smartphones','Apple iPhone','Samsung smartphones','Google Pixel','Xiaomi smartphones','Opvouwbare smartphones','Zakelijke telefoons','Refurbished iPhone','Refurbished telefoons & tablets']},{name:'Telefoon accessoires',items:['Telefoonhoesjes','Screenprotectors','Telefoon opladers','Autoladers','Draadloze opladers','Powerbanks']},{name:'iPhone accessoires',items:['iPhone hoesjes','iPhone screenprotectors','iPhone opladers']},{name:'Samsung accessoires',items:['Samsung hoesjes','Samsung screenprotectors','Samsung telefoon opladers']},{name:'Vaste telefoons',items:['DECT telefoons','Gigaset telefoons','Vaste seniorentelefoons']},{name:'Smartwatches',items:['Apple Watch','Samsung Galaxy smartwatches','Garmin smartwatches','Health trackers']}]},
  {slug:'beeld-geluid',name:'Beeld & geluid',icon:'▷',blurb:'Televisies, audio, home cinema en muziek',collections:[{name:'Televisies & beamers',items:['Televisies',"Smart tv's","OLED tv's","QLED tv's",'Tv met soundbar','Beamers']},{name:'Televisie accessoires',items:['TV beugels','HDMI kabels','Mediaspelers','Tv standaards','Video kabels']},{name:'Home cinema',items:['Home cinema sets','Soundbars','Subwoofers']},{name:'Speakers en boxen',items:['Draadloze speakers','Bluetooth speakers','Wifi speakers','Sonos speakers','Hifi speakers','Audiostreamers','Receivers']},{name:'Audio voor onderweg',items:['Koptelefoons','Noise cancelling koptelefoons','Oordopjes','Apple AirPods',"Autoradio's"]},{name:'Muziek',items:["Radio's",'Platenspelers','Microfoons','DJ gear','Studio gear','Keyboards']}]},
  {slug:'zakelijk-thuiswerken',name:'Zakelijk & thuiswerken',icon:'▦',blurb:'Werkplekken, bedrijfswinkels en zakelijke services',collections:[{name:'(Thuis) Werkplek',items:['Bureaus','Bureaustoelen','Laptopstandaarden','Docking stations','Office headsets','Webcams','Papierversnipperaars','Vergader microfoons']},{name:'Zakelijke services',items:['ZZP','Kleinzakelijk','MKB','Grootzakelijk']},{name:'Bedrijfswinkel',items:['Thuiswerkwinkel','Bring Your Own Device','Cadeauwinkel','Kerstgeschenken']}]},
  {slug:'huishouden-wonen',name:'Huishouden & wonen',icon:'⌂',blurb:'Wassen, schoonmaken, klimaat, smart home en klussen',collections:[{name:'Wassen & drogen',items:['Drogers','Wasmachines','Wasmachine abonnementen','Wasmachine en droger sets','Was-droogcombinaties','Witgoed abonnementen','Witgoed reparaties','Gratis Wassen & Drogen']},{name:'Strijken',items:['Strijkijzers','Stoomstrijkijzers','Stoomgeneratoren','Kledingstomers']},{name:'Stofzuigen',items:['Alle stofzuigers','Steelstofzuigers','Dyson stofzuigers','Robotstofzuigers','Kruimeldieven']},{name:'Schoonmaken',items:['Stoomreinigers','Elektrische dweilen','Ruitenreinigers','Prullenbakken']},{name:'Klimaatbeheersing',items:['Thermostaten',"Airco's",'Ventilatoren','Terrasverwarmers','Elektrische kachels','Luchtontvochtigers','Luchtbevochtigers','Luchtreinigers']},{name:'Smart Home',items:['Smart home hubs','Slimme deurbellen','Slimme rookmelders',"IP-camera's",'Alarmsystemen','Slimme deursloten']},{name:'Smart lampen',items:['Philips Hue','Smart lamp startpakketten','Slimme buitenverlichting']},{name:'Tuin & klussen',items:['Boormachines','Bouwstofzuigers','Schuurmachines','Afkortzagen','Grasmaaiers','Hogedrukreinigers','Tuinbewatering']}]},
  {slug:'keuken',name:'Keuken',icon:'◇',blurb:'Koffie, koken, keukenapparatuur en barbecues',collections:[{name:'Grote keukenapparatuur',items:['Inbouw keukenapparatuur','Vaatwassers','Koelkasten','Vriezers','Ovens','Magnetrons','Kookplaten','Quooker']},{name:'Kleine keukenapparatuur',items:['Airfryers','Frituurpannen','Waterkokers','Contactgrills & tosti-ijzers','Broodbakmachines','Ijsmachines','Bruiswatermachines']},{name:'Koffie',items:['Volautomatische espressomachines','Jura koffiemachines','Pistonmachines','Nespresso','Senseo','Dolce Gusto','Filterkoffieapparaten','Melkopschuimers']},{name:'Keukenmachines',items:['Keukenmixers','Blenders','Foodprocessors','Staafmixers','Handmixers','Hakmolens','Juicers']},{name:'Pannen',items:['Pannensets','Koekenpannen','Braadpannen']},{name:'Fun cooking',items:['Gourmetstellen','Pizzaovens','Grillplaten']},{name:'Barbecues',items:['Houtskool barbecues','Kamado barbecues','Gas barbecues','Elektrische barbecues','Weber barbecues']}]},
  {slug:'foto-video',name:'Foto & video',icon:'◉',blurb:'Camera’s, lenzen, drones en studio',collections:[{name:"Video- & actioncamera's",items:['Drones','Drone accessoires',"Action camera's","360 graden camera's",'Dashcams','Camcorders','Videocamera accessoires']},{name:"Fotocamera's",items:["Compactcamera's","Systeemcamera's","Spiegelreflexcamera's","Instant camera's"]},{name:'Camera accessoires',items:['Cameralenzen','Lensfilters','Flitsers','Statieven','Cameratassen',"Accu's voor camera's",'Fotolijstjes','Geheugenkaarten']},{name:'Content creatie',items:["Vlog camera's",'Gimbals','Microfoons','Studioverlichting','Foto & video bewerkingssoftware']},{name:'Kijkers & scopes',items:['Verrekijkers','Telescopen']}]},
  {slug:'energie',name:'Coolblue Energie',icon:'⚡',blurb:'Energiecontracten, zonnepanelen, warmtepompen en laadpalen',collections:[{name:'Energiecontracten',items:['Aanbod energiecontracten','Coolblue energiedeals','Dynamische uurprijzen','Overstappen naar Coolblue Energie']},{name:'Warmtepompen',items:['Warmtepomp offerte aanvragen','Warmtepompen advies']},{name:'Zonnepanelen',items:['Zonnepanelen advies op maat','Zonnepanelen advies']},{name:'Laadpalen',items:['Laadpalen offerte aanvragen','Laadpalen advies','Laadpalen assortiment']},{name:"Split airco's",items:['Split airco advies','Split airco assortiment']}]},
  {slug:'acties-merken',name:'Acties & merken',icon:'🏷',blurb:'Aanbiedingen, alle merken en cadeaus',collections:[{name:'Aanbiedingen',items:['Tweedekans','Televisie aanbiedingen','Smartphone aanbiedingen','Laptops aanbiedingen','Desktop aanbiedingen','Tablet aanbiedingen','Wasmachine aanbiedingen','Wasdroger aanbiedingen','Stofzuiger aanbiedingen','Monitor aanbiedingen']},{name:'Alle merken',items:['Apple','ASUS','BlueBuilt','Bosch','Dyson','Google','HP','Karcher','KitchenAid','Lenovo','Philips','Samsung','Siemens','Sonos','Wisberg','Xiaomi']},{name:'Cadeaus',items:['Cadeaubonnen','Coolblue fanartikelen']}]},
]
/** Korte prijsnotatie zonder centen, zoals op actiebadges: € 620,- */
export const moneyShort=(v:number)=>`€ ${new Intl.NumberFormat('nl-NL').format(Math.round(v))},-`
/** Ondernemerskorting: zakelijke klanten krijgen dit percentage korting, verrekend in het mandje. */
export const businessDiscount=0.05
export const businessDiscountPercent=`${Math.round(businessDiscount*100)}%`
export const businessPrice=(v:number)=>v*(1-businessDiscount)
/** Alle merken in een assortiment, op alfabet. */
export const brandsIn=(pool:Product[])=>[...new Set(pool.map(p=>p.brand))].sort((a,b)=>a.localeCompare(b,'nl'))
export const money=(v:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(v); export const exVat=(v:number)=>v/1.21; export const decimal=(v:number)=>new Intl.NumberFormat('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1}).format(v)
export const collectionSlug=(name:string)=>name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/&/g,'en').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')

export type Collection=Category['collections'][number]
/** Opzoeken van afdeling, collectie en subcollectie op basis van de slugs uit de url. */
export const findCategory=(slug:string)=>categories.find(category=>category.slug===slug)
export const findCollection=(category:Category,slug:string)=>category.collections.find(collection=>collectionSlug(collection.name)===slug)
export const findItem=(collection:Collection,slug:string)=>collection.items.find(item=>collectionSlug(item)===slug)
/** Producten met extra actiekorting bovenop de ondernemerskorting. */
export const dealProducts=(pool:Product[])=>pool.filter(product=>product.dealPercent)

/** Eén specificatie van een product op label, zonder op hoofdletters te letten. */
export const specOf=(product:Product,...labels:string[])=>{
  const wanted=labels.map(label=>label.toLowerCase())
  return (product.specs??[]).find(([label])=>wanted.includes(label.toLowerCase()))?.[1]
}
const phoneSubs=new Set(['Smartphones','Apple iPhone','Samsung smartphones','Google Pixel','Xiaomi smartphones','Opvouwbare smartphones','Zakelijke telefoons'])
const laptopSubs=new Set(['Laptops','Windows laptops','Apple MacBook','Zakelijke laptops','Laptop workstations','Copilot+ laptops','Chromebooks'])
const tvSubs=new Set(['Televisies',"Smart tv's","OLED tv's","QLED tv's",'Tv met soundbar'])
const headphoneSubs=new Set(['Koptelefoons','Noise cancelling koptelefoons'])
const vacuumSubs=new Set(['Alle stofzuigers','Steelstofzuigers','Dyson stofzuigers','Robotstofzuigers','Kruimeldieven'])
export const isPhone=(product:Product)=>phoneSubs.has(product.subcategory)
export const isLaptop=(product:Product)=>laptopSubs.has(product.subcategory)
export const isTv=(product:Product)=>tvSubs.has(product.subcategory)
export const isHeadphone=(product:Product)=>headphoneSubs.has(product.subcategory)
export const isVacuum=(product:Product)=>vacuumSubs.has(product.subcategory)
const named=(pattern:RegExp)=>(product:Product)=>pattern.test(`${product.name} ${product.series??''}`)

/**
 * Subcollecties met een eigen regel. Een product staat op één plek in het menu
 * (voor het kruimelpad), maar hoort vaak in meer collecties: een ThinkPad is
 * een laptop, een Windows-laptop én een zakelijke laptop.
 */
const collectionRules:Record<string,(product:Product)=>boolean>={
  smartphones:isPhone,
  'apple-iphone':product=>isPhone(product)&&/iphone/i.test(product.name),
  'samsung-smartphones':product=>isPhone(product)&&product.brand==='Samsung',
  'google-pixel':product=>isPhone(product)&&/pixel/i.test(product.name),
  'xiaomi-smartphones':product=>isPhone(product)&&product.brand==='Xiaomi',
  'opvouwbare-smartphones':product=>isPhone(product)&&named(/\b(fold|flip)\b|iphone duo/i)(product),
  'zakelijke-telefoons':product=>isPhone(product)&&named(/xcover|enterprise/i)(product),
  laptops:isLaptop,
  'windows-laptops':product=>isLaptop(product)&&/windows/i.test(specOf(product,'Besturingssysteem')??(product.brand==='Apple'?'':'Windows')),
  'apple-macbook':product=>isLaptop(product)&&/macbook/i.test(product.name),
  'zakelijke-laptops':product=>isLaptop(product)&&named(/thinkpad|thinkbook|elitebook|probook|expertbook|zbook|latitude/i)(product),
  'laptop-workstations':product=>isLaptop(product)&&(named(/zbook|proart|thinkpad (p|t\d+g)|workstation/i)(product)||specOf(product,'Soort videokaart')==='Dedicated'),
  'copilot-laptops':product=>isLaptop(product)&&(specOf(product,'Microsoft Copilot+ PC')==='Ja'||/copilot\+/i.test(product.name)),
  chromebooks:product=>isLaptop(product)&&/chromebook/i.test(product.name),
  // Brede onderwerpen tonen alles van die soort, ook wat onder een smaller producttype staat.
  televisies:isTv,
  'smart-tv-s':isTv,
  'oled-tv-s':product=>isTv(product)&&named(/oled/i)(product),
  'qled-tv-s':product=>isTv(product)&&named(/qled/i)(product),
  koptelefoons:isHeadphone,
  'alle-stofzuigers':isVacuum,
  'dyson-stofzuigers':product=>isVacuum(product)&&product.brand==='Dyson',
  // De Dyson V-modellen zijn steelstofzuigers.
  steelstofzuigers:product=>isVacuum(product)&&product.brand==='Dyson'&&/\bv\d+/i.test(product.name),
}
/** Onderwerpen als 'Smartphone aanbiedingen': dezelfde soort producten, maar alleen met korting. */
const dealTopics:Record<string,(product:Product)=>boolean>={
  'televisie-aanbiedingen':isTv,
  'smartphone-aanbiedingen':isPhone,
  'laptops-aanbiedingen':isLaptop,
  'laptop-aanbiedingen':isLaptop,
  'desktop-aanbiedingen':named(/desktop|mini pc|all-in-one|imac/i),
  'tablet-aanbiedingen':named(/tablet|ipad/i),
  'monitor-aanbiedingen':named(/monitor|beeldscherm/i),
  'wasmachine-aanbiedingen':named(/wasmachine|was-droogcombinatie/i),
  'wasdroger-aanbiedingen':named(/droger/i),
  'stofzuiger-aanbiedingen':isVacuum,
}
/** Producten die echt bij een subcollectie horen: een eigen regel, anders gelijk producttype, hetzelfde merk of de naam bevat het onderwerp. */
export const productsForItem=(item:string,pool:Product[])=>{
  const key=collectionSlug(item)
  const topic=dealTopics[key]
  if(topic)return pool.filter(product=>product.dealPercent&&topic(product))
  const rule=collectionRules[key]
  if(rule)return pool.filter(product=>collectionSlug(product.subcategory)===key||rule(product))
  return pool.filter(product=>collectionSlug(product.subcategory)===key||collectionSlug(product.name).includes(key)||collectionSlug(`${product.brand} ${product.subcategory}`)===key||collectionSlug(product.brand)===key)
}
/** Producten uit een verwant producttype: het onderwerp is een smallere of bredere variant. */
export const productsNearItem=(item:string,pool:Product[])=>{const key=collectionSlug(item);return pool.filter(product=>{const sub=collectionSlug(product.subcategory);return sub!==key&&(key.includes(sub)||sub.includes(key))})}
/** Alles uit dezelfde collectie: de producten van elke subcollectie samen. */
export const productsForCollection=(collection:Collection,pool:Product[])=>{const found=new Set(collection.items.flatMap(item=>productsForItem(item,pool)));return pool.filter(product=>found.has(product))}
/** Zakelijk advies per afdeling, zodat elke subcollectiepagina een eigen invalshoek houdt. */
export const categoryAdvice:Record<string,string>={
  'computers-tablets':'Onze specialisten denken mee over uitrol, beheer en garantie voor meerdere werkplekken tegelijk.',
  telefonie:'We leveren los toestel of complete vloot, met zakelijke garantie en een factuur per bestelling.',
  'beeld-geluid':'Van vergaderruimte tot ontvangstbalie: we adviseren over formaat, montage en aansluitingen.',
  'zakelijk-thuiswerken':'Richt een werkplek in die thuis en op kantoor hetzelfde werkt, tot en met de kabels.',
  'huishouden-wonen':'Voor kantoor, praktijk of verhuur: apparaten die veel gebruik aankunnen.',
  keuken:'Voor de bedrijfskeuken of pantry, met installatie en het meenemen van je oude apparaat.',
  'foto-video':'Voor eigen beeldmateriaal, productfoto’s en bedrijfsvideo’s, inclusief advies over lenzen en licht.',
  energie:'We rekenen je zakelijke situatie door en verzorgen de installatie van begin tot eind.',
  'acties-merken':'Scherpe prijzen blijven ook zakelijk gelden, inclusief btw-factuur en ondernemerskorting.',
}

/**
 * De specificaties van een product in een bepaalde uitvoering. Uitvoeringen
 * bewaren alleen wat afwijkt van de standaarduitvoering (opslag, werkgeheugen,
 * processor). Zonder die gegevens vervangen we waarden die gelijk zijn aan de
 * keuze van de standaarduitvoering, zoals "512 GB" door "256 GB".
 */
export const specGroupsFor=(product:Product,variant?:ProductVariant)=>{
  const groups=product.specGroups??[]
  const standard=product.variants?.find(item=>item.sku===product.defaultVariant)
  if(!variant||!standard||variant.sku===standard.sku)return groups
  const own=new Map((variant.specs??[]).map(([label,value])=>[label.toLowerCase(),value]))
  const swaps=new Map<string,string>(Object.entries(variant.values).map(([title,value]):[string,string]=>[standard.values[title]??'',value]).filter(([from,to])=>from&&from!==to))
  const seen=new Set<string>()
  const result=groups.map(group=>({...group,specs:group.specs.map(([label,value]):SpecTuple=>{
    const key=label.toLowerCase()
    seen.add(key)
    if(own.has(key))return[label,own.get(key)!]
    return[label,variant.specs?value:swaps.get(value)??value]
  })}))
  const extra=(variant.specs??[]).filter(([label])=>!seen.has(label.toLowerCase()))
  if(extra.length&&result.length)result[result.length-1]={...result[result.length-1],specs:[...result[result.length-1].specs,...extra]}
  return result
}
export const specsFor=(product:Product,variant?:ProductVariant)=>product.specGroups?.length?specGroupsFor(product,variant).flatMap(group=>group.specs):product.specs??[]

/** Het product met de laagste prijs uit een subcollectie, zodat een accessoireblok gevarieerd blijft. */
const cheapestIn=(pool:Product[],sub:string,skip:Set<number>)=>pool.filter(product=>product.subcategory===sub&&!skip.has(product.id)).sort((a,b)=>a.price-b.price)[0]
/**
 * Geschikte accessoires bij een product: eerst de expliciet gekoppelde artikelen,
 * daarna per passende subcollectie het voordeligste artikel en tot slot de rest
 * uit diezelfde subcollecties.
 */
export const accessoriesFor=(product:Product,pool:Product[],limit=6)=>{
  const picks:Product[]=[]
  const skip=new Set<number>([product.id])
  const add=(candidate?:Product)=>{if(candidate&&!skip.has(candidate.id)){picks.push(candidate);skip.add(candidate.id)}}
  for(const slug of product.accessories??[])add(pool.find(item=>item.slug===slug))
  const subs=accessoryRules[product.subcategory]??accessoryFallback[product.category]??[]
  for(const sub of subs){if(picks.length>=limit)break;add(cheapestIn(pool,sub,skip))}
  for(const sub of subs){
    if(picks.length>=limit)break
    for(const candidate of pool.filter(item=>item.subcategory===sub&&!skip.has(item.id))){if(picks.length>=limit)break;add(candidate)}
  }
  return picks.slice(0,limit)
}
/** Vergelijkbare producten: zelfde subcollectie en prijsklasse eerst, anders zelfde afdeling. */
export const similarProducts=(product:Product,pool:Product[],limit=4)=>{
  const closeness=(item:Product)=>Math.abs(item.price-product.price)
  const same=pool.filter(item=>item.id!==product.id&&item.subcategory===product.subcategory).sort((a,b)=>closeness(a)-closeness(b))
  const near=pool.filter(item=>item.id!==product.id&&item.category===product.category&&item.subcategory!==product.subcategory).sort((a,b)=>closeness(a)-closeness(b))
  return [...same,...near].slice(0,limit)
}
/** De afdeling en collectie waarin een product staat, voor het kruimelpad. */
export const trailFor=(product:Product)=>{
  const category=findCategory(product.category)
  const collection=category?.collections.find(item=>item.items.includes(product.subcategory))
  return {category,collection}
}
