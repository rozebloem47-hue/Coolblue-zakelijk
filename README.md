# VoltVoorraad

Een Nederlandstalige B2B-webshop voor elektronica, met categorieën, merkselectie, productdetails, winkelmand, zakelijke checkout en een beveiligd live beheerdashboard.

## Technologie

TanStack Start en React vormen de frontend. Netlify Identity beveiligt `/admin`, Netlify Database bewaart instellingen, orders en bezoekersactiviteit, en Netlify Blobs bewaart geüploade logo’s.

## Lokaal starten

Installeer afhankelijkheden met `pnpm install` en start via `pnpm dev`. Authenticatie werkt op een echte Netlify deploy. Nodig de eerste beheerder uit via Netlify Identity en geef dit account de rol `admin`.
