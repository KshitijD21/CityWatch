-- Migration: 002_update_community_reports_and_add_rpc
-- Created: 2026-03-22
-- Description: Update community_reports category constraint and add get_nearby_reports RPC

-- 1. Update community_reports category CHECK constraint (single DO block to avoid split issues)
DO $do$
BEGIN
  ALTER TABLE community_reports DROP CONSTRAINT IF EXISTS community_reports_category_check;
  ALTER TABLE community_reports ADD CONSTRAINT community_reports_category_check
    CHECK (category IN ('theft', 'assault', 'vandalism', 'harassment', 'vehicle_breakin', 'disturbance', 'infrastructure', 'other'));
END
$do$
