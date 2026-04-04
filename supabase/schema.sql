-- =============================================================
-- Nail Salon App — Supabase Database Schema
-- Run this in Supabase → SQL Editor
--
-- Usage:
-- 1) New/empty database: run this whole file.
-- 2) Existing database: DO NOT run the whole file. Run only the
--    migration block at the bottom.
-- =============================================================

-- -------------------------------------------------------
-- TABLE: packages
-- Stores the package types (e.g. "Manicure 5x Package")
-- -------------------------------------------------------
CREATE TABLE packages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code INTEGER GENERATED ALWAYS AS IDENTITY UNIQUE,  -- display ID (001, 002, ...)
  name         TEXT NOT NULL,                        -- e.g. "Manicure 5x Package"
  total_uses   INTEGER NOT NULL,                     -- total sessions included (e.g. 5)
  price        NUMERIC(10, 2) NOT NULL,              -- price of the package
  description  TEXT,                                 -- optional description
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,        -- can be deactivated without deleting
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- TABLE: customers
-- Stores customer information (registered once)
-- -------------------------------------------------------
CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code  TEXT NOT NULL UNIQUE,                     -- random 8-digit ID, immutable
  name           TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  birthday       DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- TABLE: customer_packages
-- Records each time a customer buys a package.
-- This is what gets shared via the package ID.
-- -------------------------------------------------------
CREATE TABLE customer_packages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- This IS the shareable Package ID
  customer_id      UUID NOT NULL REFERENCES customers(id),
  package_id       UUID NOT NULL REFERENCES packages(id),
  remaining_uses   INTEGER NOT NULL,                             -- starts equal to packages.total_uses
  purchased_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date      DATE,                                          -- package expiry date
  notes            TEXT                                          -- any extra notes
);

-- -------------------------------------------------------
-- TABLE: package_usage_logs
-- Records each time a session is used/deducted.
-- Provides a full audit trail.
-- -------------------------------------------------------
CREATE TABLE package_usage_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_package_id  UUID NOT NULL REFERENCES customer_packages(id),
  used_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                TEXT                                       -- e.g. "Used by friend Sarah"
);

-- -------------------------------------------------------
-- TABLE: archived_packages
-- Stores deleted package types for audit/history
-- -------------------------------------------------------
CREATE TABLE archived_packages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_package_id UUID NOT NULL,
  package_code        INTEGER,
  name                TEXT NOT NULL,
  total_uses          INTEGER NOT NULL,
  price               NUMERIC(10, 2) NOT NULL,
  description         TEXT,
  was_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- TABLE: archived_customers
-- Stores deleted customers for audit/history
-- -------------------------------------------------------
CREATE TABLE archived_customers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_customer_id UUID NOT NULL,
  customer_code        TEXT,
  name                 TEXT NOT NULL,
  contact_number       TEXT NOT NULL,
  birthday             DATE,
  created_at           TIMESTAMPTZ,
  deleted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- TABLE: archived_customer_packages
-- Stores deleted purchased packages for audit/history
-- -------------------------------------------------------
CREATE TABLE archived_customer_packages (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_customer_package_id UUID NOT NULL,
  customer_id                  UUID,
  customer_code                TEXT,
  customer_name                TEXT NOT NULL,
  contact_number               TEXT NOT NULL,
  package_id                   UUID,
  package_code                 INTEGER,
  package_name                 TEXT NOT NULL,
  total_uses                   INTEGER NOT NULL,
  remaining_uses               INTEGER NOT NULL,
  purchased_at                 TIMESTAMPTZ,
  expiry_date                  DATE,
  notes                        TEXT,
  usage_logs                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- TABLE: appointments
-- Stores customer appointments on the calendar.
-- -------------------------------------------------------
CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name    TEXT NOT NULL,
  contact_number   TEXT,
  service          TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  notes            TEXT,
  num_persons      INTEGER NOT NULL DEFAULT 1,
  has_package      BOOLEAN NOT NULL DEFAULT FALSE,
  status           TEXT NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed', 'completed', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- INDEXES for faster lookups
-- -------------------------------------------------------
CREATE INDEX idx_customers_contact ON customers(contact_number);
CREATE INDEX idx_customer_packages_customer ON customer_packages(customer_id);
CREATE INDEX idx_usage_logs_customer_package ON package_usage_logs(customer_package_id);
CREATE INDEX idx_archived_packages_deleted_at ON archived_packages(deleted_at);
CREATE INDEX idx_archived_customers_deleted_at ON archived_customers(deleted_at);
CREATE INDEX idx_archived_customer_packages_customer ON archived_customer_packages(customer_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);

-- -------------------------------------------------------
-- EXISTING DATABASE MIGRATION
-- Copy this block into SQL Editor and run it.
-- Do not run the full file on existing databases.
-- -------------------------------------------------------
-- -- Step 1: Add package_code to packages (if not done already)
-- ALTER TABLE packages
-- ADD COLUMN IF NOT EXISTS package_code INTEGER;
--
-- CREATE SEQUENCE IF NOT EXISTS packages_package_code_seq;
-- ALTER SEQUENCE packages_package_code_seq OWNED BY packages.package_code;
--
-- ALTER TABLE packages
-- ALTER COLUMN package_code SET DEFAULT nextval('packages_package_code_seq'::regclass);
--
-- WITH numbered AS (
--   SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
--   FROM packages
-- )
-- UPDATE packages p
-- SET package_code = n.rn
-- FROM numbered n
-- WHERE p.id = n.id
--   AND p.package_code IS NULL;
--
-- SELECT setval(
--   'packages_package_code_seq',
--   GREATEST((SELECT COALESCE(MAX(package_code), 0) FROM packages), 1),
--   true
-- );
--
-- ALTER TABLE packages
-- ALTER COLUMN package_code SET NOT NULL;
--
-- CREATE UNIQUE INDEX IF NOT EXISTS packages_package_code_unique_idx
-- ON packages(package_code);
--
-- -- Step 2: Create customers table
-- CREATE TABLE IF NOT EXISTS customers (
--   id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   customer_code  TEXT NOT NULL UNIQUE,
--   name           TEXT NOT NULL,
--   contact_number TEXT NOT NULL,
--   birthday       DATE,
--   created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_customers_contact ON customers(contact_number);
--
-- -- Step 2b: Add customer_code for existing customers
-- ALTER TABLE customers
-- ADD COLUMN IF NOT EXISTS customer_code TEXT;
--
-- UPDATE customers
-- SET customer_code = LPAD(FLOOR(RANDOM() * 90000000 + 10000000)::TEXT, 8, '0')
-- WHERE customer_code IS NULL;
--
-- ALTER TABLE customers
-- ALTER COLUMN customer_code SET NOT NULL;
--
-- CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_code_unique_idx
-- ON customers(customer_code);
--
-- -- Step 3: Migrate existing customer data from customer_packages to customers
-- INSERT INTO customers (name, contact_number, birthday, created_at)
-- SELECT DISTINCT ON (customer_name, contact_number)
--   customer_name,
--   contact_number,
--   birthday,
--   MIN(purchased_at) OVER (PARTITION BY customer_name, contact_number)
-- FROM customer_packages
-- WHERE customer_name IS NOT NULL
-- ON CONFLICT DO NOTHING;
--
-- -- Step 4: Add customer_id column to customer_packages
-- ALTER TABLE customer_packages
-- ADD COLUMN IF NOT EXISTS customer_id UUID;
--
-- -- Step 5: Link existing customer_packages to customers
-- UPDATE customer_packages cp
-- SET customer_id = c.id
-- FROM customers c
-- WHERE cp.customer_name = c.name
--   AND cp.contact_number = c.contact_number
--   AND cp.customer_id IS NULL;
--
-- -- Step 6: Make customer_id NOT NULL and add foreign key
-- ALTER TABLE customer_packages
-- ALTER COLUMN customer_id SET NOT NULL;
--
-- ALTER TABLE customer_packages
-- ADD CONSTRAINT fk_customer_packages_customer
-- FOREIGN KEY (customer_id) REFERENCES customers(id);
--
-- CREATE INDEX IF NOT EXISTS idx_customer_packages_customer ON customer_packages(customer_id);
--
-- -- Step 7: Remove old customer fields from customer_packages
-- ALTER TABLE customer_packages
-- DROP COLUMN IF EXISTS customer_name,
-- DROP COLUMN IF EXISTS contact_number,
-- DROP COLUMN IF EXISTS birthday;
--
-- -- Step 8: Add expiry_date if not exists
-- ALTER TABLE customer_packages
-- ADD COLUMN IF NOT EXISTS expiry_date DATE;
--
-- -- Step 9: Create archive tables (if not exists)
-- CREATE TABLE IF NOT EXISTS archived_packages (
--   id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   original_package_id UUID NOT NULL,
--   package_code        INTEGER,
--   name                TEXT NOT NULL,
--   total_uses          INTEGER NOT NULL,
--   price               NUMERIC(10, 2) NOT NULL,
--   description         TEXT,
--   was_active          BOOLEAN NOT NULL DEFAULT TRUE,
--   created_at          TIMESTAMPTZ,
--   deleted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- CREATE TABLE IF NOT EXISTS archived_customers (
--   id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   original_customer_id UUID NOT NULL,
--   customer_code        TEXT,
--   name                 TEXT NOT NULL,
--   contact_number       TEXT NOT NULL,
--   birthday             DATE,
--   created_at           TIMESTAMPTZ,
--   deleted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- CREATE TABLE IF NOT EXISTS archived_customer_packages (
--   id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   original_customer_package_id UUID NOT NULL,
--   customer_id                  UUID,
--   customer_code                TEXT,
--   customer_name                TEXT NOT NULL,
--   contact_number               TEXT NOT NULL,
--   package_id                   UUID,
--   package_code                 INTEGER,
--   package_name                 TEXT NOT NULL,
--   total_uses                   INTEGER NOT NULL,
--   remaining_uses               INTEGER NOT NULL,
--   purchased_at                 TIMESTAMPTZ,
--   expiry_date                  DATE,
--   notes                        TEXT,
--   usage_logs                   JSONB NOT NULL DEFAULT '[]'::jsonb,
--   deleted_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- ALTER TABLE archived_customer_packages
-- ADD COLUMN IF NOT EXISTS usage_logs JSONB NOT NULL DEFAULT '[]'::jsonb;
--
-- CREATE INDEX IF NOT EXISTS idx_archived_packages_deleted_at ON archived_packages(deleted_at);
-- CREATE INDEX IF NOT EXISTS idx_archived_customers_deleted_at ON archived_customers(deleted_at);
-- CREATE INDEX IF NOT EXISTS idx_archived_customer_packages_customer ON archived_customer_packages(customer_id);

-- -------------------------------------------------------
-- MIGRATION: Multi-item packages
-- Copy this block into Supabase SQL Editor and run it.
-- -------------------------------------------------------
-- -- Step 1: Add package_items table
-- CREATE TABLE IF NOT EXISTS package_items (
--   id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   package_id   UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
--   service_name TEXT NOT NULL,
--   total_uses   INTEGER NOT NULL DEFAULT 1,
--   sort_order   INTEGER NOT NULL DEFAULT 0
-- );
-- CREATE INDEX IF NOT EXISTS idx_package_items_package ON package_items(package_id);
--
-- -- Step 2: Add customer_package_items table
-- CREATE TABLE IF NOT EXISTS customer_package_items (
--   id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   customer_package_id UUID NOT NULL REFERENCES customer_packages(id) ON DELETE CASCADE,
--   service_name        TEXT NOT NULL,
--   total_uses          INTEGER NOT NULL,
--   remaining_uses      INTEGER NOT NULL,
--   sort_order          INTEGER NOT NULL DEFAULT 0
-- );
-- CREATE INDEX IF NOT EXISTS idx_customer_package_items_cp ON customer_package_items(customer_package_id);
--
-- -- Step 3: Alter package_usage_logs to track per-item deductions
-- ALTER TABLE package_usage_logs
--   ADD COLUMN IF NOT EXISTS customer_package_item_id UUID REFERENCES customer_package_items(id) ON DELETE SET NULL,
--   ADD COLUMN IF NOT EXISTS service_name TEXT;
--
-- -- Step 4: Add items snapshot columns to archive tables
-- ALTER TABLE archived_packages
--   ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
-- ALTER TABLE archived_customer_packages
--   ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- -------------------------------------------------------
-- MIGRATION: Credit-type packages
-- Copy this block into Supabase SQL Editor and run it.
-- -------------------------------------------------------
-- -- Step 1: Add package_type and total_credits to packages
-- ALTER TABLE packages
--   ADD COLUMN IF NOT EXISTS package_type TEXT NOT NULL DEFAULT 'services'
--     CHECK (package_type IN ('services', 'credit')),
--   ADD COLUMN IF NOT EXISTS total_credits NUMERIC(10,2);
--
-- -- Step 2: Add remaining_credits to customer_packages
-- ALTER TABLE customer_packages
--   ADD COLUMN IF NOT EXISTS remaining_credits NUMERIC(10,2);
--
-- -- Step 3: Add credits_used to package_usage_logs
-- ALTER TABLE package_usage_logs
--   ADD COLUMN IF NOT EXISTS credits_used NUMERIC(10,2);
--
-- -- Step 4: Add credit fields to archive tables
-- ALTER TABLE archived_packages
--   ADD COLUMN IF NOT EXISTS package_type TEXT NOT NULL DEFAULT 'services',
--   ADD COLUMN IF NOT EXISTS total_credits NUMERIC(10,2);
-- ALTER TABLE archived_customer_packages
--   ADD COLUMN IF NOT EXISTS package_type TEXT NOT NULL DEFAULT 'services',
--   ADD COLUMN IF NOT EXISTS total_credits NUMERIC(10,2),
--   ADD COLUMN IF NOT EXISTS remaining_credits NUMERIC(10,2);

-- -------------------------------------------------------
-- MIGRATION: Cash top-up for credit packages
-- Copy this block into Supabase SQL Editor and run it.
-- -------------------------------------------------------
-- ALTER TABLE package_usage_logs
--   ADD COLUMN IF NOT EXISTS cash_topup NUMERIC(10,2);

-- -------------------------------------------------------
-- MIGRATION: Service categories and services
-- Copy this block into Supabase SQL Editor and run it.
-- -------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS service_categories (
--   id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name       TEXT NOT NULL,
--   sort_order INTEGER NOT NULL DEFAULT 0,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- CREATE TABLE IF NOT EXISTS services (
--   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
--   name        TEXT NOT NULL,
--   price       NUMERIC(10,2),
--   sort_order  INTEGER NOT NULL DEFAULT 0,
--   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
--
-- -- Step N: Create sales_transactions table
-- CREATE TABLE IF NOT EXISTS sales_transactions (
--   id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   receipt_no     TEXT NOT NULL,
--   transacted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   payment_type   TEXT NOT NULL,
--   total          NUMERIC(10, 2) NOT NULL,
--   cash_received  NUMERIC(10, 2),
--   change_given   NUMERIC(10, 2),
--   customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
--   customer_name  TEXT,
--   customer_phone TEXT,
--   items          JSONB NOT NULL DEFAULT '[]'::jsonb,
--   is_voided      BOOLEAN NOT NULL DEFAULT FALSE
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(transacted_at);
--
-- -- Step N+1: Add is_voided column (run if table already exists)
-- ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT FALSE;
--
-- -- Step N+2: Create archived_transactions table
-- CREATE TABLE IF NOT EXISTS archived_transactions (
--   id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   receipt_no     TEXT NOT NULL,
--   transacted_at  TIMESTAMPTZ NOT NULL,
--   payment_type   TEXT NOT NULL,
--   total          NUMERIC(10, 2) NOT NULL,
--   cash_received  NUMERIC(10, 2),
--   change_given   NUMERIC(10, 2),
--   customer_name  TEXT,
--   customer_phone TEXT,
--   items          JSONB NOT NULL DEFAULT '[]'::jsonb,
--   is_voided      BOOLEAN NOT NULL DEFAULT FALSE,
--   deleted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
