-- ============================================
-- EveryCake: Shop Detail 확장 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- ============================================
-- 1. shops 테이블에 새 컬럼 추가
-- ============================================
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS naver_map_url TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS pickup_info JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS external_review_links JSONB DEFAULT '{}'::jsonb;

-- ============================================
-- 2. shop_gallery_images (가게 대표 썸네일 N개)
-- ============================================
CREATE TABLE IF NOT EXISTS public.shop_gallery_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  alt_text TEXT,
  position INT4 NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shop_gallery_images_shop_id 
  ON public.shop_gallery_images(shop_id);

-- ============================================
-- 3. shop_notices (셀러 공지 포스팅)
-- ============================================
CREATE TABLE IF NOT EXISTS public.shop_notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shop_notices_shop_id 
  ON public.shop_notices(shop_id);

-- ============================================
-- 4. shop_menu_prices (호수별 × 디자인타입별 가격)
-- ============================================
CREATE TABLE IF NOT EXISTS public.shop_menu_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  cake_size TEXT NOT NULL,         -- '도시락', '미니', '1호', '2호', '3호'
  design_type TEXT NOT NULL,       -- '레터링', '아트드로잉', '3D', '특수제작'
  price_min INT4 NOT NULL,         -- 최소 가격
  price_max INT4,                  -- 최대 가격 (nullable = 단일 가격)
  description TEXT,                -- 부가 설명
  position INT4 NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- 같은 가게+같은 호수+같은 디자인 중복 방지
  UNIQUE(shop_id, cake_size, design_type)
);

CREATE INDEX IF NOT EXISTS idx_shop_menu_prices_shop_id 
  ON public.shop_menu_prices(shop_id);

-- ============================================
-- 5. bookmarks (사용자 북마크)
-- ============================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_shop_id ON public.bookmarks(shop_id);

-- ============================================
-- 6. RLS 정책
-- ============================================

-- 6-1. shop_gallery_images
ALTER TABLE public.shop_gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gallery images viewable by everyone" ON public.shop_gallery_images
  FOR SELECT USING (true);

CREATE POLICY "Sellers can manage own gallery images" ON public.shop_gallery_images
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_gallery_images.shop_id AND shops.owner_id = auth.uid())
  );

CREATE POLICY "Sellers can update own gallery images" ON public.shop_gallery_images
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_gallery_images.shop_id AND shops.owner_id = auth.uid())
  );

CREATE POLICY "Sellers can delete own gallery images" ON public.shop_gallery_images
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_gallery_images.shop_id AND shops.owner_id = auth.uid())
  );

-- 6-2. shop_notices
ALTER TABLE public.shop_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notices viewable by everyone" ON public.shop_notices
  FOR SELECT USING (true);

CREATE POLICY "Sellers can manage own notices" ON public.shop_notices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_notices.shop_id AND shops.owner_id = auth.uid())
  );

CREATE POLICY "Sellers can update own notices" ON public.shop_notices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_notices.shop_id AND shops.owner_id = auth.uid())
  );

CREATE POLICY "Sellers can delete own notices" ON public.shop_notices
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_notices.shop_id AND shops.owner_id = auth.uid())
  );

-- 6-3. shop_menu_prices
ALTER TABLE public.shop_menu_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu prices viewable by everyone" ON public.shop_menu_prices
  FOR SELECT USING (true);

CREATE POLICY "Sellers can manage own menu prices" ON public.shop_menu_prices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_menu_prices.shop_id AND shops.owner_id = auth.uid())
  );

CREATE POLICY "Sellers can update own menu prices" ON public.shop_menu_prices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_menu_prices.shop_id AND shops.owner_id = auth.uid())
  );

CREATE POLICY "Sellers can delete own menu prices" ON public.shop_menu_prices
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_menu_prices.shop_id AND shops.owner_id = auth.uid())
  );

-- 6-4. bookmarks
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookmarks" ON public.bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. updated_at 트리거 (shop_notices)
-- ============================================
DROP TRIGGER IF EXISTS update_shop_notices_updated_at ON public.shop_notices;
CREATE TRIGGER update_shop_notices_updated_at
  BEFORE UPDATE ON public.shop_notices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
