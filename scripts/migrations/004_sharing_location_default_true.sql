-- Migration: 004_sharing_location_default_true
-- Created: 2026-03-22
-- Description: Change sharing_location default to true and update existing rows

-- 1. Change default for new rows
ALTER TABLE group_members ALTER COLUMN sharing_location SET DEFAULT true;

-- 2. Update existing rows to true
UPDATE group_members SET sharing_location = true WHERE sharing_location = false;
