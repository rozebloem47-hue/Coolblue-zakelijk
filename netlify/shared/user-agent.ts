/**
 * Leest apparaat, browser en besturingssysteem uit een user-agent en herkent
 * bots, crawlers en geautomatiseerde browsers. Bewust klein en zonder
 * afhankelijkheden: dit draait bij elk meetpunt.
 */
const BOT=/bot\b|bot\/|crawl|spider|slurp|scrap|fetch|preview|monitor|uptime|pingdom|lighthouse|pagespeed|headless|phantom|puppeteer|playwright|selenium|webdriver|python|curl|wget|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|ahrefs|semrush|mj12|dotbot|petal|yandex|baidu|bytespider|gptbot|claude|anthropic|perplexity|facebookexternalhit|whatsapp|telegram|discord|slack|skype|embedly|quora|pinterest|vercel|netlify|datadog|newrelic|statuscake|site24x7|chrome-lighthouse|google-inspectiontool|apis-google|mediapartners|adsbot|feedfetcher|bingpreview|ia_archiver|archive\.org/i

export const isBot=(ua:string)=>!ua||ua.length<20||ua.length>600||BOT.test(ua)||!/mozilla|opera/i.test(ua)

export type Agent={device:'mobiel'|'tablet'|'desktop';browser:string;os:string}

export const parseAgent=(ua:string,hints:{touch?:boolean;width?:number}={}):Agent=>{
  const os=/iphone|ipod/i.test(ua)?'iOS':/ipad/i.test(ua)?'iPadOS':/android/i.test(ua)?'Android':/windows phone/i.test(ua)?'Windows Phone':/windows/i.test(ua)?'Windows':/cros/i.test(ua)?'ChromeOS':/mac os x|macintosh/i.test(ua)?'macOS':/linux/i.test(ua)?'Linux':'Onbekend'
  // iPads melden zich als Mac; een aanraakscherm verraadt ze.
  const ipadAsMac=os==='macOS'&&hints.touch
  const tablet=ipadAsMac||/ipad|tablet|kindle|silk|playbook/i.test(ua)||(/android/i.test(ua)&&!/mobile/i.test(ua))
  const mobile=!tablet&&/mobi|iphone|ipod|android|windows phone/i.test(ua)
  const browser=
    /instagram/i.test(ua)?'Instagram-app':
    /fban|fbav|fb_iab/i.test(ua)?'Facebook-app':
    /tiktok|musical_ly|bytedancewebview/i.test(ua)?'TikTok-app':
    /snapchat/i.test(ua)?'Snapchat-app':
    /linkedinapp/i.test(ua)?'LinkedIn-app':
    /edg(e|a|ios)?\//i.test(ua)?'Edge':
    /opr\/|opera|opt\//i.test(ua)?'Opera':
    /samsungbrowser/i.test(ua)?'Samsung Internet':
    /yabrowser/i.test(ua)?'Yandex':
    /brave/i.test(ua)?'Brave':
    /firefox|fxios/i.test(ua)?'Firefox':
    /crios|chrome|chromium/i.test(ua)?'Chrome':
    /safari/i.test(ua)?'Safari':'Overig'
  return{device:tablet?'tablet':mobile?'mobiel':'desktop',browser,os:ipadAsMac?'iPadOS':os}
}
