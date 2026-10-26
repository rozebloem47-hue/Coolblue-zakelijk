CREATE TABLE "bunq_context" (
	"id" integer PRIMARY KEY,
	"api_key_hash" text DEFAULT '' NOT NULL,
	"key_last4" text,
	"private_key_pem" text DEFAULT '' NOT NULL,
	"public_key_pem" text DEFAULT '' NOT NULL,
	"installation_token" text DEFAULT '' NOT NULL,
	"server_public_key_pem" text DEFAULT '' NOT NULL,
	"device_registered" boolean DEFAULT false NOT NULL,
	"session_token" text DEFAULT '' NOT NULL,
	"session_expires_at" timestamp,
	"bunq_user_id" integer,
	"monetary_account_id" integer,
	"monetary_account_iban" text DEFAULT '' NOT NULL,
	"last_error" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "bunq_payment_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "bunq_tab_id" integer;