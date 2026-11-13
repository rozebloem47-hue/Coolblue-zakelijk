-- Alle kleuren en opslagvarianten delen de leverdatum van dit catalogusproduct.
UPDATE "catalog_products"
SET "stock" = 'Leverbaar vanaf 7 december', "updated_at" = now()
WHERE "slug" = 'apple-iphone-duo-986126';
