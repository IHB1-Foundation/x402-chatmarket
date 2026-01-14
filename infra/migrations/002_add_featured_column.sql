-- Migration: Add featured column to modules table
-- This allows admins to feature modules in the marketplace

ALTER TABLE modules ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_modules_featured ON modules(featured) WHERE featured = TRUE;

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 002: Added featured column to modules table';
END $$;
