-- ─────────────────────────────────────────────────────────────────────────────
-- VIO location context — Phase 2 training data enrichment
--
-- Snapshots the farmer's lat/lon at the moment an intervention is logged.
-- Combined with outcome data, this lets us:
--   1. Train a geospatially-aware model (disease X is common in this climate)
--   2. Export training data filtered by climate zone, season, and location
--   3. Power "works for N growers in your region" collective intelligence
--
-- We store lat/lon directly rather than just climate_zone text because:
--   - Precise coordinates allow post-hoc climate zone labeling
--   - We may add spatial indexing later for regional queries
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lon DOUBLE PRECISION;

-- Partial index: only rows that have location data (most won't initially)
CREATE INDEX IF NOT EXISTS idx_interventions_location
  ON interventions (location_lat, location_lon)
  WHERE location_lat IS NOT NULL AND location_lon IS NOT NULL;

COMMENT ON COLUMN interventions.location_lat IS
  'Farmer GPS latitude at time of intervention log. Snapshotted from users.location_lat. Used for Phase 2 geospatial training data and regional collective intelligence.';

COMMENT ON COLUMN interventions.location_lon IS
  'Farmer GPS longitude at time of intervention log. Snapshotted from users.location_lon. Used for Phase 2 geospatial training data and regional collective intelligence.';
