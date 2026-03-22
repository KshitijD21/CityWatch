-- Migration: 005_add_image_url_to_community_reports
-- Created: 2026-03-22
-- Description: Add optional image_url column to community_reports

ALTER TABLE community_reports ADD COLUMN image_url TEXT;
