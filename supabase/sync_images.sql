-- ============================================
-- shops.image_url → images 테이블로 동기화
-- reviews.photo_url → images 테이블로 동기화
-- (중복 삽입 방지)
-- ============================================

-- 1. shops.image_url → images (source='seller', is_primary=true)
INSERT INTO public.images (shop_id, owner_id, source, url, is_primary, position)
SELECT
  s.id AS shop_id,
  s.owner_id,
  'seller' AS source,
  s.image_url AS url,
  true AS is_primary,
  0 AS position
FROM public.shops s
WHERE s.image_url IS NOT NULL
  AND s.image_url != ''
  AND s.image_url NOT LIKE '%example.com%'
  AND NOT EXISTS (
    SELECT 1 FROM public.images i
    WHERE i.shop_id = s.id AND i.url = s.image_url
  );

-- 2. reviews.photo_url → images (source='review')
INSERT INTO public.images (shop_id, review_id, owner_id, source, url, is_primary, position)
SELECT
  r.shop_id,
  r.id AS review_id,
  r.buyer_id AS owner_id,
  'review' AS source,
  r.photo_url AS url,
  false AS is_primary,
  0 AS position
FROM public.reviews r
WHERE r.photo_url IS NOT NULL
  AND r.photo_url != ''
  AND r.photo_url NOT LIKE '%example.com%'
  AND NOT EXISTS (
    SELECT 1 FROM public.images i
    WHERE i.review_id = r.id AND i.url = r.photo_url
  );

-- 3. 결과 확인
SELECT
  i.id,
  i.source,
  i.is_primary,
  i.url,
  s.name AS shop_name
FROM public.images i
LEFT JOIN public.shops s ON s.id = i.shop_id
ORDER BY i.shop_id, i.is_primary DESC, i.position ASC;
