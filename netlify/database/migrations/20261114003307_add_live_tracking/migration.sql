ALTER TABLE "visitor_events" ADD COLUMN "device" text;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD COLUMN "browser" text;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD COLUMN "os" text;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD COLUMN "product_name" text;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD COLUMN "cart_value" numeric(10,2);--> statement-breakpoint
ALTER TABLE "visitor_events" ADD COLUMN "cart_items" integer;--> statement-breakpoint
CREATE INDEX "visitor_events_created_at_idx" ON "visitor_events" ("created_at");