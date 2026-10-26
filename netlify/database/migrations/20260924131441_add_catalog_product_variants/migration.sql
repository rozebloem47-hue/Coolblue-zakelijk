ALTER TABLE "catalog_products" ADD COLUMN "variant_options" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD COLUMN "variants" jsonb DEFAULT '[]' NOT NULL;