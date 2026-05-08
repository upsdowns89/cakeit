-- ============================================
-- 1. cake_types 컬럼 추가 (이미 있으면 무시)
-- ============================================
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS cake_types TEXT[];

-- ============================================
-- 2. 모든 가게에 랜덤 cake_types 값 넣기
--    가능한 값: '3d', 'lettering', 'special', 'designer'
--    각 가게에 1~4개 랜덤 조합으로 부여
-- ============================================
UPDATE public.shops
SET cake_types = (
  SELECT ARRAY(
    SELECT unnest
    FROM unnest(ARRAY['3d', 'lettering', 'special', 'designer'])
    WHERE random() > 0.4  -- 약 60% 확률로 각 타입 포함
    ORDER BY random()
  )
)
WHERE TRUE;

-- 만약 빈 배열이 된 가게가 있으면 최소 1개는 넣어주기
UPDATE public.shops
SET cake_types = ARRAY[(ARRAY['3d', 'lettering', 'special', 'designer'])[floor(random() * 4 + 1)::int]]
WHERE cake_types = '{}' OR cake_types IS NULL;

-- ============================================
-- 3. 결과 확인
-- ============================================
SELECT id, name, cake_types FROM public.shops;
