-- De volautomatische koffiemachines van JURA, Siemens, Philips en De'Longhi die via Coolblue-links zijn toegevoegd
-- (vaste actieprijs, fixed_deal = true) komen bovenaan in de koffiecollecties en zoekresultaten.
-- De winkel toont nieuwste producten eerst; deze producten krijgen daarom een nieuwere aanmaakdatum,
-- met behoud van hun onderlinge volgorde.
UPDATE "catalog_products" AS p
SET "created_at" = now() + (p."created_at" - latest."max_created")
FROM (
  SELECT max("created_at") AS "max_created"
  FROM "catalog_products"
  WHERE "fixed_deal" = true AND "category" = 'keuken' AND "collection" = 'Koffie'
) AS latest
WHERE p."fixed_deal" = true AND p."category" = 'keuken' AND p."collection" = 'Koffie';
