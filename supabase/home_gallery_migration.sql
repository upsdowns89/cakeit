-- ============================================
-- EveryCake: 홈 갤러리 + 메뉴 계층구조 마이그레이션
-- Supabase SQL Editor에서 실행하세요
--
-- 1. shop_gallery_images 포트폴리오 컬럼
-- 2. shop_menus / shop_menu_sizes 계층구조
-- 3. shop_gallery_images → shop_menus 연결
-- 4. reviews 홈 노출 컬럼
-- ============================================

-- =====================
-- 1. 메뉴 계층구조 테이블
-- =====================

-- shop_menus: 메뉴 (레터링 케이크, 아트드로잉 등)
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

-- shop_menu_sizes: 메뉴 하위 사이즈+가격
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

-- =====================
-- 2. shop_gallery_images 확장
-- =====================

-- 포트폴리오 구분
ALTER TABLE public.shop_gallery_images ADD COLUMN IF NOT EXISTS is_portfolio BOOLEAN DEFAULT FALSE;

-- 포트폴리오 메타데이터
ALTER TABLE public.shop_gallery_images ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.shop_gallery_images ADD COLUMN IF NOT EXISTS design_type TEXT;
ALTER TABLE public.shop_gallery_images ADD COLUMN IF NOT EXISTS cake_size TEXT;
ALTER TABLE public.shop_gallery_images ADD COLUMN IF NOT EXISTS price INTEGER;
ALTER TABLE public.shop_gallery_images ADD COLUMN IF NOT EXISTS made_date DATE;

-- 메뉴 연결 FK
ALTER TABLE public.shop_gallery_images ADD COLUMN IF NOT EXISTS menu_id UUID REFERENCES public.shop_menus(id) ON DELETE SET NULL;

-- =====================
-- 3. reviews 확장
-- =====================
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_photo_review BOOLEAN DEFAULT FALSE;

-- 3. reviews: 관리자 홈 노출 허용 컬럼
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_home_featured BOOLEAN DEFAULT FALSE;

-- =====================
-- 4. 인덱스
-- =====================
CREATE INDEX IF NOT EXISTS idx_shop_gallery_portfolio ON public.shop_gallery_images(is_portfolio) WHERE is_portfolio = TRUE;
CREATE INDEX IF NOT EXISTS idx_reviews_home_featured ON public.reviews(is_home_featured) WHERE is_home_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_shop_gallery_menu ON public.shop_gallery_images(menu_id) WHERE menu_id IS NOT NULL;

-- =====================
-- 5. 데이터 마이그레이션: shop_menu_prices → shop_menus + shop_menu_sizes
-- 기존 design_type별로 shop_menus 생성 후, 각 사이즈+가격을 shop_menu_sizes로 이관
-- =====================
DO $$
DECLARE
  rec RECORD;
  new_menu_id UUID;
  pos INT;
BEGIN
  -- shop_menu_prices에서 고유한 (shop_id, design_type) 조합마다 shop_menus 레코드 생성
  FOR rec IN
    SELECT DISTINCT shop_id, design_type
    FROM public.shop_menu_prices
    ORDER BY shop_id, design_type
  LOOP
    -- 이미 같은 이름의 메뉴가 있으면 스킵
    IF NOT EXISTS (
      SELECT 1 FROM public.shop_menus
      WHERE shop_id = rec.shop_id AND name = rec.design_type
    ) THEN
      -- position 결정
      SELECT COALESCE(MAX(position), -1) + 1 INTO pos
      FROM public.shop_menus
      WHERE shop_id = rec.shop_id;

      INSERT INTO public.shop_menus (shop_id, name, position)
      VALUES (rec.shop_id, rec.design_type, pos)
      RETURNING id INTO new_menu_id;

      -- 해당 design_type의 모든 사이즈+가격을 shop_menu_sizes로 이관
      INSERT INTO public.shop_menu_sizes (menu_id, cake_size, price_min, price_max)
      SELECT new_menu_id, smp.cake_size, smp.price_min, smp.price_max
      FROM public.shop_menu_prices smp
      WHERE smp.shop_id = rec.shop_id
        AND smp.design_type = rec.design_type
      ON CONFLICT (menu_id, cake_size) DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE 'shop_menu_prices → shop_menus + shop_menu_sizes 마이그레이션 완료';
END $$;

-- =====================
-- 6. PostgREST 스키마 캐시 새로고침
-- =====================
NOTIFY pgrst, 'reload schema';

SELECT '홈 갤러리 + 메뉴 계층구조 마이그레이션 완료!' AS result;
