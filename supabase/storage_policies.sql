-- ============================================
-- EveryCake: Storage Bucket RLS 정책
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 'shop-images' 버킷이 없으면 생성 (public 버킷)
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 기존 정책 삭제 (중복 방지)
DROP POLICY IF EXISTS "Anyone can view shop images" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can update own shop images" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can delete own shop images" ON storage.objects;

-- 3. 조회: 누구나 shop-images 버킷의 파일 조회 가능
CREATE POLICY "Anyone can view shop images"
ON storage.objects FOR SELECT
USING (bucket_id = 'shop-images');

-- 4. 업로드: 인증된 사용자(seller/admin)가 자기 폴더에 업로드 가능
--    파일 경로가 user_id/ 로 시작해야 함
CREATE POLICY "Sellers can upload shop images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. 수정: 자기 폴더 파일만 수정 가능
CREATE POLICY "Sellers can update own shop images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'shop-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. 삭제: 자기 폴더 파일만 삭제 가능
CREATE POLICY "Sellers can delete own shop images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'shop-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
