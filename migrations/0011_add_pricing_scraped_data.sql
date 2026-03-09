-- Migration: Add pricing scraped data table and lastScrapedAt column
-- Date: 2026-03-04

-- Add lastScrapedAt column to pricing_devices table
ALTER TABLE "pricing_devices" ADD COLUMN "last_scraped_at" TIMESTAMP;

-- Create pricing_scraped_data table
CREATE TABLE "pricing_scraped_data" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" VARCHAR,
  "device_id" VARCHAR NOT NULL,
  "category_id" TEXT NOT NULL,
  "manufacturer_name" TEXT NOT NULL,
  "model_name" TEXT NOT NULL,
  "storage" INTEGER NOT NULL,
  "raw_id" TEXT,
  "source" TEXT NOT NULL,
  "product_id" TEXT,
  "product_url" TEXT,
  "title" TEXT,
  "price_text" TEXT,
  "extracted_price" DECIMAL,
  "rating" INTEGER,
  "reviews" INTEGER,
  "thumbnail" TEXT,
  "from_cache" BOOLEAN DEFAULT false,
  "scraped_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX "idx_pricing_scraped_data_device_id" ON "pricing_scraped_data"("device_id");
CREATE INDEX "idx_pricing_scraped_data_scraped_at" ON "pricing_scraped_data"("scraped_at");
CREATE INDEX "idx_pricing_devices_last_scraped_at" ON "pricing_devices"("last_scraped_at");
