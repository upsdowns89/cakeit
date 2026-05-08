# 🔥 Shop 인기도 시스템

## 개요

EveryCake의 인기도 시스템은 **소비자 행동 데이터**를 기반으로 가게의 인기 점수를 산출합니다.  
셀러의 콘텐츠 완성도가 아닌, 실제 유저가 어떤 가게에 관심을 보이고 행동했는지를 측정합니다.

---

## 데이터 수집

### 이벤트 테이블: `shop_events`

유저의 모든 가게 관련 행동은 `shop_events` 테이블에 기록됩니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `shop_id` | uuid | 대상 가게 |
| `event_type` | text | 이벤트 종류 |
| `user_id` | uuid (nullable) | 로그인 유저 (비로그인 시 null) |
| `metadata` | jsonb | 추가 정보 (e.g. photo_id) |
| `created_at` | timestamptz | 발생 시각 |

### 추적되는 이벤트 종류

| event_type | 발생 시점 | 설명 |
|---|---|---|
| `shop_view` | 가게 상세페이지 진입 | 세션당 1회만 기록 (중복 방지) |
| `photo_view` | 포트폴리오 사진 풀스크린 보기 | 사진 클릭 시마다 기록 |
| `order_click` | "주문하기" 버튼 클릭 | 구매 의도 신호 |
| `share_click` | 공유 버튼 클릭 | 바이럴 신호 |

### 기타 데이터 소스

| 소스 | 테이블 | 설명 |
|------|--------|------|
| 북마크 수 | `bookmarks` | 유저가 가게를 저장한 횟수 |
| 리뷰 수 | `reviews` | 작성된 리뷰 개수 |
| 평균 별점 | `reviews.rating` | 리뷰 별점 평균 (1~5) |

---

## 인기도 점수 산출

### 점수 테이블: `shop_popularity`

가게별 인기 점수는 `shop_popularity` 테이블에 미리 계산되어 저장됩니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `shop_id` | uuid | PK, 가게 ID |
| `view_count` | integer | 최근 90일 조회수 |
| `photo_view_count` | integer | 최근 90일 사진 조회수 |
| `bookmark_count` | integer | 총 북마크 수 |
| `review_count` | integer | 총 리뷰 수 |
| `avg_rating` | numeric(3,2) | 평균 별점 |
| `order_click_count` | integer | 최근 90일 주문 클릭수 |
| `score` | numeric(10,2) | **최종 인기 점수** |
| `updated_at` | timestamptz | 마지막 갱신 시각 |

### 점수 공식

```
score = (view_count × 1.0)
      + (photo_view_count × 0.5)
      + (bookmark_count × 5.0)
      + (review_count × 10.0)
      + (avg_rating × 5.0)
      + (order_click_count × 3.0)
```

### 가중치 설계 근거

| 지표 | 가중치 | 근거 |
|------|--------|------|
| 조회수 | **×1.0** | 기본 관심 지표. 가장 빈번하게 발생하므로 낮은 가중치 |
| 사진 조회 | **×0.5** | 조회보다 약한 관심. 무의식적 탐색 포함 |
| 북마크 | **×5.0** | 명시적 관심 표현. "나중에 다시 보겠다"는 강한 의도 |
| 리뷰 | **×10.0** | 실제 구매 후 작성. 가장 강한 전환 신호 |
| 평균 별점 | **×5.0** | 품질 지표. 만점(5.0) 기준 최대 25점 기여 |
| 주문 클릭 | **×3.0** | 구매 의도. 실제 결제까지는 아니지만 강한 전환 |

> **참고**: `shop_events`의 `shop_view`, `photo_view`, `order_click`은 **최근 90일** 데이터만 집계됩니다.  
> 북마크와 리뷰는 전체 기간 누적입니다.

---

## 스코어 갱신 방법

### 방법 1: 수동 갱신 (SQL 직접 실행)

Supabase SQL Editor에서 아래 쿼리를 실행합니다:

```sql
SELECT refresh_shop_popularity();
```

### 방법 2: Supabase Cron (pg_cron) — 추천 ✅

Supabase Dashboard → Database → Extensions에서 `pg_cron`을 활성화한 후:

```sql
-- 매시간 자동 갱신
SELECT cron.schedule(
  'refresh-shop-popularity',
  '0 * * * *',   -- 매시 정각
  'SELECT refresh_shop_popularity()'
);
```

```sql
-- cron 작업 확인
SELECT * FROM cron.job;

-- cron 작업 삭제
SELECT cron.unschedule('refresh-shop-popularity');
```

> **권장 주기**: 서비스 초기에는 1시간마다, 트래픽이 늘면 15분~30분으로 줄여도 됩니다.

### 방법 3: Supabase Edge Function

트래픽이 많아져 실시간 갱신이 필요한 경우:

```typescript
// supabase/functions/refresh-popularity/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { error } = await supabase.rpc('refresh_shop_popularity');

  return new Response(
    JSON.stringify({ success: !error, error: error?.message }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

이후 Supabase Cron에서 Edge Function을 호출하도록 연동 가능합니다.

---

## 적용 위치

| 위치 | 파일 | 적용 방식 |
|------|------|-----------|
| **탐색 탭** → "인기 가게" 섹션 | `src/app/explore/page.tsx` | `shop_popularity.score` DESC 정렬 |
| **검색** → "인기순" 정렬 | `src/app/search/page.tsx` | `_popularity` 필드로 클라이언트 정렬 |

### 데이터 플로우

```
[유저 행동]
    ↓
shop_events INSERT (fire-and-forget)
    ↓
[주기적 갱신] refresh_shop_popularity()
    ↓
shop_popularity.score 업데이트
    ↓
[페이지 로드 시] shops JOIN shop_popularity(score) 쿼리
    ↓
인기순 정렬 적용
```

---

## 이벤트 트래킹 코드

### 클라이언트 유틸: `src/lib/track.ts`

```typescript
import { trackShopView, trackPhotoView, trackOrderClick, trackShareClick } from '@/lib/track';

// 가게 상세 페이지 진입 시 (세션당 1회)
trackShopView(shopId);

// 사진 풀스크린 보기
trackPhotoView(shopId);

// 주문하기 버튼 클릭
trackOrderClick(shopId);

// 공유 버튼 클릭
trackShareClick(shopId);
```

> 모든 트래킹은 **fire-and-forget** 방식으로 실패해도 UX에 영향 없음.  
> `shop_view`는 브라우저 세션 내 **중복 방지** 처리됨 (같은 가게 재방문 시 재기록하지 않음).

---

## 초기 설정 체크리스트

- [ ] Supabase SQL Editor에서 `supabase/shop_popularity_migration.sql` 실행
- [ ] `refresh_shop_popularity()` 수동 실행하여 초기 데이터 생성 확인
- [ ] pg_cron 활성화 후 주기적 갱신 스케줄 등록
- [ ] 탐색 탭 / 검색 페이지에서 인기순 정렬 정상 동작 확인

---

## 향후 확장 가능 지표

| 지표 | 설명 | 난이도 |
|------|------|--------|
| 실제 주문 완료 수 | 결제 연동 후 가장 강력한 전환 지표 | 높음 |
| 재방문율 | 같은 유저가 N일 이내 재방문 비율 | 중간 |
| 체류 시간 | 가게 상세페이지 체류 시간 | 중간 |
| SNS 공유 완료 | navigator.share 성공 콜백 추적 | 낮음 |
| 사진 저장 수 | 유저가 포트폴리오 사진 개별 북마크 | 낮음 |
