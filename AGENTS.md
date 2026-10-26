# Projectarchitectuur

De applicatie gebruikt TanStack Start met bestandsroutes in `src/routes`. Herbruikbare winkelcomponenten staan in `src/components`, statische catalogusdata in `src/data` en clientcontexten in `src/lib`. Persistente tabellen staan in `db/schema.ts`; Netlify Functions in `netlify/functions` verzorgen analytics, beheerdata en merkassets.

## Conventies

Schrijf zichtbare tekst in het Nederlands. Gebruik de CSS-variabelen in `src/styles.css` en houd de zakelijke, warme servicebalie-identiteit aan. Prijzen in de winkel zijn inclusief btw en tonen altijd daarnaast de prijs exclusief 21% btw. Nieuwe databaseschemavijzigingen vereisen altijd een Drizzle-migratie.

## Beveiliging en data

Beheerfuncties vereisen een Netlify Identity-account met rol `admin`. Logo’s horen in Netlify Blobs; relationele data hoort in Netlify Database. Bewaar geen wachtwoorden of secrets in de repository.
