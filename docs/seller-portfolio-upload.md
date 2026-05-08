# 셀러 포트폴리오 업로드(포스팅) 기능

## 개요
셀러가 케이크 디자인을 업로드하는 포스팅 페이지. 완성된 케이크 사진을 올리고 추가 정보를 함께 포스팅한다.
포트폴리오로 등록된 포스트는 EveryCake 홈 갤러리에 노출된다.

---

## 데이터 모델 (메뉴 계층구조)

### 구조
```
shop_menus (메뉴: 레터링, 아트드로잉 등)
  └─ shop_menu_sizes (사이즈별 가격: 1호/50000원, 2호/60000원)
  └─ shop_gallery_images (연결된 포트폴리오: menu_id FK)
```

### 테이블
| 테이블 | 핵심 컬럼 |
|---|---|
| `shop_menus` | `shop_id`, `name`, `description`, `image_url`, `position` |
| `shop_menu_sizes` | `menu_id`, `cake_size`, `price_min`, `price_max` |
| `shop_gallery_images` | `menu_id` (FK → shop_menus), `is_portfolio`, `description`, `design_type`, `cake_size`, `price`, `made_date` |

---

## 진입점
- **셀러 메뉴(모든 /seller/* 페이지)** 에서 우측 하단 **'+' 플로팅 버튼**
- 라우트: `/seller/portfolio/new`
- 컴포넌트: `SellerBottomTabBar.tsx`에 플로팅 버튼 추가

## 작성 Flow

### 1단계: 기본 정보 (미디어 + 텍스트)
| 항목 | 상세 |
|---|---|
| 이미지/동영상 | 다수 파일 업로드 (최대 10개) |
| 텍스트 | 500자 제한, 케이크 설명/작업 후기 등 |

**UI:** 상단에 미디어 업로드 영역, 하단에 텍스트 입력. "다음" 버튼으로 2단계 진입.

### 2단계: 추가 정보 (메뉴 메타데이터)
| 항목 | 상세 |
|---|---|
| 메뉴 선택 | `shop_menus` 테이블에서 선택 (카드형 UI) |
| 케이크 사이즈 | `shop_menu_sizes`에서 수집된 사이즈 pill 선택 |
| 가격 | 숫자 입력 (원) |
| 제작 날짜 | 날짜 선택 (date picker) |

**UI:** 메뉴 카드 선택 + 폼 필드들 + "포스팅하기" 완료 버튼.

---

## 포트폴리오 상세 페이지 (Buyer: `/portfolio/[id]`)

| 섹션 | 내용 |
|---|---|
| 메인 이미지 | 풀 width 이미지 |
| 가게 정보 바 | 가게 프로필(이미지, 이름, 주소) → 가게 상세 링크 |
| 설명 | description 텍스트 |
| 메타 정보 | 연결된 메뉴명, 사이즈, 가격, 제작일 (카드형) |
| 관련 작품 | 같은 가게의 다른 포트폴리오 (3열 그리드 최대 6개) |

---

## 셀러 메뉴 관리 (seller/shop 메뉴 탭)

**계층형 UI:**
```
[메뉴 카드: 레터링 케이크]
  ├─ 도시락 : 35,000원
  ├─ 1호 : 50,000원
  └─ [+ 사이즈 추가]

[메뉴 카드: 아트드로잉]
  ├─ 1호 : 60,000원
  └─ [+ 사이즈 추가]

[+ 새 메뉴 만들기]
```

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `/src/app/seller/portfolio/new/page.tsx` | 포트폴리오 포스팅 (2단계 폼) |
| `/src/app/portfolio/[id]/page.tsx` | 포트폴리오 상세 (buyer용) |
| `/src/components/SellerBottomTabBar.tsx` | '+' 플로팅 버튼 |
| `/src/app/seller/shop/page.tsx` | 계층형 메뉴 관리 (menu tab) |
| `/src/lib/types.ts` | ShopMenu, ShopMenuSize 타입 |
| `/supabase/home_gallery_migration.sql` | shop_menus, shop_menu_sizes, menu_id FK |

---

## 구현 현황

- [x] 기획 문서 작성
- [x] DB 마이그레이션 SQL (shop_menus, shop_menu_sizes 테이블 + menu_id FK)
- [x] TypeScript 타입 (ShopMenu, ShopMenuSize, ShopGalleryImage.menu_id)
- [x] 셀러 탭바 '+' 플로팅 버튼
- [x] 포트폴리오 포스팅 페이지 (shop_menus 기반 메뉴 선택)
- [x] 포트폴리오 상세 페이지 (/portfolio/[id])
- [x] 셀러 메뉴 관리 UI (계층형: 메뉴 → 사이즈)
- [x] TypeScript 빌드 검증 통과
