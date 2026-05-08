-- Add is_primary column to shop_gallery_images
ALTER TABLE shop_gallery_images ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;

-- Set the first uploaded image as primary for existing shops (if none is set)
WITH first_images AS (
  SELECT DISTINCT ON (shop_id) id
  FROM shop_gallery_images
  ORDER BY shop_id, created_at ASC
)
UPDATE shop_gallery_images
SET is_primary = true
WHERE id IN (SELECT id FROM first_images)
AND NOT EXISTS (
  SELECT 1 FROM shop_gallery_images g2
  WHERE g2.shop_id = shop_gallery_images.shop_id AND g2.is_primary = true
);
