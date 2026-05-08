-- ============================================
-- EveryCake: 테스트 시드 데이터
-- Supabase SQL Editor에서 실행하세요
--
-- ⚠️ 실행 순서:
--   1) seed_cleanup.sql (이전에 실행했으면)
--   2) schema_sync.sql  (스키마 동기화)
--   3) seed.sql          (이 파일)
--
-- 셀러 10명 + 소비자 2명 + 각 가게 1개 + 메뉴/공지 샘플
-- 모든 테스트 계정 비밀번호: test1234
-- ============================================

-- ============================================
-- 1. auth.users 생성
-- ============================================

DO $$
DECLARE
  all_ids UUID[] := ARRAY[
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'a0000001-0000-0000-0000-000000000004'::UUID,
    'a0000001-0000-0000-0000-000000000005'::UUID,
    'a0000001-0000-0000-0000-000000000006'::UUID,
    'a0000001-0000-0000-0000-000000000007'::UUID,
    'a0000001-0000-0000-0000-000000000008'::UUID,
    'a0000001-0000-0000-0000-000000000009'::UUID,
    'a0000001-0000-0000-0000-000000000010'::UUID,
    -- 소비자(buyer) 2명
    'a0000002-0000-0000-0000-000000000001'::UUID,
    'a0000002-0000-0000-0000-000000000002'::UUID
  ];
  all_emails TEXT[] := ARRAY[
    'seller1@test.com','seller2@test.com','seller3@test.com',
    'seller4@test.com','seller5@test.com','seller6@test.com',
    'seller7@test.com','seller8@test.com','seller9@test.com',
    'seller10@test.com',
    'buyer1@test.com','buyer2@test.com'
  ];
  hashed_pw TEXT;
  i INT;
BEGIN
  hashed_pw := crypt('test1234', gen_salt('bf'));

  FOR i IN 1..12 LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = all_ids[i]) THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, invited_at,
        confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at,
        email_change_token_new, email_change, email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at,
        phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
        email_change_token_current, email_change_confirm_status,
        banned_until, reauthentication_token, reauthentication_sent_at,
        is_sso_user, deleted_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        all_ids[i], 'authenticated', 'authenticated',
        all_emails[i], hashed_pw,
        NOW(), NULL,
        '', NULL,
        '', NULL,
        '', '', NULL,
        NULL,
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('email', all_emails[i]),
        FALSE, NOW(), NOW(),
        NULL, NULL, '', '', NULL,
        '', 0,
        NULL, '', NULL,
        FALSE, NULL
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        all_ids[i], all_ids[i], all_emails[i], 'email',
        jsonb_build_object(
          'sub', all_ids[i]::text,
          'email', all_emails[i],
          'email_verified', true,
          'phone_verified', false
        ),
        NOW(), NOW(), NOW()
      );
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 2. profiles
-- ============================================

INSERT INTO public.profiles (id, email, nickname, full_name, role, phone) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'seller1@test.com',  '달콤한하루', '김민지', 'seller', '010-1111-0001'),
  ('a0000001-0000-0000-0000-000000000002', 'seller2@test.com',  '슈가베이크', '이서연', 'seller', '010-1111-0002'),
  ('a0000001-0000-0000-0000-000000000003', 'seller3@test.com',  '버터플라워', '박지호', 'seller', '010-1111-0003'),
  ('a0000001-0000-0000-0000-000000000004', 'seller4@test.com',  '크림하우스', '최유나', 'seller', '010-1111-0004'),
  ('a0000001-0000-0000-0000-000000000005', 'seller5@test.com',  '케이크팩토리', '정수빈', 'seller', '010-1111-0005'),
  ('a0000001-0000-0000-0000-000000000006', 'seller6@test.com',  '봉봉케이크', '한지민', 'seller', '010-1111-0006'),
  ('a0000001-0000-0000-0000-000000000007', 'seller7@test.com',  '르빵빵', '오세진', 'seller', '010-1111-0007'),
  ('a0000001-0000-0000-0000-000000000008', 'seller8@test.com',  '마카롱앤', '신유진', 'seller', '010-1111-0008'),
  ('a0000001-0000-0000-0000-000000000009', 'seller9@test.com',  '도레미케이크', '강하늘', 'seller', '010-1111-0009'),
  ('a0000001-0000-0000-0000-000000000010', 'seller10@test.com', '해피에이프릴', '윤도현', 'seller', '010-1111-0010'),
  -- 소비자(buyer) 2명
  ('a0000002-0000-0000-0000-000000000001', 'buyer1@test.com', '케이크러버', '이하은', 'buyer', '010-2222-0001'),
  ('a0000002-0000-0000-0000-000000000002', 'buyer2@test.com', '달달구리', '박서준', 'buyer', '010-2222-0002')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- ============================================
-- 3. shops (전체 컬럼 포함)
-- ============================================

INSERT INTO public.shops (
  id, owner_id, name, address, description,
  is_pickup, is_delivery, delivery_fee, min_order_price,
  region, area, district, cake_types,
  business_hours,
  naver_map_url, pickup_info, external_review_links
) VALUES
  -- 1) 달콤한하루 케이크
  (
    'b0000001-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000001',
    '달콤한하루 케이크', '서울시 강남구 역삼동 123-4',
    '매일 정성껏 구운 수제 케이크 전문점입니다. 레터링, 포토, 3D 케이크 모두 주문 가능해요! 🎂',
    TRUE, TRUE, 4000, 25000,
    '서울', '강남구', '역삼동',
    ARRAY['레터링', '포토', '3D'],
    '{"월":{"open":"10:00","close":"20:00"},"화":{"open":"10:00","close":"20:00"},"수":{"open":"10:00","close":"20:00"},"목":{"open":"10:00","close":"20:00"},"금":{"open":"10:00","close":"21:00"},"토":{"open":"11:00","close":"21:00"},"일":{"open":"11:00","close":"18:00"}}'::jsonb,
    'https://naver.me/5CFP6Vhb',
    '[{"title":"픽업 안내","description":"1층 정문으로 오시면 됩니다. 주차는 건물 뒤편에 가능합니다."},{"title":"포장 안내","description":"케이크 박스 + 보냉백 기본 제공됩니다."}]'::jsonb,
    '{"naver":"https://map.naver.com/review/1","kakao":"https://place.map.kakao.com/1"}'::jsonb
  ),
  -- 2) 슈가베이크
  (
    'b0000001-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000002',
    '슈가베이크', '서울시 마포구 연남동 56-7',
    '연남동 골목 안 아늑한 케이크 공방. 비건 크림도 준비되어 있어요 🌱',
    TRUE, FALSE, NULL, 30000,
    '서울', '마포구', '연남동',
    ARRAY['레터링', '아트드로잉', '비건'],
    '{"월":{"open":"11:00","close":"19:00"},"화":{"open":"11:00","close":"19:00"},"수":{"closed":true},"목":{"open":"11:00","close":"19:00"},"금":{"open":"11:00","close":"20:00"},"토":{"open":"10:00","close":"20:00"},"일":{"open":"10:00","close":"18:00"}}'::jsonb,
    NULL,
    '[{"title":"픽업 방법","description":"연남동 골목 안 파란 대문 건물 2층입니다. 벨을 눌러주세요!"}]'::jsonb,
    '{"naver":"https://map.naver.com/review/2"}'::jsonb
  ),
  -- 3) 버터플라워 케이크
  (
    'b0000001-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000003',
    '버터플라워 케이크', '서울시 성동구 성수동2가 300-1',
    '성수동 감성 케이크 🌸 플라워 케이크 전문! 원데이 클래스도 운영합니다.',
    TRUE, TRUE, 5000, 35000,
    '서울', '성동구', '성수동',
    ARRAY['플라워', '레터링', '아트드로잉'],
    '{"월":{"closed":true},"화":{"open":"10:00","close":"19:00"},"수":{"open":"10:00","close":"19:00"},"목":{"open":"10:00","close":"19:00"},"금":{"open":"10:00","close":"20:00"},"토":{"open":"10:00","close":"20:00"},"일":{"open":"11:00","close":"17:00"}}'::jsonb,
    'https://naver.me/5CFP6Vhb',
    '[{"title":"주차 안내","description":"건물 주차 불가합니다. 인근 공영주차장 이용해주세요."}]'::jsonb,
    '{"google":"https://g.page/butterflower-cake"}'::jsonb
  ),
  -- 4) 크림하우스
  (
    'b0000001-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000004',
    '크림하우스', '서울시 송파구 잠실동 45-2',
    '잠실 롯데 근처! 생크림 케이크가 유명한 동네빵집 겸 케이크 전문점 🍰',
    TRUE, TRUE, 3500, 20000,
    '서울', '송파구', '잠실동',
    ARRAY['레터링', '3D', '포토'],
    '{"월":{"open":"09:00","close":"21:00"},"화":{"open":"09:00","close":"21:00"},"수":{"open":"09:00","close":"21:00"},"목":{"open":"09:00","close":"21:00"},"금":{"open":"09:00","close":"22:00"},"토":{"open":"09:00","close":"22:00"},"일":{"open":"10:00","close":"20:00"}}'::jsonb,
    NULL,
    '[{"title":"픽업 안내","description":"잠실역 8번 출구에서 도보 3분, 가게 앞 정차 가능합니다."}]'::jsonb,
    '{"naver":"https://map.naver.com/review/4","kakao":"https://place.map.kakao.com/4"}'::jsonb
  ),
  -- 5) 케이크팩토리
  (
    'b0000001-0000-0000-0000-000000000005',
    'a0000001-0000-0000-0000-000000000005',
    '케이크팩토리', '경기도 성남시 분당구 판교로 256',
    '판교 IT단지 직장인들의 사랑을 받는 케이크 전문점. 당일 주문도 가능! ⚡',
    TRUE, TRUE, 4500, 28000,
    '경기', '성남시', '분당구',
    ARRAY['레터링', '포토', '미니케이크'],
    '{"월":{"open":"08:00","close":"20:00"},"화":{"open":"08:00","close":"20:00"},"수":{"open":"08:00","close":"20:00"},"목":{"open":"08:00","close":"20:00"},"금":{"open":"08:00","close":"20:00"},"토":{"open":"10:00","close":"18:00"},"일":{"closed":true}}'::jsonb,
    NULL,
    '[]'::jsonb,
    '{}'::jsonb
  ),
  -- 6) 봉봉케이크
  (
    'b0000001-0000-0000-0000-000000000006',
    'a0000001-0000-0000-0000-000000000006',
    '봉봉케이크', '부산시 해운대구 좌동 100-3',
    '해운대 바다가 보이는 케이크 공방 🌊 결혼식, 돌잔치 케이크도 전문!',
    TRUE, FALSE, NULL, 40000,
    '부산', '해운대구', '좌동',
    ARRAY['웨딩', '돌잔치', '플라워', '3D'],
    '{"월":{"open":"10:00","close":"19:00"},"화":{"open":"10:00","close":"19:00"},"수":{"open":"10:00","close":"19:00"},"목":{"open":"10:00","close":"19:00"},"금":{"open":"10:00","close":"20:00"},"토":{"open":"10:00","close":"20:00"},"일":{"closed":true}}'::jsonb,
    'https://naver.me/5CFP6Vhb',
    '[{"title":"웨딩 케이크 안내","description":"웨딩 케이크는 최소 2주 전 예약 필수입니다. 시식도 가능해요!"}]'::jsonb,
    '{"naver":"https://map.naver.com/review/6"}'::jsonb
  ),
  -- 7) 르빵빵
  (
    'b0000001-0000-0000-0000-000000000007',
    'a0000001-0000-0000-0000-000000000007',
    '르빵빵', '서울시 종로구 삼청동 12-8',
    '삼청동 프렌치 스타일 디저트 부티크. 마카롱 타워 케이크가 시그니처! 🇫🇷',
    TRUE, FALSE, NULL, 50000,
    '서울', '종로구', '삼청동',
    ARRAY['마카롱타워', '플라워', '아트드로잉'],
    '{"월":{"closed":true},"화":{"closed":true},"수":{"open":"11:00","close":"19:00"},"목":{"open":"11:00","close":"19:00"},"금":{"open":"11:00","close":"20:00"},"토":{"open":"11:00","close":"20:00"},"일":{"open":"12:00","close":"18:00"}}'::jsonb,
    NULL,
    '[{"title":"방문 안내","description":"삼청동 돌담길 안쪽, 한옥 건물 1층입니다."},{"title":"주의사항","description":"마카롱 타워는 픽업 전용입니다. 배달 불가."}]'::jsonb,
    '{"google":"https://g.page/le-ppang"}'::jsonb
  ),
  -- 8) 마카롱앤 케이크
  (
    'b0000001-0000-0000-0000-000000000008',
    'a0000001-0000-0000-0000-000000000008',
    '마카롱앤 케이크', '대전시 유성구 봉명동 88-1',
    '대전 유성 지역 No.1 커스텀 케이크! 마카롱 데코가 귀여운 케이크 🧁',
    TRUE, TRUE, 3000, 22000,
    '대전', '유성구', '봉명동',
    ARRAY['레터링', '마카롱데코', '미니케이크'],
    '{"월":{"open":"10:00","close":"20:00"},"화":{"open":"10:00","close":"20:00"},"수":{"open":"10:00","close":"20:00"},"목":{"open":"10:00","close":"20:00"},"금":{"open":"10:00","close":"21:00"},"토":{"open":"10:00","close":"21:00"},"일":{"open":"11:00","close":"18:00"}}'::jsonb,
    NULL,
    '[]'::jsonb,
    '{"kakao":"https://place.map.kakao.com/8"}'::jsonb
  ),
  -- 9) 도레미케이크
  (
    'b0000001-0000-0000-0000-000000000009',
    'a0000001-0000-0000-0000-000000000009',
    '도레미케이크', '인천시 남동구 구월동 567-2',
    '아이들이 좋아하는 캐릭터 케이크 전문! 뽀로로, 핑크퐁 다 있어요 🎵',
    TRUE, TRUE, 4000, 25000,
    '인천', '남동구', '구월동',
    ARRAY['캐릭터', '3D', '포토', '레터링'],
    '{"월":{"open":"09:00","close":"20:00"},"화":{"open":"09:00","close":"20:00"},"수":{"open":"09:00","close":"20:00"},"목":{"open":"09:00","close":"20:00"},"금":{"open":"09:00","close":"21:00"},"토":{"open":"09:00","close":"21:00"},"일":{"open":"10:00","close":"19:00"}}'::jsonb,
    'https://naver.me/5CFP6Vhb',
    '[{"title":"캐릭터 케이크 주문","description":"원하는 캐릭터 사진을 카톡으로 보내주세요. 상담 후 견적드립니다!"}]'::jsonb,
    '{"naver":"https://map.naver.com/review/9","kakao":"https://place.map.kakao.com/9"}'::jsonb
  ),
  -- 10) 해피에이프릴
  (
    'b0000001-0000-0000-0000-000000000010',
    'a0000001-0000-0000-0000-000000000010',
    '해피에이프릴', '제주시 노형동 2300-5',
    '제주도 감성 가득 🍊 한라봉 크림 케이크가 시그니처! 제주 여행 기념 케이크도 주문하세요.',
    TRUE, FALSE, NULL, 30000,
    '제주', '제주시', '노형동',
    ARRAY['레터링', '플라워', '제주한정'],
    '{"월":{"open":"10:00","close":"18:00"},"화":{"open":"10:00","close":"18:00"},"수":{"open":"10:00","close":"18:00"},"목":{"open":"10:00","close":"18:00"},"금":{"open":"10:00","close":"19:00"},"토":{"open":"10:00","close":"19:00"},"일":{"closed":true}}'::jsonb,
    'https://naver.me/5CFP6Vhb',
    '[{"title":"제주 배송 안내","description":"제주시 내 직접 배달 가능 (배달비 별도). 서귀포는 픽업만 가능합니다."}]'::jsonb,
    '{"naver":"https://map.naver.com/review/10"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  description = EXCLUDED.description,
  is_pickup = EXCLUDED.is_pickup,
  is_delivery = EXCLUDED.is_delivery,
  delivery_fee = EXCLUDED.delivery_fee,
  min_order_price = EXCLUDED.min_order_price,
  region = EXCLUDED.region,
  area = EXCLUDED.area,
  district = EXCLUDED.district,
  cake_types = EXCLUDED.cake_types,
  business_hours = EXCLUDED.business_hours,
  naver_map_url = EXCLUDED.naver_map_url,
  pickup_info = EXCLUDED.pickup_info,
  external_review_links = EXCLUDED.external_review_links;

-- ============================================
-- 4. 메뉴 가격 샘플 (가게 1~3에만)
-- ============================================

INSERT INTO public.shop_menu_prices (shop_id, cake_size, design_type, price_min, price_max, position) VALUES
  -- 달콤한하루
  ('b0000001-0000-0000-0000-000000000001', '도시락', '레터링', 15000, 22000, 0),
  ('b0000001-0000-0000-0000-000000000001', '도시락', '아트드로잉', 20000, 28000, 1),
  ('b0000001-0000-0000-0000-000000000001', '1호', '레터링', 35000, 45000, 2),
  ('b0000001-0000-0000-0000-000000000001', '1호', '아트드로잉', 45000, 60000, 3),
  ('b0000001-0000-0000-0000-000000000001', '1호', '3D', 55000, 80000, 4),
  ('b0000001-0000-0000-0000-000000000001', '2호', '레터링', 50000, 65000, 5),
  ('b0000001-0000-0000-0000-000000000001', '2호', '아트드로잉', 65000, 85000, 6),
  -- 슈가베이크
  ('b0000001-0000-0000-0000-000000000002', '도시락', '레터링', 18000, 25000, 0),
  ('b0000001-0000-0000-0000-000000000002', '도시락', '아트드로잉', 25000, 35000, 1),
  ('b0000001-0000-0000-0000-000000000002', '1호', '레터링', 40000, 50000, 2),
  ('b0000001-0000-0000-0000-000000000002', '1호', '아트드로잉', 50000, 70000, 3),
  -- 버터플라워
  ('b0000001-0000-0000-0000-000000000003', '도시락', '플라워', 25000, 35000, 0),
  ('b0000001-0000-0000-0000-000000000003', '1호', '플라워', 55000, 75000, 1),
  ('b0000001-0000-0000-0000-000000000003', '1호', '레터링', 38000, 48000, 2),
  ('b0000001-0000-0000-0000-000000000003', '2호', '플라워', 80000, 110000, 3)
ON CONFLICT (shop_id, cake_size, design_type) DO UPDATE SET
  price_min = EXCLUDED.price_min,
  price_max = EXCLUDED.price_max,
  position = EXCLUDED.position;

-- ============================================
-- 4-1. 메뉴 계층구조 시드 (shop_menus + shop_menu_sizes)
-- shop_menu_prices의 design_type → shop_menus, 사이즈+가격 → shop_menu_sizes
-- ============================================

-- 달콤한하루: 레터링, 아트드로잉, 3D
INSERT INTO public.shop_menus (id, shop_id, name, position) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', '레터링', 0),
  ('d0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001', '아트드로잉', 1),
  ('d0000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000001', '3D', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shop_menu_sizes (menu_id, cake_size, price_min, price_max) VALUES
  -- 레터링
  ('d0000001-0000-0000-0000-000000000001', '도시락', 15000, 22000),
  ('d0000001-0000-0000-0000-000000000001', '1호', 35000, 45000),
  ('d0000001-0000-0000-0000-000000000001', '2호', 50000, 65000),
  -- 아트드로잉
  ('d0000001-0000-0000-0000-000000000002', '도시락', 20000, 28000),
  ('d0000001-0000-0000-0000-000000000002', '1호', 45000, 60000),
  ('d0000001-0000-0000-0000-000000000002', '2호', 65000, 85000),
  -- 3D
  ('d0000001-0000-0000-0000-000000000003', '1호', 55000, 80000)
ON CONFLICT (menu_id, cake_size) DO UPDATE SET
  price_min = EXCLUDED.price_min,
  price_max = EXCLUDED.price_max;

-- 슈가베이크: 레터링, 아트드로잉
INSERT INTO public.shop_menus (id, shop_id, name, position) VALUES
  ('d0000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000002', '레터링', 0),
  ('d0000001-0000-0000-0000-000000000005', 'b0000001-0000-0000-0000-000000000002', '아트드로잉', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shop_menu_sizes (menu_id, cake_size, price_min, price_max) VALUES
  ('d0000001-0000-0000-0000-000000000004', '도시락', 18000, 25000),
  ('d0000001-0000-0000-0000-000000000004', '1호', 40000, 50000),
  ('d0000001-0000-0000-0000-000000000005', '도시락', 25000, 35000),
  ('d0000001-0000-0000-0000-000000000005', '1호', 50000, 70000)
ON CONFLICT (menu_id, cake_size) DO UPDATE SET
  price_min = EXCLUDED.price_min,
  price_max = EXCLUDED.price_max;

-- 버터플라워: 플라워, 레터링
INSERT INTO public.shop_menus (id, shop_id, name, position) VALUES
  ('d0000001-0000-0000-0000-000000000006', 'b0000001-0000-0000-0000-000000000003', '플라워', 0),
  ('d0000001-0000-0000-0000-000000000007', 'b0000001-0000-0000-0000-000000000003', '레터링', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shop_menu_sizes (menu_id, cake_size, price_min, price_max) VALUES
  ('d0000001-0000-0000-0000-000000000006', '도시락', 25000, 35000),
  ('d0000001-0000-0000-0000-000000000006', '1호', 55000, 75000),
  ('d0000001-0000-0000-0000-000000000006', '2호', 80000, 110000),
  ('d0000001-0000-0000-0000-000000000007', '1호', 38000, 48000)
ON CONFLICT (menu_id, cake_size) DO UPDATE SET
  price_min = EXCLUDED.price_min,
  price_max = EXCLUDED.price_max;

-- ============================================
-- 5. 공지 샘플 (가게 1~2에만)
-- ============================================

INSERT INTO public.shop_notices (id, shop_id, title, content, is_pinned) VALUES
  ('c0000001-0000-0000-0000-000000000001',
   'b0000001-0000-0000-0000-000000000001',
   '🎉 오픈 기념 10% 할인 이벤트!',
   '달콤한하루 케이크가 드디어 EveryCake에 입점했습니다! 첫 주문 시 10% 할인 쿠폰을 드려요. 기간: 2026년 4월 한 달간.',
   TRUE),
  ('c0000001-0000-0000-0000-000000000002',
   'b0000001-0000-0000-0000-000000000001',
   '4월 임시 휴무 안내',
   '4월 15일(화)은 내부 행사로 인해 임시 휴무합니다. 양해 부탁드립니다 🙏',
   FALSE),
  ('c0000001-0000-0000-0000-000000000003',
   'b0000001-0000-0000-0000-000000000002',
   '비건 크림 신메뉴 출시 🌱',
   '코코넛 크림 베이스의 새로운 비건 옵션이 추가되었습니다! 맛도 좋고 질감도 부드러워요.',
   TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. PostgREST 스키마 캐시 새로고침
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 7. 확인
-- ============================================
SELECT
  p.nickname AS "셀러명",
  p.email AS "이메일",
  s.name AS "가게명",
  s.region AS "지역",
  s.area AS "구",
  CASE WHEN s.naver_map_url IS NOT NULL THEN '✅' ELSE '❌' END AS "맵",
  CASE WHEN s.pickup_info::text != '[]' THEN '✅' ELSE '❌' END AS "픽업안내",
  CASE WHEN s.external_review_links::text != '{}' THEN '✅' ELSE '❌' END AS "리뷰링크"
FROM public.profiles p
LEFT JOIN public.shops s ON s.owner_id = p.id
WHERE p.email LIKE 'seller%@test.com' OR p.email LIKE 'buyer%@test.com'
ORDER BY p.role, p.email;
