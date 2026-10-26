/**
 * Beeldtaal voor de catalogus: welk icoon en welke achtergrondkleur een product krijgt.
 * We leiden dit af van de subcollectie, zodat nieuwe producten automatisch goed staan.
 */
type Rule = [test: RegExp, icon: string, color: string]

const rules: Rule[] = [
  [/laptop|macbook|chromebook|notebook|workstation/i, 'laptop', '#dce7e2'],
  [/monitor|beeldscherm/i, 'monitor', '#dbe3e9'],
  [/desktop|mini-pc|imac/i, 'monitor', '#e0e5ea'],
  [/tablet|ipad|e-reader|notitieblok/i, 'tablet', '#e3e6ec'],
  [/telefoon|smartphone|iphone|refurbished/i, 'phone', '#e4e1dc'],
  [/hoesje|hoes|case|screenprotector/i, 'shield', '#e8e4dd'],
  [/lader|laadstation|powerbank|accu/i, 'battery', '#dbe7df'],
  [/smartwatch|watch|tracker/i, 'watch', '#e4e6e1'],
  [/router|access point|switch|wifi|powerline|netwerk/i, 'wifi', '#dde6ea'],
  [/videokaart|processor|moederbord|ram|voeding|behuizing/i, 'cpu', '#e1e3e8'],
  [/ssd|harde schijf|nas|geheugenkaart|opslag/i, 'harddrive', '#dfe4e8'],
  [/printer|inkt|toner|scanner/i, 'printer', '#e6e3dd'],
  [/tv|televisie|beamer|oled|qled|mediaspeler/i, 'tv', '#dce4ea'],
  [/soundbar|home cinema|subwoofer|receiver|speaker|box/i, 'speaker', '#e1dfda'],
  [/koptelefoon|oordopjes|airpods|headset/i, 'headphones', '#dfddd8'],
  [/microfoon|studio|dj|keyboard|platenspeler|radio/i, 'mic', '#e5e0d9'],
  [/bureau$|bureaus|bureaustoel|standaard|dock/i, 'briefcase', '#e6e1d7'],
  [/webcam|camera|lens|filter|flitser|statief|gimbal|drone/i, 'camera', '#dedbd6'],
  [/wasmachine|droger|was-droog|witgoed|wassen/i, 'washer', '#dde7e4'],
  [/strijk|stomer|stoomgenerator/i, 'flame', '#e8e0d8'],
  [/stofzuiger|kruimeldief|dweil|reiniger|prullenbak|schoonmaak/i, 'sparkles', '#e4dfd3'],
  [/thermostaat|airco|ventilator|kachel|verwarmer|lucht/i, 'thermometer', '#dfe6e3'],
  [/smart home|deurbel|rookmelder|camera's|alarm|deurslot|hub/i, 'shield', '#e0e4e8'],
  [/hue|lamp|verlichting/i, 'lightbulb', '#eee6d5'],
  [/boormachine|schuurmachine|zaag|grasmaaier|hogedruk|bewatering|klus/i, 'wrench', '#e6e2d6'],
  [/koffie|espresso|nespresso|senseo|dolce|melkopschuimer/i, 'coffee', '#e8ded5'],
  [/vaatwasser|koelkast|vriezer|oven|magnetron|kookplaat|quooker|inbouw/i, 'refrigerator', '#dfe5e6'],
  [/airfryer|frituur|waterkoker|tosti|contactgrill|broodbak|ijsmachine|bruiswater/i, 'utensils', '#e9e2d7'],
  [/mixer|blender|foodprocessor|staafmixer|handmixer|hakmolen|juicer/i, 'utensils', '#e7e3d9'],
  [/pan|pannenset|gourmet|pizzaoven|grillplaat/i, 'utensils', '#e9e0d4'],
  [/barbecue|bbq/i, 'flame', '#e7ddd2'],
  [/energie|contract|zonnepaneel|warmtepomp|laadpaal|split airco|overstap/i, 'zap', '#dbe7df'],
  [/cadeau|bon|fanartikel|kerst/i, 'gift', '#eadfe0'],
  [/tweedekans/i, 'recycle', '#e0e7dd'],
  [/muis|muizen|toetsenbord|kabel|beugel|versnipperaar|tas/i, 'mouse', '#e3e1dc'],
  [/verrekijker|telescoop/i, 'binoculars', '#dfe2e6'],
  [/software|licentie/i, 'appwindow', '#e2e4ea'],
  [/pakket|werkplek|zzp|mkb|zakelijk|grootzakelijk|byod/i, 'briefcase', '#e4e6e2'],
]

/** Zoekt het passende icoon en de kleur bij een subcollectie en productnaam. */
export const presentationFor = (sub: string, name: string): { icon: string; color: string } => {
  const haystack = `${sub} ${name}`
  for (const [test, icon, color] of rules) if (test.test(haystack)) return { icon, color }
  return { icon: 'package', color: '#e3e3e0' }
}

/** Voorraadmelding die per product verschilt maar wel stabiel blijft tussen bezoeken. */
const stockTexts = ['Morgen in huis', 'Vandaag verzonden', 'Op voorraad', 'Morgen in huis', 'Binnen 2 werkdagen bezorgd']
export const stockFor = (id: number) => stockTexts[id % stockTexts.length]

/** Beoordeling en aantal reviews, afgeleid van het product-id zodat de cijfers niet per herlaad veranderen. */
export const ratingFor = (id: number) => Number((4.3 + ((id * 7) % 7) / 10).toFixed(1))
export const reviewsFor = (id: number) => 18 + ((id * 37) % 412)
