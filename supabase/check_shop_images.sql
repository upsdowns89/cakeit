-- ============================================
-- 실제 테이블 컬럼명 확인
-- ============================================

-- shops 테이블 컬럼
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'shops'
ORDER BY ordinal_position;

-- reviews 테이블 컬럼
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reviews'
ORDER BY ordinal_position;

-- images 테이블 컬럼
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'images'
ORDER BY ordinal_position;
