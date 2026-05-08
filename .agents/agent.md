# EveryCake — Agent Context (항상 먼저 읽어볼 것)

> 이 문서는 프로젝트를 시작할 때 **반드시 먼저 읽고** 작업에 참고해야 합니다.
> 새 기능/스펙 추가 시 이 문서를 업데이트하세요.

---

## 1. 프로젝트 개요

전국 커스텀 케이크 통합 플랫폼.
- **Buyer**: 가게 탐색 → 주문 → 채팅 → 리뷰
- **Seller**: 가게 관리 → 주문 처리 → 스케줄 → 채팅
- **Tech Stack**: Next.js 16 (App Router) + Supabase (Auth, DB, Storage, Realtime) + Vanilla CSS
- **기획 문서**: `docs/cake_shop_total_plan.md`, `docs/admin-planning.md`, `docs/shop-info-planning.md`

---

## 2. Supabase 데이터 스키마

### 2-1. 핵심 테이블

| 테이블 | 용도 | FK / 핵심 컬럼 |
|---|---|---|
| `profiles` | 유저 프로필 (buyer/seller/admin) | PK: `id` → `auth.users(id)`, `role: user_role` |
| `shops` | 가게 정보 | `owner_id → profiles(id)`, `business_hours(JSONB)`, `naver_map_url`, `pickup_info(JSONB)`, `external_review_links(JSONB)` |
| `orders` | 주문 | `buyer_id → profiles(id)`, `shop_id → shops(id)`, `status: order_status` |
| `order_options` | 주문 옵션 | `order_id → orders(id)` |
| `reviews` | 리뷰 | `order_id`, `buyer_id`, `shop_id`, `rating(1-5)`, `photo_url`, `is_photo_review`, `is_home_featured` |
| `messages` | 1:1 채팅 | `order_id → orders(id)`, `sender_id → profiles(id)` |
| `slots` | 예약 슬롯 | `shop_id → shops(id)`, `date`, `capacity`, `booked_count`, `is_closed` |
| `cake_presets` | 케이크 프리셋 | `category`, `title`, `image_url` |

### 2-2. 가게 상세 확장 테이블

| 테이블 | 용도 | FK / 핵심 컬럼 |
|---|---|---|
| `shop_gallery_images` | 대표 썸네일 + 포트폴리오 | `shop_id`, `url`, `position`, `is_portfolio`, `description`, `design_type`, `cake_size`, `price`, `made_date`, `menu_id` |
| `shop_menus` | 메뉴 (레터링/아트드로잉 등) | `shop_id`, `name`, `description`, `image_url`, `position` |
| `shop_menu_sizes` | 메뉴 하위 사이즈+가격 | `menu_id`, `cake_size`, `price_min`, `price_max`, UNIQUE(`menu_id, cake_size`) |
| `shop_notices` | 셀러 공지 포스팅 | `shop_id`, `title`, `content`, `is_pinned` |
| `shop_menu_prices` | (레거시) 호수x디자인타입 가격 | `shop_id`, `cake_size`, `design_type`, `price_min`, `price_max` |
| `bookmarks` | 유저 북마크 | `user_id → auth.users(id)`, `shop_id → shops(id)`, UNIQUE(`user_id, shop_id`) |

### 2-3. shops 컬럼 상세

```
id, owner_id, name, address, description,
business_hours (JSONB: { "월": { open, close, closed? }, ... }),
lat, lng, image_url,
min_order_price, is_pickup, is_delivery, delivery_fee,
region, area, district, cake_types (TEXT[]),
naver_map_url (TEXT),
pickup_info (JSONB: [{ title, description, image_urls? }]),
external_review_links (JSONB: { naver?, kakao?, google? }),
created_at
```

### 2-4. orders 컬럼 상세

```
id, buyer_id, shop_id, status (order_status ENUM),
pickup_date, design_img_url, total_price, original_price,
request_detail, cake_size, cake_flavor, cream_type,
lettering_text, seller_note,
created_at, updated_at
```

### 2-5. ENUM 타입

- `user_role`: `'seller' | 'buyer' | 'admin'`
- `order_status`: `'pending' | 'accepted' | 'payment_waiting' | 'confirmed' | 'making' | 'pickup_ready' | 'completed' | 'cancelled'`

### 2-6. Storage 버킷

| 버킷 | 용도 | 접근 정책 |
|---|---|---|
| `shop-images` | 가게 이미지 (public) | 경로: `{user_id}/filename`, 인증된 사용자만 자기 폴더에 업로드/수정/삭제 |

---

## 3. RLS 정책 패턴

모든 테이블에 RLS 활성화 됨. 새 테이블 추가 시 반드시 이 패턴을 따를 것:

| 테이블 유형 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| **공개 정보** (shops, shop_gallery_images 등) | `USING (true)` | owner 체크 | owner 체크 | owner 체크 |
| **개인 정보** (bookmarks, orders-buyer) | `USING (auth.uid() = user_id)` | `CHECK (auth.uid() = user_id)` | — | `USING (auth.uid() = user_id)` |
| **셀러 소유** (slots, notices 등) | 공개 or 관계 기반 | `shops.owner_id = auth.uid()` | 동일 | 동일 |

**셀러 소유 체크 SQL 패턴:**
```sql
EXISTS (
  SELECT 1 FROM public.shops
  WHERE shops.id = {table}.shop_id
  AND shops.owner_id = auth.uid()
)
```

---

## 4. ⚠️ Seller ↔ Buyer 패리티 체크리스트

> **모든 기능은 양면이 있다.** 새 스펙 추가 시 아래를 반드시 확인할 것.

| Buyer 기능 | Seller 대응 | 체크 |
|---|---|---|
| 가게 상세 6탭 보기 | 내 가게 관리에서 각 탭 데이터 CRUD | ✅ |
| 갤러리 이미지 보기 | 갤러리 이미지 업로드/삭제/순서변경 | ✅ |
| 사진 묶음(group_id) 표시 | 업로드 시 group_id 부여 + 쿼리에 group_id 포함 | ✅ |
| 공지 리스트 보기 | 공지 작성/수정/삭제 | ✅ |
| 메뉴 가격 보기 | 메뉴 가격 설정 (호수×디자인타입) | ✅ |
| 리뷰 보기 | 외부 리뷰 링크 등록 | ✅ |
| 정보탭 (영업시간/위치/픽업안내) | 영업시간/맵URL/픽업안내 설정 | ✅ |
| 북마크 토글 | — (buyer 전용) | ✅ |
| 주문 생성/조회 | 주문 조회/수정/상태변경 | ✅ |
| 채팅 | 채팅 | ✅ |
| 스케줄 확인 (예약 가능 날짜) | 슬롯 관리 (capacity/마감) | ✅ |

**새 기능 추가 시 체크:**
1. 이 기능에 대해 **셀러가 설정할 UI가 필요한가?**
2. 필요하다면 `/seller/shop` 또는 해당 셀러 페이지에 관리 섹션 추가
3. 새 DB 테이블/컬럼이 필요하면 SQL 마이그레이션 파일 작성 (아래 규칙 참고)

> ⚠️ **데이터 일관성 필수 규칙:**
> - Buyer 페이지(`shop/[id]/page.tsx`)의 Supabase select에 새 컬럼을 추가하면, **반드시** Seller 페이지(`seller/shop/page.tsx`)의 select에도 동일 컬럼 추가
> - 셀러 업로드 핸들러에서 새 필드를 insert하면, **반드시** Buyer 페이지 쿼리에도 해당 필드 포함
> - 예시: `group_id`, `is_portfolio`, `description` 등은 양쪽 모두에서 select해야 그룹 표시/포트폴리오 배지가 정상 동작

> 🚨 **UI 동기화 필수 규칙 (가장 중요!):**
> - **셀러의 "내 스토어"(`/seller/shop`)와 바이어의 "샵 상세"(`/shop/[id]`)는 스펙이 아예 똑같아야 한다.**
> - 탭 구성: 양쪽 동일 (`공지, 메뉴, 사진, 리뷰, 정보`). 셀러에 별도 홈 탭 금지.
> - Hero 이미지, 가게 정보(이름, 주소, 설명), 공지 카드, 메뉴 카드, 사진 그리드, 리뷰 레이아웃, 정보 표시 등 **모든 보기 UI가 완전 동일**.
> - 셀러에만 추가되는 것: 편집 버튼, 관리 폼 등 **편집 컨트롤만** 셀러 전용.
> - 바이어 샵 상세의 어떤 UI를 변경하면, **반드시** 셀러 내 스토어도 같이 업데이트할 것.
> - 사진 삭제는 **그룹 단위**로 동작해야 함 (N장 묶음 업로드한 사진은 N장 모두 함께 삭제).

---

## 5. SQL 마이그레이션 규칙

새 DB 테이블/컬럼 변경 시 **반드시** 아래 규칙을 따릅니다:

### 5-1. 파일 생성

- 경로: `supabase/{기능명}_migration.sql`
- 파일 상단에 **실행 안내 주석** 포함:
  ```sql
  -- ============================================
  -- EveryCake: {기능명} 마이그레이션
  -- Supabase SQL Editor에서 실행하세요
  -- ============================================
  ```

### 5-2. 충돌 방지

**반드시 이전 마이그레이션 파일들을 확인**하여 중복/충돌 방지:
- `CREATE TABLE IF NOT EXISTS` 사용
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 사용
- `DROP POLICY IF EXISTS` 후 `CREATE POLICY` (정책 중복 방지)
- `DROP TRIGGER IF EXISTS` 후 `CREATE TRIGGER`
- ENUM 값: `ADD VALUE IF NOT EXISTS`

### 5-3. 마이그레이션 파일 목록

**✅ 통합 파일 (이것만 실행하면 됨):**
- `schema_sync.sql` — 모든 테이블/컬럼/RLS/Storage/Realtime 보장 (몇 번이든 안전 재실행)

**📦 테스트 데이터:**
- `seed_cleanup.sql` — 기존 테스트 데이터 정리 (문제 시 먼저 실행)
- `seed.sql` — 셀러 10명 + 가게 10개 + 메뉴가격 + 공지 샘플 (비번: test1234)

**실행 순서:** `seed_cleanup.sql` → `schema_sync.sql` → `home_gallery_migration.sql` → `seed.sql`

**레거시 (개별 마이그레이션, 참고용):**
1. `schema.sql` — 기본 테이블
2. `storage_policies.sql` — 스토리지
3. `seller_admin_migration.sql` — 주문/슬롯/채팅
4. `shop_detail_migration.sql` — 가게 상세 확장
5. `add_admin_role.sql`, `add_cake_types.sql` 등 — 소규모 패치

### 5-4. 체크리스트

새 마이그레이션 작성 시:
- [ ] 기존 파일에서 같은 테이블/컬럼/정책명이 이미 정의되어 있는지 확인
- [ ] `IF NOT EXISTS` / `IF EXISTS` 가드 사용
- [ ] RLS 정책 포함 (위 패턴 참고)
- [ ] `src/lib/types.ts`에 타입 추가/수정
- [ ] Realtime 필요 시 `ALTER PUBLICATION supabase_realtime ADD TABLE` 추가

---

## 6. 프로젝트 라우트 구조

### Buyer (일반 사용자)

| 경로 | 용도 |
|---|---|
| `/` | 홈 (갤러리형 케이크 포스트 피드: 셀러 포트폴리오 + 포토리뷰) |
| `/explore` | 탐색 (검색, 카테고리, 배너, 인기가게) |
| `/search` | 검색 결과 |
| `/shop/[id]` | 가게 상세 (6탭: 홈/공지/메뉴/사진/리뷰/정보) |
| `/portfolio/[id]` | 포트폴리오 상세 (이미지, 설명, 메타데이터) |
| `/shop/[id]/order` | 주문 생성 |
| `/orders` | 내 주문 목록 |
| `/map` | 지도 탐색 |
| `/profile` | 내 정보 |
| `/login`, `/signup` | 인증 |

### Seller (가게 사장님)

| 경로 | 용도 |
|---|---|
| `/seller` | 대시보드 (오늘 픽업, 요약) |
| `/seller/shop` | 내 가게 관리 (아코디언 섹션: 이미지/기본정보/메뉴/공지/픽업/영업시간/지도) |
| `/seller/orders` | 주문 관리 (상세 편집, 상태 변경) |
| `/seller/schedule` | 스케줄/슬롯 관리 |
| `/seller/chat` | 채팅 |
| `/seller/portfolio/new` | 포트폴리오 포스팅 (2단계: 미디어+텍스트 → 추가정보) |
| `/seller/register` | 가게 등록 (최초) |

---

## 7. CSS 네이밍 규칙

클래스명은 **역할/목적**이 드러나도록 작성합니다. 유틸리티 스펙 나열 금지.

```
✅ .section-accordion, .btn-primary, .form-input, .card-shop, .tab-active
❌ .border-b .border-surface-200/60 .bg-white .px-4 .py-5
```

### 패턴

| 접두사 | 용도 | 예시 |
|---|---|---|
| `section-` | 페이지 섹션 | `section-gallery`, `section-info` |
| `card-` | 카드 컴포넌트 | `card-shop`, `card-order` |
| `btn-` | 버튼 | `btn-primary`, `btn-outline` |
| `form-` | 폼 요소 | `form-input`, `form-label` |
| `tab-` | 탭 | `tab-active`, `tab-item` |
| `nav-` | 네비게이션 | `nav-bottom`, `nav-gnb` |
| `modal-` | 모달/오버레이 | `modal-fullscreen` |
| `badge-` | 라벨/뱃지 | `badge-status`, `badge-open` |
| `list-` | 리스트 | `list-review`, `list-notice` |
| `empty-` | 빈 상태 | `empty-state` |

---

## 8. ⚠️ 모바일 중심 UI 규칙 (중요!)

> **이 프로젝트는 모바일 앱 형태로, PC에서도 항상 480px 모바일 너비를 유지합니다.**

### 8-1. 핵심 원칙

- `body`에 `max-width: 480px; margin: 0 auto;`가 적용되어 있음
- PC 브라우저에서도 가운데 정렬된 모바일 프레임으로 표시됨
- **모든 새 페이지, 팝업, 모달은 반드시 이 480px 제약을 따라야 함**

### 8-2. 팝업/모달 작성 시 필수 규칙

풀스크린 팝업(`position: fixed`)은 body 밖에서 렌더링되므로, **반드시 아래 패턴을 사용**:

```jsx
{/* 올바른 패턴: 중앙 정렬 + 480px 제한 */}
<div className="fixed inset-0 z-[90] flex justify-center">
  <div className="w-full max-w-[480px] bg-white flex flex-col">
    {/* 팝업 내용 */}
  </div>
</div>

{/* ❌ 잘못된 패턴: 전체 화면 차지 */}
<div className="fixed inset-0 z-[90] bg-white flex flex-col">
  {/* PC에서 전체 화면으로 퍼짐! */}
</div>
```

### 8-3. CSS 클래스 참고

- `.post-modal-container`: 이미 `max-width: 480px` 적용됨 → 풀페이지 모달에 재사용
- `body`: `max-width: 480px; margin: 0 auto;` → 일반 페이지 자동 적용

> ⚠️ `fixed`, `absolute` 등으로 body 바깥에 렌더링되는 요소는 **반드시 수동으로 480px 제한**을 걸어야 합니다.

---

## 9. 핵심 기획 요약

### 가게 상세 페이지 (Buyer)
- **GNB**: 뒤로가기 + 홈 + 북마크 + 공유
- **갤러리**: 4:3 라운드카드, 스와이프, indicator
- **6탭**: 홈(소개+스케줄+프리뷰) / 공지 / 메뉴(호수탭→디자인별가격) / 사진(리뷰사진갤러리) / 리뷰(필터+외부링크) / 정보(픽업안내+영업시간+지도)
- **CTA**: 메뉴 탭에서만 하단 고정 "주문/예약하기" 버튼

### Seller 관리
- **주문 편집**: 고객 주문서를 셀러가 수정 가능 (맛/사이즈/가격)
- **입금 확인**: 상태 → confirmed, Realtime으로 고객에게 즉시 반영
- **스케줄**: 캘린더 + 날짜별 capacity 관리 + 마감 토글
- **채팅**: 주문 연동 사이드바 (주문서 요약 표시)

### 미구현/예정 기능
- [ ] 공지: 외부 플랫폼(인스타그램) 글 가져오기
- [ ] 픽업안내: 사진 N개 첨부 (현재 텍스트만)
- [ ] 네이버 맵: SDK 연동 (현재 링크만)
- [ ] 알림: 주문 상태 변경 시 고객 푸시 알림
- [ ] 결제 연동

---

## 10. 개발 시 주의사항

1. **Graceful Fallback**: 아직 실행되지 않은 마이그레이션의 테이블 참조 시, `PGRST200` 에러 대비 fallback 로직 필수
2. **Storage 경로**: `shop-images` 버킷에 `{user_id}/filename` 형식 사용
3. **RLS 위반 대응**: 이미지 업로드 시 storage policy와 table RLS 모두 충족해야 함
4. **Realtime**: orders, messages, slots 테이블에 활성화됨 — 필요한 테이블은 publication에 추가
5. **Type Safety**: DB 변경 시 `src/lib/types.ts` 반드시 동기화
6. **모바일 너비**: 모든 새 컴포넌트/팝업에서 480px 제약 유지 (§8 참고)

---

## 11. 개발 환경 설정

### 10-1. Node.js / npm (nvm 사용)

이 머신은 **nvm**으로 Node.js를 관리합니다. 시스템 PATH에 npm/node가 없으므로, **모든 npm/node 명령 실행 전에 반드시 nvm을 로드**해야 합니다.

```bash
# 모든 npm/node 명령 앞에 이 prefix를 붙일 것
source ~/.zshrc 2>/dev/null; npm run dev
source ~/.zshrc 2>/dev/null; npm install <package>
```

- nvm 경로: `~/.nvm/versions/node/v20.20.0/bin/`
- 현재 Node 버전: v20.20.0

### 10-2. 브라우저에서 열기 (Chrome)

유저가 "크롬에 띄워줘", "브라우저로 열어줘" 등 요청 시, **`open` 명령어로 직접 Chrome을 실행**합니다.

```bash
open -a "Google Chrome" http://localhost:3000
```

> ⚠️ `browser_subagent` 도구는 환경 이슈로 실패할 수 있으므로, **시스템 `open` 명령어를 우선 사용**할 것.

### 10-3. 개발 서버 실행 → 크롬 열기 (한번에)

```bash
# 1단계: 개발 서버 시작 (백그라운드)
source ~/.zshrc 2>/dev/null; npm run dev

# 2단계: 서버 Ready 확인 후 크롬 열기
open -a "Google Chrome" http://localhost:4000
```

- 개발 서버 포트: **4000** (`package.json`에서 `--port 4000`으로 설정)
