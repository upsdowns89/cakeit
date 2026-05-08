-- Add group_id column to shop_gallery_images
-- Photos uploaded together in a single batch share the same group_id
ALTER TABLE public.shop_gallery_images ADD COLUMN IF NOT EXISTS group_id UUID;

-- Index for efficient grouping queries
CREATE INDEX IF NOT EXISTS idx_shop_gallery_group_id
  ON public.shop_gallery_images(group_id)
  WHERE group_id IS NOT NULL;
