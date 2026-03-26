-- ============================================================
-- SCHEMA CLEANUP NOTES
-- Tables identified as low-usage but NOT dropped (data preservation)
-- ============================================================

-- memory_snapshots: Created for AI context caching. Used in account deletion.
-- Currently not actively populated. Keep for future memory summarization feature.
-- COMMENT: COMMENT ON TABLE memory_snapshots IS 'Reserved for future AI memory summarization. Currently empty but referenced in account deletion flow.';

-- photo_reviews: Created for photo moderation queue.
-- Not actively used in current flow. Keep for future admin/moderation panel.
-- COMMENT: COMMENT ON TABLE photo_reviews IS 'Reserved for future photo moderation/review panel. Not actively populated.';

-- Add comments to document table purpose
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_snapshots') THEN
    COMMENT ON TABLE memory_snapshots IS 'Reserved for future AI memory summarization. Referenced in account deletion.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'photo_reviews') THEN
    COMMENT ON TABLE photo_reviews IS 'Reserved for future photo moderation panel. Not actively populated.';
  END IF;
END $$;
