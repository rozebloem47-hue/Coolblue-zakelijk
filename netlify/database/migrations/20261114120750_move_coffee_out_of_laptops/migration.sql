-- Koffieproducten die bij het importeren per ongeluk in "Laptops" terechtkwamen, horen in Keuken > Koffie.
-- Alleen rijen zonder laptopspecificaties en van koffiemerken; echte laptops blijven staan.
UPDATE "catalog_products" SET
  "category"='keuken',
  "collection"='Koffie',
  "subcategory"=CASE
    WHEN "name" ~* 'senseo' THEN 'Senseo'
    WHEN "name" ~* 'dolce gusto' THEN 'Dolce Gusto'
    WHEN "name" ~* 'nespresso|l''or barista' THEN 'Nespresso'
    WHEN "name" ~* 'melk|cool control|isoleerbeker' THEN 'Koffie accessoires'
    WHEN "name" ~* 'baratza|grinder|smeg cgf|solis scala|krups f203|krups gx3328|stelio|p\.a\.g\.|molen' THEN 'Koffiemolens'
    WHEN "name" ~* 'sage|classic em|precision|mini maestro|barista|espresso|oracle' THEN 'Pistonmachines'
    ELSE 'Koffie accessoires'
  END,
  "updated_at"=now()
WHERE "category"='computers-tablets'
  AND "subcategory"='Laptops'
  AND "brand" IN ('Sage','Krups','DeLonghi','De''Longhi','Philips','Baratza','WMF','Solis','Jura','JURA','SMEG','Siemens')
  AND "spec_groups"::text !~* 'Besturingssysteem|Processor';
