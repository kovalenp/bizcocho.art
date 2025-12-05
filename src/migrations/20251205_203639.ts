import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'es');
  CREATE TYPE "public"."enum_classes_schedule_days_of_week" AS ENUM('0', '1', '2', '3', '4', '5', '6');
  CREATE TYPE "public"."enum_classes_type" AS ENUM('class', 'course');
  CREATE TYPE "public"."enum_classes_currency" AS ENUM('eur', 'usd');
  CREATE TYPE "public"."enum_classes_schedule_recurrence" AS ENUM('weekly', 'biweekly', 'monthly');
  CREATE TYPE "public"."enum_sessions_session_type" AS ENUM('class', 'course');
  CREATE TYPE "public"."enum_sessions_status" AS ENUM('scheduled', 'cancelled', 'completed');
  CREATE TYPE "public"."enum_bookings_booking_type" AS ENUM('class', 'course');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('pending', 'confirmed', 'cancelled', 'attended', 'no-show');
  CREATE TYPE "public"."enum_bookings_payment_status" AS ENUM('unpaid', 'paid', 'refunded', 'failed');
  CREATE TYPE "public"."enum_bookings_locale" AS ENUM('en', 'es');
  CREATE TYPE "public"."enum_gift_certificates_type" AS ENUM('gift', 'promo');
  CREATE TYPE "public"."enum_gift_certificates_status" AS ENUM('pending', 'active', 'partial', 'redeemed', 'expired');
  CREATE TYPE "public"."enum_gift_certificates_currency" AS ENUM('eur', 'usd');
  CREATE TYPE "public"."enum_gift_certificates_discount_type" AS ENUM('percentage', 'fixed');
  CREATE TYPE "public"."enum_gift_certificates_locale" AS ENUM('en', 'es');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"first_name" varchar,
  	"last_name" varchar,
  	"phone" varchar,
  	"address" varchar,
  	"city" varchar,
  	"postal_code" varchar,
  	"country" varchar DEFAULT 'Spain',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "media_locales" (
  	"alt" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"color" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "classes_schedule_days_of_week" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_classes_schedule_days_of_week",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "classes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_classes_type" DEFAULT 'class' NOT NULL,
  	"instructor_id" integer,
  	"featured_image_id" integer,
  	"price_cents" numeric NOT NULL,
  	"currency" "enum_classes_currency" DEFAULT 'eur',
  	"duration_minutes" numeric DEFAULT 180 NOT NULL,
  	"max_capacity" numeric DEFAULT 8 NOT NULL,
  	"is_published" boolean DEFAULT false,
  	"schedule_start_date" timestamp(3) with time zone,
  	"schedule_end_date" timestamp(3) with time zone,
  	"schedule_recurrence" "enum_classes_schedule_recurrence" DEFAULT 'weekly',
  	"schedule_start_time" varchar DEFAULT '18:00',
  	"schedule_timezone" varchar DEFAULT 'Europe/Madrid',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "classes_locales" (
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"location" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "classes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"tags_id" integer
  );
  
  CREATE TABLE "instructors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"photo_id" integer,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "instructors_locales" (
  	"bio" varchar,
  	"specialties" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"session_type" "enum_sessions_session_type" NOT NULL,
  	"class_id" integer NOT NULL,
  	"start_date_time" timestamp(3) with time zone NOT NULL,
  	"timezone" varchar DEFAULT 'Europe/Madrid',
  	"status" "enum_sessions_status" DEFAULT 'scheduled' NOT NULL,
  	"available_spots" numeric,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"booking_type" "enum_bookings_booking_type" NOT NULL,
  	"user_id" integer,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"number_of_people" numeric DEFAULT 1 NOT NULL,
  	"status" "enum_bookings_status" DEFAULT 'pending' NOT NULL,
  	"payment_status" "enum_bookings_payment_status" DEFAULT 'unpaid' NOT NULL,
  	"stripe_payment_intent_id" varchar,
  	"gift_certificate_code" varchar,
  	"gift_certificate_amount_cents" numeric,
  	"stripe_amount_cents" numeric,
  	"original_price_cents" numeric,
  	"booking_date" timestamp(3) with time zone NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"checked_in" boolean DEFAULT false,
  	"notes" varchar,
  	"locale" "enum_bookings_locale" DEFAULT 'en',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"sessions_id" integer
  );
  
  CREATE TABLE "gift_certificates_redemptions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"booking_id" integer NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"redeemed_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "gift_certificates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"type" "enum_gift_certificates_type" NOT NULL,
  	"status" "enum_gift_certificates_status" DEFAULT 'pending' NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"initial_value_cents" numeric,
  	"current_balance_cents" numeric,
  	"currency" "enum_gift_certificates_currency" DEFAULT 'eur',
  	"discount_type" "enum_gift_certificates_discount_type",
  	"discount_value" numeric,
  	"max_uses" numeric,
  	"current_uses" numeric DEFAULT 0,
  	"purchaser_email" varchar,
  	"purchaser_first_name" varchar,
  	"purchaser_last_name" varchar,
  	"purchaser_phone" varchar,
  	"recipient_email" varchar,
  	"recipient_name" varchar,
  	"recipient_personal_message" varchar,
  	"stripe_payment_intent_id" varchar,
  	"notes" varchar,
  	"locale" "enum_gift_certificates_locale" DEFAULT 'en',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"tags_id" integer,
  	"classes_id" integer,
  	"instructors_id" integer,
  	"sessions_id" integer,
  	"bookings_id" integer,
  	"gift_certificates_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_locales" ADD CONSTRAINT "tags_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "classes_schedule_days_of_week" ADD CONSTRAINT "classes_schedule_days_of_week_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "classes" ADD CONSTRAINT "classes_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "classes" ADD CONSTRAINT "classes_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "classes_locales" ADD CONSTRAINT "classes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "classes_rels" ADD CONSTRAINT "classes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "classes_rels" ADD CONSTRAINT "classes_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "classes_rels" ADD CONSTRAINT "classes_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "instructors" ADD CONSTRAINT "instructors_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "instructors_locales" ADD CONSTRAINT "instructors_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "gift_certificates_redemptions" ADD CONSTRAINT "gift_certificates_redemptions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gift_certificates_redemptions" ADD CONSTRAINT "gift_certificates_redemptions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."gift_certificates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_classes_fk" FOREIGN KEY ("classes_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_instructors_fk" FOREIGN KEY ("instructors_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_certificates_fk" FOREIGN KEY ("gift_certificates_id") REFERENCES "public"."gift_certificates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE UNIQUE INDEX "tags_locales_locale_parent_id_unique" ON "tags_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "classes_schedule_days_of_week_order_idx" ON "classes_schedule_days_of_week" USING btree ("order");
  CREATE INDEX "classes_schedule_days_of_week_parent_idx" ON "classes_schedule_days_of_week" USING btree ("parent_id");
  CREATE INDEX "classes_instructor_idx" ON "classes" USING btree ("instructor_id");
  CREATE INDEX "classes_featured_image_idx" ON "classes" USING btree ("featured_image_id");
  CREATE INDEX "classes_updated_at_idx" ON "classes" USING btree ("updated_at");
  CREATE INDEX "classes_created_at_idx" ON "classes" USING btree ("created_at");
  CREATE UNIQUE INDEX "classes_slug_idx" ON "classes_locales" USING btree ("slug","_locale");
  CREATE UNIQUE INDEX "classes_locales_locale_parent_id_unique" ON "classes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "classes_rels_order_idx" ON "classes_rels" USING btree ("order");
  CREATE INDEX "classes_rels_parent_idx" ON "classes_rels" USING btree ("parent_id");
  CREATE INDEX "classes_rels_path_idx" ON "classes_rels" USING btree ("path");
  CREATE INDEX "classes_rels_media_id_idx" ON "classes_rels" USING btree ("media_id");
  CREATE INDEX "classes_rels_tags_id_idx" ON "classes_rels" USING btree ("tags_id");
  CREATE UNIQUE INDEX "instructors_slug_idx" ON "instructors" USING btree ("slug");
  CREATE INDEX "instructors_photo_idx" ON "instructors" USING btree ("photo_id");
  CREATE UNIQUE INDEX "instructors_email_idx" ON "instructors" USING btree ("email");
  CREATE INDEX "instructors_updated_at_idx" ON "instructors" USING btree ("updated_at");
  CREATE INDEX "instructors_created_at_idx" ON "instructors" USING btree ("created_at");
  CREATE UNIQUE INDEX "instructors_locales_locale_parent_id_unique" ON "instructors_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "sessions_session_type_idx" ON "sessions" USING btree ("session_type");
  CREATE INDEX "sessions_class_idx" ON "sessions" USING btree ("class_id");
  CREATE INDEX "sessions_start_date_time_idx" ON "sessions" USING btree ("start_date_time");
  CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");
  CREATE INDEX "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
  CREATE INDEX "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
  CREATE INDEX "bookings_user_idx" ON "bookings" USING btree ("user_id");
  CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");
  CREATE INDEX "bookings_payment_status_idx" ON "bookings" USING btree ("payment_status");
  CREATE INDEX "bookings_expires_at_idx" ON "bookings" USING btree ("expires_at");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX "bookings_rels_order_idx" ON "bookings_rels" USING btree ("order");
  CREATE INDEX "bookings_rels_parent_idx" ON "bookings_rels" USING btree ("parent_id");
  CREATE INDEX "bookings_rels_path_idx" ON "bookings_rels" USING btree ("path");
  CREATE INDEX "bookings_rels_sessions_id_idx" ON "bookings_rels" USING btree ("sessions_id");
  CREATE INDEX "gift_certificates_redemptions_order_idx" ON "gift_certificates_redemptions" USING btree ("_order");
  CREATE INDEX "gift_certificates_redemptions_parent_id_idx" ON "gift_certificates_redemptions" USING btree ("_parent_id");
  CREATE INDEX "gift_certificates_redemptions_booking_idx" ON "gift_certificates_redemptions" USING btree ("booking_id");
  CREATE UNIQUE INDEX "gift_certificates_code_idx" ON "gift_certificates" USING btree ("code");
  CREATE INDEX "gift_certificates_status_idx" ON "gift_certificates" USING btree ("status");
  CREATE INDEX "gift_certificates_expires_at_idx" ON "gift_certificates" USING btree ("expires_at");
  CREATE INDEX "gift_certificates_updated_at_idx" ON "gift_certificates" USING btree ("updated_at");
  CREATE INDEX "gift_certificates_created_at_idx" ON "gift_certificates" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_classes_id_idx" ON "payload_locked_documents_rels" USING btree ("classes_id");
  CREATE INDEX "payload_locked_documents_rels_instructors_id_idx" ON "payload_locked_documents_rels" USING btree ("instructors_id");
  CREATE INDEX "payload_locked_documents_rels_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("sessions_id");
  CREATE INDEX "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX "payload_locked_documents_rels_gift_certificates_id_idx" ON "payload_locked_documents_rels" USING btree ("gift_certificates_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_locales" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "tags_locales" CASCADE;
  DROP TABLE "classes_schedule_days_of_week" CASCADE;
  DROP TABLE "classes" CASCADE;
  DROP TABLE "classes_locales" CASCADE;
  DROP TABLE "classes_rels" CASCADE;
  DROP TABLE "instructors" CASCADE;
  DROP TABLE "instructors_locales" CASCADE;
  DROP TABLE "sessions" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "bookings_rels" CASCADE;
  DROP TABLE "gift_certificates_redemptions" CASCADE;
  DROP TABLE "gift_certificates" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_classes_schedule_days_of_week";
  DROP TYPE "public"."enum_classes_type";
  DROP TYPE "public"."enum_classes_currency";
  DROP TYPE "public"."enum_classes_schedule_recurrence";
  DROP TYPE "public"."enum_sessions_session_type";
  DROP TYPE "public"."enum_sessions_status";
  DROP TYPE "public"."enum_bookings_booking_type";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_bookings_payment_status";
  DROP TYPE "public"."enum_bookings_locale";
  DROP TYPE "public"."enum_gift_certificates_type";
  DROP TYPE "public"."enum_gift_certificates_status";
  DROP TYPE "public"."enum_gift_certificates_currency";
  DROP TYPE "public"."enum_gift_certificates_discount_type";
  DROP TYPE "public"."enum_gift_certificates_locale";`)
}
