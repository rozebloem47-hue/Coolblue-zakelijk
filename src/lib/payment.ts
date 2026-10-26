/**
 * De bunq.me-link van de laatst geplaatste bestelling. We bewaren hem in
 * sessionStorage van dit tabblad, zodat de bedankpagina de klant opnieuw naar
 * de betaling kan sturen als die is weggeklikt. Er is bewust geen server-
 * functie die een link bij een ordernummer opzoekt: ordernummers lopen op en
 * zouden dan te raden zijn.
 */

const PREFIX = 'vv_betaling_'

function key(reference: string) {
  return `${PREFIX}${reference}`
}

export function rememberPaymentLink(reference: string, url: string) {
  if (typeof window === 'undefined' || !reference || !url) return
  try {
    window.sessionStorage.setItem(key(reference), url)
  } catch {
    // Zonder sessionStorage vervalt alleen het opnieuw kunnen betalen.
  }
}

export function recallPaymentLink(reference: string) {
  if (typeof window === 'undefined' || !reference) return ''
  try {
    return window.sessionStorage.getItem(key(reference)) ?? ''
  } catch {
    return ''
  }
}
