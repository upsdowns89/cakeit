-- Add cake_types and custom_type columns to shop_menus
-- cake_types: array of cake type tags (multi-select)
-- custom_type: single custom type value

ALTER TABLE shop_menus ADD COLUMN IF NOT EXISTS cake_types text[] DEFAULT NULL;
ALTER TABLE shop_menus ADD COLUMN IF NOT EXISTS custom_type text DEFAULT NULL;

-- shops.cake_types already exists as text[] — used for aggregated cake types from all menus
-- No change needed for shops table

-- Add custom_type to shop_gallery_images (inherited from menu on portfolio upload)
ALTER TABLE shop_gallery_images ADD COLUMN IF NOT EXISTS custom_type text DEFAULT NULL;
