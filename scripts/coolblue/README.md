# Producten met foto overnemen

Elke rij in `rows.tsv` is één echt Coolblue-product en bevat de foto er meteen bij,
zodat product en foto nooit los van elkaar kunnen raken:

```
categorie<TAB>naam<TAB>beeld-id<TAB>prijs
```

Het beeld-id is het getal achter `image.coolblue.nl/transparent/max/<breedte>xauto/products/`.
`src/data/media.ts` zet dat id via `productPhotos` om in een CDN-URL, dus een rij
toevoegen is genoeg om een product zijn eigen foto te geven.

## Rijen ophalen

Per Coolblue-categoriepagina (bijvoorbeeld `https://www.coolblue.nl/steelstofzuigers`)
levert één paginafetch 5 tot 22 producten op met naam, beeld-id en prijs. Welke
pagina's dat doen is voorspelbaar:

- Een pagina over één productsoort geeft een productoverzicht: `/microfoons`,
  `/dashcams`, `/verrekijkers`, `/receivers`, `/radios`, `/koptelefoons`,
  `/bluetooth-speakers`, `/papierversnipperaars`, `/systeemcameras`, `/muizen`.
- Een afdelingspagina (`/wasmachines`, `/televisies`, `/laptops`, `/koelkasten`)
  geeft alleen tegels van onderliggende categorieën of series, met een contenthash
  in plaats van een beeld-id. Die hashes zijn bruikbaar als categoriefoto.
- Onder zo'n afdeling zijn de merk- en typefilters wél overzichten, en die leveren
  het meeste op: `/mobiele-telefoons/apple`, `/mobiele-telefoons/samsung`,
  `/laptops/hp`, `/televisies/oled`. Bij witgoed geven de merkfilters series
  (`/wasmachines/bosch`), dus daar valt per model niets te halen.
- Vraag de links van een afdelingspagina op om te zien welke filters er zijn.
- `/zoeken*`, `*/top-10/*` en `*/api/*` staan in robots.txt als niet toegestaan;
  die blijven buiten de pijplijn.

Een verwijzing in `subjectPhotos` mag zowel een contenthash van 32 tekens als een
productnummer zijn. `refImage` in `src/data/media.ts` kiest de juiste URL, dus een
categorie zonder sfeerfoto kan een echte productfoto uit die categorie gebruiken.

Twee aanvullende bronnen zonder paginafetch:

- `HEAD https://www.coolblue.nl/product/<id>` geeft bij een bestaand id een 308 met
  de canonieke productnaam in de `location`-header, en een 307 bij een onbekend id.
  Let op: na een paar honderd verzoeken volgt 403; houd het bij een laag tempo.
- `https://image.coolblue.nl/transparent/max/500xauto/products/<id>` bevestigt of er
  beeld bij een id hoort (200 met `image/*`), en is een los CDN zonder die limiet.

## Rijen toepassen

```
node scripts/coolblue/apply-photos.mjs          # laat zien wat er zou wijzigen
node scripts/coolblue/apply-photos.mjs --write   # schrijft de entry's in media.ts
```

Het script koppelt een rij aan een bestaand catalogusproduct wanneer het merk en
alle modelnummers overeenkomen, en rapporteert de rijen die nog geen product in de
catalogus hebben. Met `--misses` komen de rijen in beeld die net geen koppeling
kregen; zo is te zien of de vergelijking te streng staat. Die rijen zijn de kandidaten voor nieuwe seeds in
`src/data/catalog/*.ts`.

## Dekking meten

```
node scripts/coolblue/photo-coverage.mjs
```

Dit bouwt de catalogus en telt per product welke foto wordt gekozen: een eigen
productfoto, de foto van de subcollectie, of niets. Ook zichtbaar is welke foto's
door veel producten worden gedeeld; dat zijn de categorieën die als eerste eigen
modelfoto's kunnen krijgen.

## Beeld controleren

Alle 302 verwijzingen in `src/data/media.ts` zijn op het CDN nagelopen en gaven
200 met een `image/*`-inhoudstype. Volg daarbij altijd de omleiding (`curl -sSL`):
het eerste antwoord kan een 307 met JSON zijn. Let op de juiste URL-vorm, want
redactiefoto's staan onder `max/<breedte>xauto/content/` in plaats van
`transparent/max/<breedte>xauto/products/`.
