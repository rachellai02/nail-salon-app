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
-- TABLE: customer_packages
-- Records each time a customer buys a package.
-- This is what gets shared via the package ID.
-- -------------------------------------------------------
CREATE TABLE customer_packages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- This IS the shareable Package ID
  package_id       UUID NOT NULL REFERENCES packages(id),
  customer_name    TEXT NOT NULL,
  contact_number   TEXT NOT NULL,
  remaining_uses   INTEGER NOT NULL,                             -- starts equal to packages.total_uses
  purchased_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
-- INDEXES for faster lookups
-- -------------------------------------------------------
CREATE INDEX idx_customer_packages_contact ON customer_packages(contact_number);
CREATE INDEX idx_usage_logs_customer_package ON package_usage_logs(customer_package_id);

-- -------------------------------------------------------
-- EXISTING DATABASE MIGRATION (packages table already exists)
-- Copy this block into SQL Editor and run it.
-- Do not run the full file on existing databases.
-- -------------------------------------------------------
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
