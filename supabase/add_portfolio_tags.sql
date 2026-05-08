-- Add cake_type and occasion tag columns to shop_gallery_images
ALTER TABLE shop_gallery_images ADD COLUMN IF NOT EXISTS cake_type text;
ALTER TABLE shop_gallery_images ADD COLUMN IF NOT EXISTS occasion text;
