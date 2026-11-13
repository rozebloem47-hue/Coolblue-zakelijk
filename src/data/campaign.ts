/**
 * Black Friday-campagne. De Early Black Friday-sale loopt van 13 tot en met
 * 20 november 2026 (Nederlandse tijd) over het hele assortiment; daarna telt
 * de winkel af naar de echte Black Friday op vrijdag 27 november 2026.
 */
export const earlyBlackFriday={
  start:new Date('2026-11-13T00:00:00+01:00'),
  end:new Date('2026-11-21T00:00:00+01:00'),
  label:'13 t/m 20 november',
}
export const blackFriday={date:new Date('2026-11-27T00:00:00+01:00'),label:'vrijdag 27 november'}

export type CampaignPhase='early'|'waiting'|'off'
export const campaignPhase=(now=new Date()):CampaignPhase=>
  now>=earlyBlackFriday.start&&now<earlyBlackFriday.end?'early':now>=earlyBlackFriday.end&&now<blackFriday.date?'waiting':'off'
export const isEarlyBlackFriday=(now=new Date())=>campaignPhase(now)==='early'

/** Hele dagen tot de echte Black Friday, minimaal 0. */
export const daysUntilBlackFriday=(now=new Date())=>Math.max(0,Math.ceil((blackFriday.date.getTime()-now.getTime())/86400000))

type SaleSubject={name:string;brand:string;subcategory?:string}

/**
 * Kortingspercentage per product tijdens de sale:
 * Quooker 45%, iPhone 18 en iPhone Duo 10%, MacBook M5 en Neo 20%. De rest krijgt 25–50%,
 * oplopend naarmate het product minder premium (goedkoper) is.
 */
export const salePercentFor=(product:SaleSubject,price:number)=>{
  if(/quooker/i.test(product.brand)||/quooker/i.test(product.subcategory??''))return 45
  // De nieuwste iPhones (iPhone 18 en iPhone Duo) krijgen 10%; alleen oudere iPhones krijgen meer korting.
  if(/iphone (18|duo)/i.test(product.name))return 10
  if(/macbook/i.test(product.name)&&/\b(m5|neo)\b/i.test(product.name))return 20
  if(price>=2000)return 25
  if(price>=1000)return 30
  if(price>=500)return 35
  if(price>=200)return 40
  if(price>=75)return 45
  return 50
}

/** Actieprijs inclusief 21% btw: vanaf € 100 afgerond op hele euro's, daaronder op centen. */
export const salePrice=(price:number,percent:number)=>{const value=price*(1-percent/100);return value>=100?Math.round(value):Math.max(0.01,Math.round(value*100)/100)}

/** Korte actienaam voor labels op kaarten en productpagina's. */
export const saleLabel=(now=new Date())=>isEarlyBlackFriday(now)?'Early Black Friday':'Tijdelijke actie'
