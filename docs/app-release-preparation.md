# EveryCake 앱 출시 준비 가이드

> Next.js 16 웹앱을 네이티브 앱으로 감싸서 iOS/Android 스토어에 출시하기 위한 수정사항 및 준비사항 정리

---

## 목차

1. [앱 래핑 방식 선택](#1-앱-래핑-방식-선택)
2. [필수 수정사항 (코드)](#2-필수-수정사항-코드)
3. [필수 수정사항 (인프라/설정)](#3-필수-수정사항-인프라설정)
4. [네이티브 기능 연동](#4-네이티브-기능-연동)
5. [스토어 심사 대비](#5-스토어-심사-대비)
6. [성능 최적화](#6-성능-최적화)
7. [체크리스트](#7-체크리스트)

---

## 1. 앱 래핑 방식 선택

### 추천: Capacitor (Ionic)

| 방식 | 장점 | 단점 |
|------|------|------|
| **Capacitor** ⭐ | Next.js와 호환 우수, 네이티브 플러그인 풍부, 커뮤니티 활발 | SSR 기능 제한 (정적 빌드 필요) |
| React Native WebView | 순수 웹뷰 래핑, 간단 | 네이티브 기능 접근 어려움, 심사 거절 리스크 |
| PWA | 설치 없이 사용 가능 | iOS 제약 많음, 푸시알림 제한 |
| Tauri Mobile | 경량, Rust 기반 | 아직 모바일 베타 단계 |

### Capacitor 도입 시 핵심 변경

```bash
# 설치
npm install @capacitor/core @capacitor/cli
npx cap init EveryCake com.everycake.app

# 플랫폼 추가
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

---

## 2. 필수 수정사항 (코드)

### 2-1. Next.js 정적 빌드 설정

> Capacitor는 정적 HTML을 로드하므로 `output: 'export'` 설정 필요

**파일: `next.config.ts`**
```typescript
const nextConfig: NextConfig = {
  output: 'export',        // 정적 HTML 빌드
  images: {
    unoptimized: true,      // next/image 최적화 비활성화 (정적 빌드 시 필수)
  },
  trailingSlash: true,      // Capacitor 파일 로딩 호환
};
```

> ⚠️ **주의**: `output: 'export'` 사용 시 아래 기능 사용 불가:
> - API Routes (`/app/actions/`)
> - Server Components (이미 대부분 `'use client'` 사용 중)
> - Middleware (`middleware.ts`) → 클라이언트 사이드 가드로 대체 필요
> - SSR 기반 인증 → Supabase 클라이언트 인증으로 완전 전환

### 2-2. 인증 미들웨어 → 클라이언트 가드로 전환

현재 `src/lib/supabase/middleware.ts`에서 서버 측 세션 체크를 하고 있음. 
정적 빌드 시 미들웨어를 사용할 수 없으므로 클라이언트 측 인증 가드로 전환 필요.

```tsx
// src/hooks/useRequireAuth.ts (신규 생성)
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function useRequireAuth() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
      } else {
        setUser(user);
      }
      setLoading(false);
    });
  }, []);

  return { user, loading };
}
```

### 2-3. Safe Area / 노치 대응 강화

현재 `viewport-fit=cover`와 `safe-area-bottom` 클래스는 있으나 추가 보완 필요.

**파일: `src/app/globals.css`** — 추가 필요:
```css
/* Navbar 상단 safe area */
.safe-area-top {
  padding-top: env(safe-area-inset-top, 0px);
}

/* 좌우 safe area (아이폰 가로모드 대비) */
.safe-area-horizontal {
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
```

**파일: `src/components/Navbar.tsx`** — `safe-area-top` 적용:
```tsx
<nav className="sticky top-0 z-50 ... safe-area-top">
```

**파일: `src/app/layout.tsx`** — `max-width: 480px` 제거 고려:
```css
/* globals.css — 앱 환경에서는 전체 너비 사용 */
body {
  /* max-width: 480px; → 앱에서는 제거 */
  max-width: 100%;
  margin: 0;
  box-shadow: none; /* 앱에서는 불필요 */
}

html {
  background-color: white; /* #e5e5e5 → white */
}
```

### 2-4. 외부 스크립트 로딩 방식 변경

현재 카카오맵 SDK를 `<script>` 태그로 직접 로드 중. 정적 빌드 + 앱 환경에서는 동적 로딩으로 전환 권장.

```tsx
// 현재 (layout.tsx의 <head>에 직접 삽입)
<script src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=...`} />

// 변경: KakaoMap 컴포넌트 내에서 동적 로드
useEffect(() => {
  const script = document.createElement('script');
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`;
  script.onload = () => window.kakao.maps.load(() => initMap());
  document.head.appendChild(script);
}, []);
```

> `//dapi.kakao.com/...` → `https://dapi.kakao.com/...` (프로토콜 명시 필수, 앱 내 file:// 환경에서 프로토콜 생략 시 로드 실패)

### 2-5. 라우팅 방식 점검

현재 Next.js App Router의 `Link` 컴포넌트를 사용 중. Capacitor 정적 빌드에서는:

- `next/link` → 정상 작동 (클라이언트 사이드 라우팅)
- `next/navigation`의 `useRouter` → 정상 작동
- 브라우저 뒤로가기 → Capacitor의 `App.addListener('backButton')` 별도 처리 필요

---

## 3. 필수 수정사항 (인프라/설정)

### 3-1. 호스팅 및 API 서버

| 구분 | 현재 | 앱 출시 후 |
|------|------|------------|
| 프론트엔드 | localhost (dev) | Capacitor 내장 (로컬 파일) |
| 백엔드/DB | Supabase Cloud | Supabase Cloud (동일) |
| 이미지 저장 | Supabase Storage | Supabase Storage (동일) |
| 인증 | Supabase Auth (쿠키 기반) | Supabase Auth (토큰 기반으로 전환) |

### 3-2. 환경변수 관리

현재 `.env.local`의 키가 `NEXT_PUBLIC_` 접두사로 클라이언트에 노출됨.
정적 빌드 시 빌드 시점에 하드코딩되므로 보안상 문제 없으나, **Supabase Anon Key는 원래 공개용**.

> ✅ Anon Key는 RLS(Row Level Security)로 보호되므로 앱에 포함 가능
> ⚠️ Service Role Key는 절대 클라이언트에 포함하면 안 됨

### 3-3. 딥링크 설정

```json
// capacitor.config.json
{
  "appId": "com.everycake.app",
  "appName": "EveryCake",
  "webDir": "out",
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "App": {
      "universalLinks": ["everycake.app"]
    }
  }
}
```

---

## 4. 네이티브 기능 연동

### 4-1. 푸시 알림 (필수)

주문 상태 변경, 채팅 메시지 등 알림 필수.

```bash
npm install @capacitor/push-notifications
```

- FCM (Android) + APNs (iOS) 설정 필요
- Supabase Edge Functions에서 알림 트리거 구현
- 서비스 워커 대신 Capacitor 네이티브 푸시 사용

### 4-2. 카메라/갤러리 (필수)

포트폴리오 업로드, 프로필 사진 등.

```bash
npm install @capacitor/camera
```

### 4-3. 위치 정보 (필수)

지도 페이지(`/map`)에서 현재 위치 기반 검색.

```bash
npm install @capacitor/geolocation
```

### 4-4. 기타 권장 플러그인

| 기능 | 패키지 | 용도 |
|------|--------|------|
| 상태바 | `@capacitor/status-bar` | 상태바 스타일 커스텀 |
| 스플래시 | `@capacitor/splash-screen` | 앱 로딩 화면 |
| 키보드 | `@capacitor/keyboard` | 키보드 올라올 때 레이아웃 조정 |
| 햅틱 | `@capacitor/haptics` | 터치 피드백 |
| 앱 링크 | `@capacitor/app` | 딥링크/뒤로가기 |
| 공유 | `@capacitor/share` | 가게/케이크 공유 |
| 브라우저 | `@capacitor/browser` | 외부 URL 열기 (카카오맵 등) |

---

## 5. 스토어 심사 대비

### 5-1. Apple App Store

| 항목 | 상태 | 필요 작업 |
|------|------|-----------|
| Apple Developer 계정 | ❌ | 연 $99 등록 |
| 앱 아이콘 (1024×1024) | ❌ | 디자인 필요 |
| 스플래시 스크린 | ❌ | 디자인 필요 |
| 스크린샷 (6.7", 6.1", iPad) | ❌ | 앱 완성 후 캡처 |
| 개인정보 처리방침 URL | ❌ | 웹페이지 필요 |
| 앱 설명 / 키워드 | ❌ | 작성 필요 |
| 최소 네이티브 기능 | ⚠️ | 단순 웹뷰 래핑은 거절 사유 → 푸시/카메라 등 네이티브 기능 필수 |
| ATT (앱 추적 투명성) | ❌ | 광고 추적 시 필수 |
| 로그인 방식 | ⚠️ | 소셜 로그인 제공 시 **Apple 로그인 필수** |

> ⚠️ **Apple 심사 핵심**: 순수 웹뷰 래핑만으로는 심사 거절될 가능성 높음.
> 최소 1-2개의 네이티브 기능(푸시 알림, 카메라)을 반드시 연동할 것.

### 5-2. Google Play Store

| 항목 | 상태 | 필요 작업 |
|------|------|-----------|
| Google Developer 계정 | ❌ | 일회성 $25 등록 |
| 앱 아이콘 (512×512) | ❌ | 디자인 필요 |
| Feature Graphic (1024×500) | ❌ | 디자인 필요 |
| 스크린샷 | ❌ | 앱 완성 후 캡처 |
| 개인정보 처리방침 | ❌ | Apple과 동일 |
| 데이터 안전 섹션 | ❌ | 수집 데이터 명시 |
| 타겟 API 레벨 | ❌ | Android 14 (API 34) 이상 타겟 |

### 5-3. 개인정보 / 법적 준비

- [ ] **개인정보 처리방침** 페이지 작성 및 호스팅
- [ ] **이용약관** 작성
- [ ] **수집 데이터 명시**: 이메일, 전화번호, 위치정보, 주문내역
- [ ] **위치정보 이용 동의**: 지도 기능 사용 시 별도 동의 필요
- [ ] **결제 기능 고려**: 인앱결제 vs 외부결제 정책 확인 필요

---

## 6. 성능 최적화

### 6-1. 번들 최적화

```bash
# 번들 분석
npm install -D @next/bundle-analyzer
```

### 6-2. 이미지 최적화

- 현재 `next/image` 미사용 → 정적 빌드 호환 문제 없음
- Supabase Storage 이미지에 `?width=300&height=300` 등 변환 파라미터 활용 추천
- WebP 포맷 우선 사용

### 6-3. 오프라인 대응

```typescript
// 네트워크 상태 감지
import { Network } from '@capacitor/network';

Network.addListener('networkStatusChange', (status) => {
  if (!status.connected) {
    // 오프라인 안내 UI 표시
  }
});
```

### 6-4. 앱 상태 관리

```typescript
import { App } from '@capacitor/app';

// 앱이 백그라운드에서 돌아올 때 데이터 새로고침
App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    // 최신 데이터 fetch
  }
});
```

---

## 7. 체크리스트

### Phase 1: 코드 수정 (앱 호환성)

- [ ] `next.config.ts` — `output: 'export'` 설정
- [ ] `globals.css` — `body { max-width }` 제거, `html { background }` 수정
- [ ] `layout.tsx` — 카카오맵 SDK `<script>` 제거 → 동적 로드 전환
- [ ] `middleware.ts` → 클라이언트 가드(`useRequireAuth`) 전환
- [ ] 모든 프로토콜 생략 URL(`//domain`) → `https://` 명시
- [ ] Safe Area 패딩 강화 (Navbar 상단, BottomTabBar 하단)
- [ ] Server Actions(`/app/actions/`) → Supabase 직접 호출로 전환

### Phase 2: Capacitor 설정

- [ ] Capacitor 설치 및 초기화
- [ ] iOS/Android 프로젝트 생성
- [ ] 앱 아이콘 / 스플래시 스크린 설정
- [ ] 푸시 알림 플러그인 설정 (FCM/APNs)
- [ ] 딥링크 설정

### Phase 3: 네이티브 기능

- [ ] 푸시 알림 구현
- [ ] 카메라/갤러리 연동
- [ ] 위치 정보 권한 및 현재 위치 기능
- [ ] 뒤로가기 버튼 핸들링 (Android)
- [ ] 상태바 스타일 커스텀

### Phase 4: 스토어 준비

- [ ] Apple Developer / Google Developer 계정 등록
- [ ] 앱 아이콘 디자인 (1024×1024)
- [ ] 스크린샷 촬영
- [ ] 개인정보 처리방침 & 이용약관 작성
- [ ] 앱 설명, 키워드, 카테고리 작성
- [ ] 테스트 빌드 → TestFlight / 내부 테스트 트랙

### Phase 5: 출시 전 최종 점검

- [ ] 다양한 기기에서 레이아웃 테스트 (iPhone SE ~ Pro Max, Galaxy S/A 시리즈)
- [ ] 네트워크 끊김 시 앱 동작 확인
- [ ] 메모리 누수 / 성능 프로파일링
- [ ] 심사 제출 → 리뷰 대응

---

## 현재 프로젝트 현황 요약

| 항목 | 현재 상태 | 앱 출시 영향 |
|------|-----------|-------------|
| 프레임워크 | Next.js 16 (App Router) | 정적 빌드 전환 필요 |
| UI | Tailwind CSS 4, 모바일 퍼스트 (480px) | 전체 너비 대응 필요 |
| 인증 | Supabase Auth (SSR 미들웨어) | 클라이언트 가드로 전환 |
| DB | Supabase (PostgreSQL) | 변경 없음 ✅ |
| 지도 | 카카오맵 SDK | 동적 로드 전환, HTTPS 명시 |
| 이미지 | Supabase Storage | 변경 없음 ✅ |
| 푸시 알림 | 없음 | 신규 구현 필요 |
| Safe Area | 부분 지원 | 보완 필요 |
| PWA | 미설정 | Capacitor 대체 |
