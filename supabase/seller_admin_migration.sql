-- ============================================
-- EveryCake: Seller Admin 확장 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- ============================================
-- 1. order_status ENUM 재정의
--    기존 ENUM에 새 값을 추가합니다.
--    (이미 존재하는 값은 무시됩니다)
-- ============================================
DO $$ BEGIN
  -- 기존 enum이 없을 경우 생성
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'pending',
      'accepted',
      'payment_waiting',
      'confirmed',
      'making',
      'pickup_ready',
      'completed',
      'cancelled'
    );
  ELSE
    -- 기존 enum에 새 값 추가 (이미 있으면 무시)
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
-- 2. orders 테이블 확장 컬럼 추가
-- ============================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cake_size TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cake_flavor TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cream_type TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lettering_text TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_note TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS original_price INT4;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 3. slots 테이블 (스케줄/예약 슬롯 관리)
-- ============================================
CREATE TABLE IF NOT EXISTS public.slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  capacity INT4 NOT NULL DEFAULT 5,
  booked_count INT4 NOT NULL DEFAULT 0,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- 같은 가게+같은 날짜에 중복 슬롯 방지
  UNIQUE(shop_id, date)
);

-- ============================================
-- 4. RLS 정책
-- ============================================

-- 4-1. orders RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Buyer는 자신의 주문만 조회
CREATE POLICY "Buyers can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = buyer_id);

-- Seller는 자신의 shop에 속한 주문 조회
CREATE POLICY "Sellers can view shop orders" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shops 
      WHERE shops.id = orders.shop_id 
      AND shops.owner_id = auth.uid()
    )
  );

-- Seller는 자신의 shop에 속한 주문 수정 가능
CREATE POLICY "Sellers can update shop orders" ON public.orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.shops 
      WHERE shops.id = orders.shop_id 
      AND shops.owner_id = auth.uid()
    )
  );

-- Buyer는 주문 생성 가능
CREATE POLICY "Buyers can create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- 4-2. slots RLS
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

-- 누구나 슬롯 조회 가능 (예약 가능 여부 확인용)
CREATE POLICY "Slots are viewable by everyone" ON public.slots
  FOR SELECT USING (true);

-- Seller는 자신의 shop 슬롯만 생성/수정/삭제
CREATE POLICY "Sellers can manage own shop slots" ON public.slots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops 
      WHERE shops.id = slots.shop_id 
      AND shops.owner_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update own shop slots" ON public.slots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.shops 
      WHERE shops.id = slots.shop_id 
      AND shops.owner_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete own shop slots" ON public.slots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.shops 
      WHERE shops.id = slots.shop_id 
      AND shops.owner_id = auth.uid()
    )
  );

-- 4-3. messages RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 메시지 발신자 또는 해당 주문의 가게 주인만 조회 가능
CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM public.orders
      JOIN public.shops ON shops.id = orders.shop_id
      WHERE orders.id = messages.order_id
      AND (orders.buyer_id = auth.uid() OR shops.owner_id = auth.uid())
    )
  );

-- 메시지 생성: 본인이 sender
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================
-- 5. Realtime 활성화
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.slots;

-- ============================================
-- 6. updated_at 자동 업데이트 트리거
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
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
