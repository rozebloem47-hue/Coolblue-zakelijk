CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY,
	"provider" text NOT NULL UNIQUE,
	"base_url" text DEFAULT 'https://api.finom.co' NOT NULL,
	"invoice_path" text DEFAULT '/v1/invoices' NOT NULL,
	"key_last4" text,
	"key_updated_at" timestamp,
	"sender_company" text,
	"sender_vat" text,
	"sender_iban" text,
	"sender_address" text,
	"payment_term_days" integer DEFAULT 14 NOT NULL,
	"auto_create" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"last_check_at" timestamp,
	"last_check_ok" boolean,
	"last_check_message" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY,
	"order_id" integer NOT NULL,
	"provider" text DEFAULT 'finom' NOT NULL,
	"external_id" text,
	"number" text,
	"status" text DEFAULT 'concept' NOT NULL,
	"amount" numeric(10,2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"pdf_url" text,
	"due_date" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "kvk" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "house_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "country" text DEFAULT 'Nederland';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal" numeric(10,2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount" numeric(10,2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_amount" numeric(10,2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text DEFAULT 'factuur' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "business_order" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "support_email" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "support_phone" text;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD COLUMN "referrer" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");