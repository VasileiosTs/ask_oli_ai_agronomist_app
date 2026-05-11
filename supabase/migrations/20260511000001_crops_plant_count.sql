-- Add plant_count to crops so the AI can calculate spray volumes,
-- product quantities, and labour estimates per field.
ALTER TABLE public.crops
  ADD COLUMN IF NOT EXISTS plant_count integer CHECK (plant_count IS NULL OR plant_count > 0);
