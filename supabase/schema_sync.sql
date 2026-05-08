-- ============================================
-- EveryCake: 전체 스키마 동기화
-- Supabase SQL Editor에서 실행하세요
--
-- 이 파일은 코드(src/lib/types.ts)가 기대하는
-- 모든 테이블/컬럼/RLS를 보장합니다.
-- 모든 문장에 IF NOT EXISTS / IF EXISTS 가드가 있어
-- 몇 번이든 안전하게 재실행 가능합니다.
-- ============================================

-- ============================================
-- 0. ENUM 타입
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
  ELSE
    BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'pending','accepted','payment_waiting','confirmed',
      'making','pickup_ready','completed','cancelled'
    );
  ELSE
    BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'accepted'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_waiting'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'making'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pickup_ready'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- ============================================
-- 1. 핵심 테이블
-- ============================================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'buyer',
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- shops (기본)
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  business_hours JSONB,
  lat NUMERIC,
  lng NUMERIC,
  image_url TEXT,
  min_order_price INT4,
  is_pickup BOOLEAN DEFAULT TRUE NOT NULL,
  is_delivery BOOLEAN DEFAULT FALSE NOT NULL,
  area TEXT,
  region TEXT,
  district TEXT,
  delivery_fee INT4,
  cake_types TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- shops 확장 컬럼 (shop_detail_migration)
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS naver_map_url TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS pickup_info JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS external_review_links JSONB DEFAULT '{}'::jsonb;

-- orders (기본)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
  shop_id UUID REFERENCES public.shops(id) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  pickup_date TIMESTAMPTZ,
  design_img_url TEXT,
  total_price INT4,
  request_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- orders 확장 (seller_admin_migration)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cake_size TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cake_flavor TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cream_type TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lettering_text TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_note TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS original_price INT4;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- order_options
CREATE TABLE IF NOT EXISTS public.order_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  option_name TEXT NOT NULL,
  option_value TEXT NOT NULL
);

-- reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
  shop_id UUID REFERENCES public.shops(id) NOT NULL,
  rating INT4 NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- cake_presets
CREATE TABLE IF NOT EXISTS public.cake_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- slots
CREATE TABLE IF NOT EXISTS public.slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  capacity INT4 NOT NULL DEFAULT 5,
  booked_count INT4 NOT NULL DEFAULT 0,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(shop_id, date)
);

-- ============================================
-- 2. 가게 상세 확장 테이블
-- ============================================

-- shop_gallery_images
CREATE TABLE IF NOT EXISTS public.shop_gallery_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  alt_text TEXT,
  position INT4 NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_gallery_images_shop_id ON public.shop_gallery_images(shop_id);

-- shop_notices
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
CREATE INDEX IF NOT EXISTS idx_shop_notices_shop_id ON public.shop_notices(shop_id);

-- shop_menu_prices (legacy, kept for compatibility)
CREATE TABLE IF NOT EXISTS public.shop_menu_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  cake_size TEXT NOT NULL,
  design_type TEXT NOT NULL,
  price_min INT4 NOT NULL,
  price_max INT4,
  description TEXT,
  position INT4 NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(shop_id, cake_size, design_type)
);
CREATE INDEX IF NOT EXISTS idx_shop_menu_prices_shop_id ON public.shop_menu_prices(shop_id);

-- shop_menus (hierarchical: menu → sizes)
CREATE TABLE IF NOT EXISTS public.shop_menus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price INT4,
  position INT4 DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_menus_shop_id ON public.shop_menus(shop_id);

-- shop_menu_sizes (sizes + prices under a menu)
CREATE TABLE IF NOT EXISTS public.shop_menu_sizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id UUID REFERENCES public.shop_menus(id) ON DELETE CASCADE NOT NULL,
  cake_size TEXT NOT NULL,
  price_min INT4 NOT NULL,
  price_max INT4,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(menu_id, cake_size)
);
CREATE INDEX IF NOT EXISTS idx_shop_menu_sizes_menu_id ON public.shop_menu_sizes(menu_id);

-- bookmarks
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
-- 3. 트리거 함수 & 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_notices_updated_at ON public.shop_notices;
CREATE TRIGGER update_shop_notices_updated_at
  BEFORE UPDATE ON public.shop_notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. RLS 정책 (DROP IF EXISTS → CREATE)
-- ============================================

-- ─── profiles ───
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ─── shops ───
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shops are viewable by everyone" ON public.shops;
CREATE POLICY "Shops are viewable by everyone" ON public.shops FOR SELECT USING (true);
DROP POLICY IF EXISTS "Sellers can create shops" ON public.shops;
CREATE POLICY "Sellers can create shops" ON public.shops FOR INSERT WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'seller')
);
DROP POLICY IF EXISTS "Owners can update their shops" ON public.shops;
CREATE POLICY "Owners can update their shops" ON public.shops FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Owners can delete their shops" ON public.shops;
CREATE POLICY "Owners can delete their shops" ON public.shops FOR DELETE USING (auth.uid() = owner_id);

-- ─── orders ───
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
CREATE POLICY "Buyers can view own orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Sellers can view shop orders" ON public.orders;
CREATE POLICY "Sellers can view shop orders" ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = orders.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Sellers can update shop orders" ON public.orders;
CREATE POLICY "Sellers can update shop orders" ON public.orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = orders.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
CREATE POLICY "Buyers can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- ─── slots ───
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Slots are viewable by everyone" ON public.slots;
CREATE POLICY "Slots are viewable by everyone" ON public.slots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Sellers can manage own shop slots" ON public.slots;
CREATE POLICY "Sellers can manage own shop slots" ON public.slots FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = slots.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Sellers can update own shop slots" ON public.slots;
CREATE POLICY "Sellers can update own shop slots" ON public.slots FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = slots.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Sellers can delete own shop slots" ON public.slots;
CREATE POLICY "Sellers can delete own shop slots" ON public.slots FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = slots.shop_id AND shops.owner_id = auth.uid())
);

-- ─── messages ───
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (
  auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.shops ON shops.id = orders.shop_id
    WHERE orders.id = messages.order_id
    AND (orders.buyer_id = auth.uid() OR shops.owner_id = auth.uid())
  )
);
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ─── shop_gallery_images ───
ALTER TABLE public.shop_gallery_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gallery images viewable by everyone" ON public.shop_gallery_images;
CREATE POLICY "Gallery images viewable by everyone" ON public.shop_gallery_images FOR SELECT USING (true);
DROP POLICY IF EXISTS "Sellers can manage own gallery images" ON public.shop_gallery_images;
CREATE POLICY "Sellers can manage own gallery images" ON public.shop_gallery_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_gallery_images.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Sellers can update own gallery images" ON public.shop_gallery_images;
CREATE POLICY "Sellers can update own gallery images" ON public.shop_gallery_images FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_gallery_images.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Sellers can delete own gallery images" ON public.shop_gallery_images;
CREATE POLICY "Sellers can delete own gallery images" ON public.shop_gallery_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_gallery_images.shop_id AND shops.owner_id = auth.uid())
);

-- ─── shop_notices ───
ALTER TABLE public.shop_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notices viewable by everyone" ON public.shop_notices;
CREATE POLICY "Notices viewable by everyone" ON public.shop_notices FOR SELECT USING (true);
DROP POLICY IF EXISTS "Sellers can manage own notices" ON public.shop_notices;
CREATE POLICY "Sellers can manage own notices" ON public.shop_notices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_notices.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Sellers can update own notices" ON public.shop_notices;
CREATE POLICY "Sellers can update own notices" ON public.shop_notices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_notices.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Sellers can delete own notices" ON public.shop_notices;
CREATE POLICY "Sellers can delete own notices" ON public.shop_notices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_notices.shop_id AND shops.owner_id = auth.uid())
);

-- ─── shop_menu_prices ───
ALTER TABLE public.shop_menu_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Menu prices viewable by everyone" ON public.shop_menu_prices;
CREATE POLICY "Menu prices viewable by everyone" ON public.shop_menu_prices FOR SELECT USING (true);
DROP POLICY IF EXISTS "Sellers can manage own menu prices" ON public.shop_menu_prices;
CREATE POLICY "Sellers can manage own menu prices" ON public.shop_menu_prices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_menu_prices.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Sellers can update own menu prices" ON public.shop_menu_prices;
CREATE POLICY "Sellers can update own menu prices" ON public.shop_menu_prices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_menu_prices.shop_id AND shops.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Sellers can delete own menu prices" ON public.shop_menu_prices;
CREATE POLICY "Sellers can delete own menu prices" ON public.shop_menu_prices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_menu_prices.shop_id AND shops.owner_id = auth.uid())
);

-- ─── bookmarks ───
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create bookmarks" ON public.bookmarks;
CREATE POLICY "Users can create bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 5. Storage 버킷
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Anyone can view shop images" ON storage.objects;
CREATE POLICY "Anyone can view shop images" ON storage.objects FOR SELECT USING (bucket_id = 'shop-images');

DROP POLICY IF EXISTS "Sellers can upload shop images" ON storage.objects;
CREATE POLICY "Sellers can upload shop images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'shop-images' AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Sellers can update own shop images" ON storage.objects;
CREATE POLICY "Sellers can update own shop images" ON storage.objects FOR UPDATE USING (
  bucket_id = 'shop-images' AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Sellers can delete own shop images" ON storage.objects;
CREATE POLICY "Sellers can delete own shop images" ON storage.objects FOR DELETE USING (
  bucket_id = 'shop-images' AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 6. Realtime
-- ============================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.slots;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================
-- 7. PostgREST 스키마 캐시 새로고침
-- ============================================
NOTIFY pgrst, 'reload schema';

SELECT '스키마 동기화 완료!' AS result;
