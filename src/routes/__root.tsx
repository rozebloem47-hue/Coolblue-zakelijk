import { HeadContent, Scripts, createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import '../styles.css'
import '../refinements.css'
import '../header.css'
import '../korting.css'
import '../iphone-18.css'
import '../subcollectie.css'
import '../productpagina.css'
import '../afrekenen.css'
import '../admin.css'
import '../mobiele-lijst.css'
import { CartProvider } from '@/lib/cart-context'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { Analytics } from '@/components/Analytics'
import { getShopProducts } from '@/lib/shop-products'

const siteName = 'Coolblue Zakelijk | Alles voor je bedrijf'
const siteDescription = 'Zakelijke elektronica met persoonlijk advies, snelle bezorging en prijzen inclusief én exclusief btw.'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: siteName,
      },
      {
        name: 'description',
        content: siteDescription,
      },
      {
        property: 'og:title',
        content: siteName,
      },
      {
        property: 'og:description',
        content: siteDescription,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      // Via HeadContent, zodat server en browser de <head> in dezelfde volgorde opbouwen.
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Zilla+Slab:wght@400;500;600&display=swap' },
    ],
  }),
  // Producten uit de beheeromgeving; een minuut vers is ruim genoeg voor de winkel.
  loader: () => getShopProducts(),
  staleTime: 60_000,
  component: App,
  shellComponent: RootDocument,
})
function App(){
  // De beheeromgeving is een eigen pagina: daar hoort geen winkelchroom bij.
  const path=useRouterState({select:state=>state.location.pathname})
  if(path.startsWith('/admin'))return <Outlet/>
  return <CartProvider><Analytics/><SiteHeader/><main><Outlet/></main><SiteFooter/></CartProvider>
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
