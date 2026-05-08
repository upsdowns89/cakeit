-- ============================================
-- supports_delivery → is_delivery 컬럼 리네임
-- supports_pickup → is_pickup 컬럼 리네임
-- ============================================
ALTER TABLE public.shops RENAME COLUMN supports_delivery TO is_delivery;
ALTER TABLE public.shops RENAME COLUMN supports_pickup TO is_pickup;

-- 결과 확인
SELECT id, name, is_pickup, is_delivery FROM public.shops;
