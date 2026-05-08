# CAKEIT Design Token System

Figma 디자인 토큰을 기반으로 구성한 CSS 변수 시스템 문서.
**Scale → Semantic** 2-tier 구조로, 테마(Light/Dark) 전환은 시멘틱 레이어에서 처리합니다.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Usage Layer (Components)                       │
│  color: var(--fg-neutral);                      │
│  background: var(--bg-neutral);                 │
│  border-color: var(--stroke-neutral);            │
└───────────────┬─────────────────────────────────┘
                │ references
┌───────────────▼─────────────────────────────────┐
│  Semantic Layer  (Light / Dark mode)            │
│  --fg-neutral: var(--scale-gray-90);   [light]  │
│  --fg-neutral: var(--scale-gray-10);   [dark]   │
└───────────────┬─────────────────────────────────┘
                │ references
┌───────────────▼─────────────────────────────────┐
│  Scale Layer  (Primitive / Constant)            │
│  --scale-gray-90: #1A1A1A;                      │
│  --scale-gray-10: #F5F5F5;                      │
└─────────────────────────────────────────────────┘
```

---

## 1. Scale Tokens (Primitives)

테마와 무관하게 고정된 원시 컬러값. 피그마 `Scale` 컬렉션과 1:1 대응.

### Gray

| Token | Hex | Swatch |
|-------|-----|--------|
| `--scale-gray-0` | `#FFFFFF` | ⬜ |
| `--scale-gray-10` | `#F5F5F5` | 🔲 |
| `--scale-gray-20` | `#E0E0E0` | 🔲 |
| `--scale-gray-30` | `#BDBDBD` | 🔲 |
| `--scale-gray-40` | `#9E9E9E` | 🔲 |
| `--scale-gray-50` | `#757575` | 🔲 |
| `--scale-gray-60` | `#616161` | 🔲 |
| `--scale-gray-70` | `#424242` | 🔲 |
| `--scale-gray-80` | `#2C2C2C` | 🔲 |
| `--scale-gray-90` | `#1A1A1A` | 🔲 |
| `--scale-gray-100` | `#000000` | ⬛ |

### Brand (Pink)

| Token | Hex |
|-------|-----|
| `--scale-brand-05` | `#FFF0F5` |
| `--scale-brand-10` | `#FFDEE9` |
| `--scale-brand-30` | `#FF99B8` |
| `--scale-brand-50` | `#FF5C8D` |
| `--scale-brand-70` | `#D9366A` |
| `--scale-brand-90` | `#8A153A` |

### Blue

| Token | Hex |
|-------|-----|
| `--scale-blue-10` | `#EFF8FF` |
| `--scale-blue-20` | `#D1E9FF` |
| `--scale-blue-30` | `#84CAFF` |
| `--scale-blue-40` | `#5296FF` |
| `--scale-blue-50` | `#148AFF` |
| `--scale-blue-60` | `#006EDD` |
| `--scale-blue-70` | `#0052A5` |
| `--scale-blue-80` | `#003872` |
| `--scale-blue-90` | `#001D3D` |

### Green

| Token | Hex |
|-------|-----|
| `--scale-green-10` | `#E6F9EE` |
| `--scale-green-20` | `#B9F0D2` |
| `--scale-green-30` | `#8CE9B2` |
| `--scale-green-40` | `#33CB73` |
| `--scale-green-50` | `#00B84D` |
| `--scale-green-60` | `#00943E` |
| `--scale-green-70` | `#006E2E` |
| `--scale-green-80` | `#00481F` |
| `--scale-green-90` | `#00240F` |

### Yellow

| Token | Hex |
|-------|-----|
| `--scale-yellow-10` | `#FFF8E1` |
| `--scale-yellow-20` | `#FFECB3` |
| `--scale-yellow-30` | `#FFE082` |
| `--scale-yellow-40` | `#FFCA28` |
| `--scale-yellow-50` | `#F29900` |
| `--scale-yellow-60` | `#D68700` |
| `--scale-yellow-70` | `#B06F00` |
| `--scale-yellow-80` | `#8A5700` |
| `--scale-yellow-90` | `#4F3200` |

### Red

| Token | Hex |
|-------|-----|
| `--scale-red-10` | `#FEF3F2` |
| `--scale-red-20` | `#FEE4E2` |
| `--scale-red-30` | `#FECDCA` |
| `--scale-red-40` | `#FDA29B` |
| `--scale-red-50` | `#F04438` |
| `--scale-red-60` | `#D92D20` |
| `--scale-red-70` | `#B42318` |
| `--scale-red-80` | `#912018` |
| `--scale-red-90` | `#2D1010` |

### Alpha (Black / White)

| Token | Value | Description |
|-------|-------|-------------|
| `--scale-black-a04` | `rgba(0,0,0,0.04)` | weak |
| `--scale-black-a08` | `rgba(0,0,0,0.08)` | weak |
| `--scale-black-a12` | `rgba(0,0,0,0.12)` | hover, disabled |
| `--scale-black-a40` | `rgba(0,0,0,0.40)` | deem |
| `--scale-black-a80` | `rgba(0,0,0,0.80)` | deem |
| `--scale-white-a04` | `rgba(255,255,255,0.04)` | weak |
| `--scale-white-a08` | `rgba(255,255,255,0.08)` | weak |
| `--scale-white-a12` | `rgba(255,255,255,0.12)` | hover, disabled |
| `--scale-white-a40` | `rgba(255,255,255,0.40)` | deem |
| `--scale-white-a80` | `rgba(255,255,255,0.80)` | deem |

### Radius

| Token | Value |
|-------|-------|
| `--radius-xs` | `4px` |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-xl` | `24px` |
| `--radius-full` | `999px` |

---

## 2. Semantic Tokens (Light / Dark)

용도(fg, bg, stroke)에 따라 이름이 부여되며, 테마에 따라 스케일 참조가 바뀜.

### Foreground (`fg`)

| Semantic Token | Light (Scale Ref → Hex) | Dark (Scale Ref → Hex) | 용도 |
|---------------|------------------------|------------------------|------|
| `--fg-neutral` | gray-90 → `#1A1A1A` | gray-10 → `#F5F5F5` | 기본 텍스트 |
| `--fg-neutral-muted` | gray-60 → `#616161` | gray-40 → `#9E9E9E` | 보조 텍스트 |
| `--fg-neutral-subtle` | gray-40 → `#9E9E9E` | gray-60 → `#616161` | 미묘한 텍스트 |
| `--fg-neutral-faint` | gray-30 → `#BDBDBD` | gray-70 → `#424242` | 비활성/힌트 |
| `--fg-inverse` | gray-0 → `#FFFFFF` | gray-100 → `#000000` | 반전 텍스트 |
| `--fg-danger` | red-50 → `#F04438` | red-50 → `#F04438` | 에러/위험 |
| `--fg-brand` | brand-50 → `#FF5C8D` | brand-50 → `#FF5C8D` | 브랜드 강조 |

### Background (`bg`)

| Semantic Token | Light (Scale Ref → Hex) | Dark (Scale Ref → Hex) | 용도 |
|---------------|------------------------|------------------------|------|
| `--bg-neutral-under` | gray-10 → `#F5F5F5` | gray-100 → `#000000` | 최하단 배경 |
| `--bg-neutral` | gray-0 → `#FFFFFF` | gray-90 → `#1A1A1A` | 기본 배경 |
| `--bg-neutral-elevated` | gray-0 → `#FFFFFF` | gray-80 → `#2C2C2C` | 카드/시트 |
| `--bg-overlay-weak` | black-a04 | white-a04 | 약한 오버레이 |
| `--bg-overlay` | black-a08 | white-a08 | 기본 오버레이 |
| `--bg-overlay-deep` | black-a12 | white-a12 | 깊은 오버레이 |
| `--bg-overlay-deem` | black-a40 | white-a40 | 딤 배경 |
| `--bg-brand` | brand-50 → `#FF5C8D` | brand-50 → `#FF5C8D` | 브랜드 배경 |
| `--bg-brand-weak` | brand-05 → `#FFF0F5` | brand-90 → `#8A153A` | 브랜드 약한 배경 |
| `--bg-inversed` | gray-90 → `#1A1A1A` | gray-0 → `#FFFFFF` | 반전 배경 |
| `--bg-danger` | red-50 → `#F04438` | red-50 → `#F04438` | 위험 배경 |
| `--bg-danger-weak` | red-10 → `#FEF3F2` | red-80 → `#912018` | 위험 약한 배경 |
| `--bg-success` | green-50 → `#00B84D` | green-50 → `#00B84D` | 성공 배경 |
| `--bg-success-weak` | green-10 → `#E6F9EE` | green-70 → `#006E2E` | 성공 약한 배경 |
| `--bg-informative` | blue-50 → `#148AFF` | blue-50 → `#148AFF` | 정보 배경 |
| `--bg-informative-weak` | blue-10 → `#EFF8FF` | blue-80 → `#003872` | 정보 약한 배경 |

### Stroke (`stroke`)

| Semantic Token | Light (Scale Ref → Hex) | Dark (Scale Ref → Hex) | 용도 |
|---------------|------------------------|------------------------|------|
| `--stroke-neutral` | black-a08 | white-a08 | 기본 보더 |
| `--stroke-neutral-weak` | black-a04 | white-a04 | 약한 보더 |
| `--stroke-neutral-deep` | black-a12 | white-a12 | 깊은 보더 |
| `--stroke-neutral-contrast` | black-a80 | white-a80 | 강한 보더 |
| `--stroke-brand` | brand-50 → `#FF5C8D` | brand-50 → `#FF5C8D` | 브랜드 보더 |
| `--stroke-brand-weak` | brand-30 → `#FF99B8` | brand-90 → `#8A153A` | 브랜드 약한 보더 |
| `--stroke-danger` | red-50 → `#F04438` | red-50 → `#F04438` | 위험 보더 |
| `--stroke-danger-weak` | red-10 → `#FEF3F2` | red-90 → `#2D1010` | 위험 약한 보더 |

---

## 3. 사용법

### CSS에서 사용
```css
/* 컴포넌트에서 시멘틱 토큰만 사용 */
.card {
  background: var(--bg-neutral-elevated);
  color: var(--fg-neutral);
  border: 1px solid var(--stroke-neutral);
  border-radius: var(--radius-lg);
}

.error-message {
  color: var(--fg-danger);
  background: var(--bg-danger-weak);
  border: 1px solid var(--stroke-danger);
}
```

### 다크모드 전환
```css
/* prefers-color-scheme 자동 전환 */
@media (prefers-color-scheme: dark) {
  :root { /* dark 토큰 적용 */ }
}

/* 또는 data-theme 속성으로 수동 전환 */
[data-theme="dark"] { /* dark 토큰 적용 */ }
```

> [!IMPORTANT]
> 컴포넌트에서는 **시멘틱 토큰만** 사용합니다.
> Scale 토큰을 직접 참조하지 마세요 — 테마 전환이 깨집니다.

---

## 4. 파일 구조

```
src/app/
├── tokens.css          ← Scale + Semantic 변수 정의
└── globals.css         ← tokens.css import 후 사용
```
