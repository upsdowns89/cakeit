-- ============================================
-- EveryCake Database Schema
-- (실제 Supabase 테이블 구조에 맞춤)
-- ============================================

-- 1. profiles 테이블
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. shops 테이블
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

-- 3. orders 테이블
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

-- 4. order_options 테이블
CREATE TABLE IF NOT EXISTS public.order_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  option_name TEXT NOT NULL,
  option_value TEXT NOT NULL
);

-- 5. reviews 테이블
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

-- 6. messages 테이블
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. cake_presets 테이블
CREATE TABLE IF NOT EXISTS public.cake_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- RLS 보안 정책
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- profiles 정책
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- shops 정책
CREATE POLICY "Shops are viewable by everyone" ON public.shops FOR SELECT USING (true);
CREATE POLICY "Sellers can create shops" ON public.shops FOR INSERT WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'seller')
);
CREATE POLICY "Owners can update their shops" ON public.shops FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their shops" ON public.shops FOR DELETE USING (auth.uid() = owner_id);

-- ============================================
-- Realtime 활성화
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
