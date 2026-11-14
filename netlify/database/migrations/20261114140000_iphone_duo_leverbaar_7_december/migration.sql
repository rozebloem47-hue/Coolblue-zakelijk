-- De iPhone Duo (alle kleuren en opslagvarianten) is leverbaar vanaf 7 december.
-- De levertijd was via het beheer leeggemaakt, waardoor de winkel terugviel op 'Morgen in huis'.
UPDATE "catalog_products"
SET "stock" = 'Leverbaar vanaf 7 december', "updated_at" = now()
WHERE "slug" = 'apple-iphone-duo-986126';
