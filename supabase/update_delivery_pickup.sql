-- ============================================
-- shops 테이블의 supports_pickup / supports_delivery
-- 랜덤으로 업데이트 (픽업만 / 배달만 / 둘 다)
-- ============================================

-- 모든 가게에 랜덤 배정
-- 약 40% 픽업만, 30% 배달만, 30% 둘 다
UPDATE public.shops
SET
  supports_pickup = CASE
    WHEN random() < 0.4 THEN TRUE   -- 픽업만
    WHEN random() < 0.5 THEN FALSE  -- 배달만
    ELSE TRUE                        -- 둘 다
  END,
  supports_delivery = CASE
    WHEN random() < 0.4 THEN FALSE  -- 픽업만
    WHEN random() < 0.5 THEN TRUE   -- 배달만
    ELSE TRUE                        -- 둘 다
  END
WHERE TRUE;

-- 둘 다 FALSE인 가게가 없도록 보정 (최소 픽업은 가능하게)
UPDATE public.shops
SET supports_pickup = TRUE
WHERE supports_pickup = FALSE AND supports_delivery = FALSE;

-- 결과 확인
SELECT id, name, supports_pickup, supports_delivery,
  CASE
    WHEN supports_pickup AND supports_delivery THEN '픽업+배달'
    WHEN supports_pickup THEN '픽업만'
    ELSE '배달만'
  END AS service_type
FROM public.shops;
