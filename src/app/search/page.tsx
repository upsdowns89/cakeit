'use client';

import { useEffect, useState, useMemo, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createDataClient } from '@/lib/supabase/client';
import type { ShopWithImages, SearchFilters } from '@/lib/types';
import { CAKE_TYPE_OPTIONS } from '@/lib/types';
import ShopListCard, { type ShopListCardShop } from '@/components/ShopListCard';
import {
  MagnifyingGlassIcon,
  TruckIcon,
  CalendarIcon,
  CurrencyIcon,
  XMarkIcon,
  AdjustmentsIcon,
  ChevronDownIcon,
  ClockIcon,
  FireIcon,
  MapPinIcon,
} from '@/components/icons';



const SEOUL_REGIONS = [
  '전체', '강남구', '강동구', '강북구', '강서구', '관악구', '광진구',
  '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구',
  '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구',
  '용산구', '은평구', '종로구', '중구', '중랑구',
];

const PRICE_RANGES = [
  { label: '전체', value: 'all' },
  { label: '~2만원', value: '0-20000' },
  { label: '2~4만원', value: '20000-40000' },
  { label: '4~7만원', value: '40000-70000' },
  { label: '7만원~', value: '70000-' },
];

const TIME_SLOTS = [
  '시간 무관',
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

const CAKE_CATEGORIES = CAKE_TYPE_OPTIONS
  .filter(t => t !== '기타')
  .map(t => ({ key: t, label: t }));

type SortOption = 'popular' | 'distance' | 'price_low' | 'price_high';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'popular', label: '인기순' },
  { key: 'distance', label: '가까운순' },
  { key: 'price_low', label: '낮은가격순' },
  { key: 'price_high', label: '높은가격순' },
];

const DEFAULT_FILTERS: SearchFilters = {
  serviceType: 'all',
  date: null,
  time: null,
  region: '전체',
  priceRange: 'all',
  query: '',
  cakeCategory: null,
};

interface ShopWithExtras extends ShopWithImages {
  shop_menus?: {
    id: string;
    shop_menu_sizes?: { price_min: number; price_max: number | null }[];
  }[];
  shop_gallery_images?: { id: string; url: string }[];
  reviews?: { id: string }[];
  shop_popularity?: { score: number }[];
  _popularity?: number;
  _minPrice?: number | null;
  _maxPrice?: number | null;
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── Price range helper (for sort) ─── */
function getPriceRange(shop: ShopWithExtras): { min: number; max: number } | null {
  const menus = shop.shop_menus;
  if (!menus || menus.length === 0) return null;
  let gMin = Infinity, gMax = -Infinity;
  for (const m of menus) {
    if (!m.shop_menu_sizes) continue;
    for (const s of m.shop_menu_sizes) {
      if (s.price_min < gMin) gMin = s.price_min;
      const mx = s.price_max ?? s.price_min;
      if (mx > gMax) gMax = mx;
    }
  }
  if (gMin === Infinity) return null;
  return { min: gMin, max: gMax };
}

/* ─── Recent Search helpers ─── */
const RECENT_SEARCH_KEY = 'everycake_recent_searches';
const MAX_RECENT = 10;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addRecentSearch(query: string) {
  if (!query.trim()) return;
  const prev = getRecentSearches().filter(q => q !== query.trim());
  const next = [query.trim(), ...prev].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
}

function removeRecentSearch(query: string) {
  const next = getRecentSearches().filter(q => q !== query);
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCH_KEY);
}

/* ─── Recommended Keywords ─── */
const RECOMMENDED_KEYWORDS = [
  '레터링 케이크', '생일 케이크', '웨딩 케이크', '포토 케이크',
  '캐릭터 케이크', '도시락 케이크', '강남', '홍대', '성수',
  '당일 픽업', '배달 케이크',
];

/* ─── Main Search Content ─── */
function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [shops, setShops] = useState<ShopWithExtras[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Determine if user has actively searched
  const initialQuery = searchParams.get('q') || '';
  const hasUrlParams = searchParams.get('q') || searchParams.get('region') || searchParams.get('type') || searchParams.get('category') || searchParams.get('sort');
  const [hasSearched, setHasSearched] = useState(!!hasUrlParams);

  const [filters, setFilters] = useState<SearchFilters>(() => ({
    ...DEFAULT_FILTERS,
    query: initialQuery,
    region: searchParams.get('region') || '전체',
    serviceType: (searchParams.get('type') as SearchFilters['serviceType']) || 'all',
    cakeCategory: searchParams.get('category') || null,
  }));

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load recent searches & auto-focus
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    // Auto-focus search input if no active search
    if (!hasSearched) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get user geolocation
  useEffect(() => {
    if (sortBy === 'distance' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: 37.5665, lng: 126.978 }),
        { timeout: 5000 }
      );
    }
  }, [sortBy]);

  useEffect(() => {
    let client: ReturnType<typeof createDataClient> | null = null;
    try {
      client = createDataClient();
    } catch {
      setLoading(false);
      return;
    }

    async function fetchShops() {
      if (!client) return;

      // Try with shop_popularity join first, fallback without if table doesn't exist
      let data: any[] | null = null;
      const baseSelect = `*, images(id, url, alt_text, is_primary, position, source), shop_gallery_images(id, url), shop_menus(id, shop_menu_sizes(price_min, price_max)), reviews:reviews(id)`;

      const withPop = await client
        .from('shops')
        .select(`${baseSelect}, shop_popularity(score)`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (withPop.error) {
        // shop_popularity table may not exist yet — query without it
        const fallback = await client.from('shops').select(baseSelect).order('created_at', { ascending: false }).limit(50);
        data = fallback.data;
      } else {
        data = withPop.data;
      }

      if (data) {
        const enriched = data.map((shop: any) => {
          const priceRange = getPriceRange(shop);
          const popRow = shop.shop_popularity?.[0];
          return {
            ...shop,
            _popularity: popRow?.score ?? 0,
            _minPrice: priceRange?.min ?? null,
            _maxPrice: priceRange?.max ?? null,
          };
        });
        setShops(enriched);
      }
      setLoading(false);
    }

    fetchShops();
  }, []);

  const updateURL = useCallback((newFilters: SearchFilters) => {
    const params = new URLSearchParams();
    if (newFilters.query) params.set('q', newFilters.query);
    if (newFilters.region && newFilters.region !== '전체') params.set('region', newFilters.region);
    if (newFilters.serviceType !== 'all') params.set('type', newFilters.serviceType);
    if (newFilters.priceRange !== 'all') params.set('price', newFilters.priceRange);
    if (newFilters.date) params.set('date', newFilters.date);
    if (newFilters.time && newFilters.time !== '시간 무관') params.set('time', newFilters.time);
    if (newFilters.cakeCategory) params.set('category', newFilters.cakeCategory);
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  }, [router]);

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      updateURL(next);
      return next;
    });
  }, [updateURL]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    router.replace('/search', { scroll: false });
  }, [router]);

  const filteredShops = useMemo(() => {
    const result = shops.filter((shop) => {
      if (filters.query) {
        const q = filters.query.toLowerCase();
        const matchesText =
          shop.name.toLowerCase().includes(q) ||
          shop.description?.toLowerCase().includes(q) ||
          shop.address?.toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      if (filters.serviceType === 'pickup' && !shop.is_pickup) return false;
      if (filters.serviceType === 'delivery' && !shop.is_delivery) return false;
      if (filters.region && filters.region !== '전체') {
        if (!shop.address?.includes(filters.region) && shop.region !== filters.region) return false;
      }
      if (filters.priceRange && filters.priceRange !== 'all') {
        const [minStr, maxStr] = filters.priceRange.split('-');
        const filterMax = maxStr ? parseInt(maxStr) : Infinity;
        if (shop.min_order_price != null && shop.min_order_price > filterMax) return false;
      }
      if (filters.date) {
        const selectedDate = new Date(filters.date);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[selectedDate.getDay()];
        if (shop.business_hours) {
          const hours = shop.business_hours[dayName];
          if (hours?.closed) return false;
        }
      }
      if (filters.time && filters.time !== '시간 무관' && shop.business_hours) {
        const day = filters.date ? new Date(filters.date) : new Date();
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[day.getDay()];
        const hours = shop.business_hours[dayName];
        if (hours && !hours.closed) {
          if (filters.time < hours.open || filters.time > hours.close) return false;
        }
      }
      if (filters.cakeCategory) {
        if (!shop.cake_types || !shop.cake_types.includes(filters.cakeCategory)) return false;
      }
      return true;
    });

    // Apply sorting
    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => (b._popularity || 0) - (a._popularity || 0));
        break;
      case 'distance':
        if (userLocation) {
          result.sort((a, b) => {
            const distA = a.lat != null && a.lng != null
              ? getDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) : Infinity;
            const distB = b.lat != null && b.lng != null
              ? getDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng) : Infinity;
            return distA - distB;
          });
        }
        break;
      case 'price_low':
        result.sort((a, b) => (a._minPrice ?? Infinity) - (b._minPrice ?? Infinity));
        break;
      case 'price_high':
        result.sort((a, b) => (b._maxPrice ?? -Infinity) - (a._maxPrice ?? -Infinity));
        break;
    }

    return result;
  }, [shops, filters, sortBy, userLocation]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.serviceType !== 'all') count++;
    if (filters.date) count++;
    if (filters.time && filters.time !== '시간 무관') count++;
    if (filters.region !== '전체') count++;
    if (filters.priceRange !== 'all') count++;
    if (filters.cakeCategory) count++;
    return count;
  }, [filters]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Search Header */}
      <div className="sticky top-14 z-40 border-b border-surface-200 bg-white/95 backdrop-blur-xl">
        <div className="px-4">
          {/* Search Input Row */}
          <div className="flex items-center gap-2 py-2.5">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="가게 이름, 지역으로 검색..."
                value={filters.query}
                onChange={(e) => handleFilterChange('query', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filters.query.trim()) {
                    addRecentSearch(filters.query.trim());
                    setRecentSearches(getRecentSearches());
                    setHasSearched(true);
                    searchInputRef.current?.blur();
                  }
                }}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-9 pr-8 text-sm text-surface-900 placeholder:text-surface-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
              />
              {filters.query && (
                <button
                  onClick={() => {
                    handleFilterChange('query', '');
                    setHasSearched(false);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-1 rounded-xl border px-2.5 py-2.5 text-xs font-medium transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-surface-200 bg-white text-surface-600'
              }`}
            >
              <AdjustmentsIcon className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter Bar */}
          <div className={`overflow-hidden transition-all duration-300 ${showFilters ? 'max-h-[600px] pb-4' : 'max-h-0'}`}>
            <div className="space-y-3">
              {/* Service Type */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-surface-500">
                  <TruckIcon className="h-3.5 w-3.5" />
                  수령 방식
                </label>
                <div className="flex overflow-hidden rounded-lg border border-surface-200">
                  {(['all', 'pickup', 'delivery'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleFilterChange('serviceType', type)}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
                        filters.serviceType === type
                          ? 'bg-primary-500 text-white'
                          : 'bg-white text-surface-600'
                      } ${type !== 'all' ? 'border-l border-surface-200' : ''}`}
                    >
                      {type === 'all' ? '전체' : type === 'pickup' ? '픽업' : '배달'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-surface-500">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    날짜
                  </label>
                  <input
                    type="date"
                    value={filters.date || ''}
                    min={today}
                    onChange={(e) => handleFilterChange('date', e.target.value || null)}
                    className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs text-surface-700 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-surface-500">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    시간
                  </label>
                  <select
                    value={filters.time || '시간 무관'}
                    onChange={(e) => handleFilterChange('time', e.target.value === '시간 무관' ? null : e.target.value)}
                    className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs text-surface-700 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Region */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-surface-500">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  지역
                </label>
                <select
                  value={filters.region}
                  onChange={(e) => handleFilterChange('region', e.target.value)}
                  className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs text-surface-700 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                >
                  {SEOUL_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-surface-500">
                  <CurrencyIcon className="h-3.5 w-3.5" />
                  가격대
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRICE_RANGES.map((range) => (
                    <button
                      key={range.value}
                      onClick={() => handleFilterChange('priceRange', range.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        filters.priceRange === range.value
                          ? 'bg-primary-500 text-white shadow-sm'
                          : 'border border-surface-200 bg-white text-surface-600'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset */}
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="w-full rounded-lg border border-surface-200 py-2 text-xs font-medium text-surface-500 hover:bg-surface-100 transition-all"
                >
                  필터 초기화
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {!hasSearched ? (
        /* ─── Pre-search state: Recent + Recommended ─── */
        <div className="px-4 py-5">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4 text-surface-400" />
                  <h3 className="text-sm font-bold text-surface-800">최근 검색</h3>
                </div>
                <button
                  onClick={() => {
                    clearRecentSearches();
                    setRecentSearches([]);
                  }}
                  className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
                >
                  전체 삭제
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((q) => (
                  <div key={q} className="flex items-center gap-1 rounded-full border border-surface-200 bg-white pl-3 pr-1.5 py-1.5 transition-colors hover:border-surface-300">
                    <button
                      onClick={() => {
                        handleFilterChange('query', q);
                        addRecentSearch(q);
                        setRecentSearches(getRecentSearches());
                        setHasSearched(true);
                      }}
                      className="text-xs text-surface-700"
                    >
                      {q}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(q);
                        setRecentSearches(getRecentSearches());
                      }}
                      className="rounded-full p-0.5 text-surface-300 hover:bg-surface-100 hover:text-surface-500"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Keywords */}
          <div>
            <div className="mb-3 flex items-center gap-1.5">
              <FireIcon className="h-4 w-4 text-orange-400" />
              <h3 className="text-sm font-bold text-surface-800">추천 검색어</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {RECOMMENDED_KEYWORDS.map((keyword) => (
                <button
                  key={keyword}
                  onClick={() => {
                    handleFilterChange('query', keyword);
                    addRecentSearch(keyword);
                    setRecentSearches(getRecentSearches());
                    setHasSearched(true);
                  }}
                  className="rounded-full border border-surface-200 bg-white px-3 py-1.5 text-xs text-surface-600 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 active:scale-95"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>

          {/* Search Tips */}
          <div className="mt-8 rounded-2xl bg-surface-50 p-4">
            <p className="text-xs font-semibold text-surface-600 mb-2">💡 검색 팁</p>
            <ul className="space-y-1">
              <li className="text-[11px] text-surface-400">• 케이크 종류로 검색해보세요 (레터링, 포토, 캐릭터)</li>
              <li className="text-[11px] text-surface-400">• 지역명으로 가까운 가게를 찾아보세요</li>
              <li className="text-[11px] text-surface-400">• 가게 이름을 직접 검색할 수도 있어요</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4">
        {/* Results Count + Sort */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-surface-500">
            {loading ? (
              <span className="inline-block h-4 w-24 animate-shimmer rounded" />
            ) : (
              <>
                총{' '}
                <span className="font-semibold text-primary-600">{filteredShops.length}</span>
                개의 가게
                {activeFilterCount > 0 && (
                  <span className="ml-1 text-surface-400">(필터 {activeFilterCount}개)</span>
                )}
              </>
            )}
          </p>

          {/* Sort Dropdown */}
          <div ref={sortRef} className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1 text-xs font-medium text-surface-600"
            >
              {SORT_OPTIONS.find(s => s.key === sortBy)?.label}
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
            {showSortDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 w-32 rounded-xl border border-surface-200 bg-white py-1 shadow-lg">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortBy(opt.key); setShowSortDropdown(false); }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                      sortBy === opt.key
                        ? 'bg-primary-50 font-semibold text-primary-600'
                        : 'text-surface-600 hover:bg-surface-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* List View */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-48 animate-shimmer rounded-2xl" />
                <div className="mt-2.5 space-y-1.5">
                  <div className="h-5 w-3/4 animate-shimmer rounded" />
                  <div className="h-3 w-1/2 animate-shimmer rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface-300 bg-white px-6 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100">
              <MagnifyingGlassIcon className="h-7 w-7 text-surface-400" />
            </div>
            <h2 className="text-base font-semibold text-surface-900">
              조건에 맞는 가게가 없어요
            </h2>
            <p className="mt-1 text-sm text-surface-500">
              필터를 변경해서 다시 검색해보세요
            </p>
            <button
              onClick={resetFilters}
              className="mt-4 rounded-xl bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredShops.map((shop, index) => {
              const cardShop: ShopListCardShop = {
                id: shop.id,
                name: shop.name,
                address: shop.address,
                district: shop.district,
                area: shop.area,
                is_delivery: shop.is_delivery,
                is_pickup: shop.is_pickup,
                is_custom_order: (shop as any).is_custom_order,
                cake_types: shop.cake_types,
                images: shop.images,
                shop_gallery_images: shop.shop_gallery_images,
                shop_menus: shop.shop_menus as ShopListCardShop['shop_menus'],
              };
              return (
                <ShopListCard
                  key={shop.id}
                  shop={cardShop}
                  showDivider={index < filteredShops.length - 1}
                />
              );
            })}
          </div>
        )}
        </div>
      )}


    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="mt-3 text-sm text-surface-500">로딩 중...</p>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
