'use client';

import React, { useEffect, useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createDataClient } from '@/lib/supabase/client';
import type { ShopWithImages } from '@/lib/types';
import { CAKE_TYPE_OPTIONS } from '@/lib/types';
import { MagnifyingGlassIcon } from '@/components/icons';
import ShopListCard from '@/components/ShopListCard';
import type { ShopListCardShop } from '@/components/ShopListCard';

/* ─── Slug → Label mapping ─── */
const SLUG_TO_LABEL: Record<string, string> = {};
for (const t of CAKE_TYPE_OPTIONS) {
  SLUG_TO_LABEL[encodeURIComponent(t)] = t;
  SLUG_TO_LABEL[t] = t;
}

/* ─── Filter pill options (피그마 기준) ─── */
const FILTER_PILLS = [
  { key: 'sort', label: '정렬', hasDropdown: true },
  { key: 'date', label: '날짜', hasDropdown: true },
  { key: 'size', label: '사이즈', hasDropdown: true },
  { key: 'today', label: '오늘주문' },
  { key: 'delivery', label: '배달가능' },
];

interface ShopWithExtras extends ShopWithImages {
  is_custom_order?: boolean;
  shop_gallery_images?: { url: string }[];
  shop_menus?: {
    name: string;
    shop_menu_sizes?: { price_min: number }[];
  }[];
  shop_popularity?: { score: number }[];
  _popularity?: number;
}

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const label = SLUG_TO_LABEL[slug] || decodeURIComponent(slug);

  const [shops, setShops] = useState<ShopWithExtras[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

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
      try {
        const baseSelect =
          '*, images(id, url, alt_text, is_primary, position, source), shop_gallery_images(url), shop_menus(name, shop_menu_sizes(price_min))';

        const isAll = label === '전체';

        let query = client
          .from('shops')
          .select(`${baseSelect}, shop_popularity(score)`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!isAll) {
          query = query.contains('cake_types', [label]);
        }

        const { data, error } = await query;

        if (error) {
          // Fallback without popularity
          let fallback = client
            .from('shops')
            .select(baseSelect)
            .order('created_at', { ascending: false })
            .limit(50);
          if (!isAll) {
            fallback = fallback.contains('cake_types', [label]);
          }
          const result = await fallback;
          if (result.data) {
            setShops(result.data.map((s: any) => ({ ...s, _popularity: 0 })));
          }
        } else if (data) {
          setShops(
            data.map((s: any) => ({
              ...s,
              _popularity: s.shop_popularity?.[0]?.score ?? 0,
            }))
          );
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchShops();
  }, [label]);

  const toggleFilter = (key: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredShops = useMemo(() => {
    let result = [...shops];

    if (activeFilters.has('today')) {
      // Filter shops open today (simplified — always show for now)
    }
    if (activeFilters.has('delivery')) {
      result = result.filter((s) => s.is_delivery);
    }

    // Sort by popularity by default
    result.sort((a, b) => (b._popularity || 0) - (a._popularity || 0));

    return result;
  }, [shops, activeFilters]);

  return (
    <div className="min-h-screen bg-white">
      {/* ─── GNB ─── */}
      <nav className="sticky top-0 z-50 bg-white">
        <div className="flex h-[52px] items-center px-4">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[rgba(0,0,0,0.04)] transition-colors active:scale-95"
          >
            <svg
              className="h-6 w-6 text-[rgba(0,0,0,0.94)]"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Title */}
          <div className="flex-1 text-center">
            <span className="text-[16px] font-semibold text-[rgba(0,0,0,0.94)] leading-[1.25]">
              {label === '전체' ? '전체 베이커리' : `${label} 케이크`}
            </span>
          </div>

          {/* Search */}
          <Link
            href="/search"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[rgba(0,0,0,0.04)] transition-colors"
          >
            <MagnifyingGlassIcon className="h-6 w-6 text-[rgba(0,0,0,0.94)]" />
          </Link>
        </div>
      </nav>

      {/* ─── Filter bar (피그마: gap-4px, px-16px, py-8px) ─── */}
      <div
        className="flex items-center overflow-x-auto"
        style={{ gap: '4px', padding: '8px 16px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill.key}
            onClick={() => toggleFilter(pill.key)}
            className={`flex items-center shrink-0 transition-all active:scale-95`}
            style={{
              gap: '2px',
              padding: '8px 12px',
              borderRadius: '999px',
              border: activeFilters.has(pill.key) ? '1px solid var(--scale-gray-90)' : '1px solid rgba(0,0,0,0.08)',
              background: activeFilters.has(pill.key) ? 'var(--scale-gray-90)' : 'white',
              color: activeFilters.has(pill.key) ? 'white' : 'var(--scale-gray-90)',
              fontSize: '14px',
              fontWeight: 400,
              lineHeight: '1.25',
              whiteSpace: 'nowrap' as const,
              maxHeight: '36px',
              minHeight: '36px',
            }}
          >
            {pill.label}
            {pill.hasDropdown && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4.5 6L8 9.5L11.5 6"
                  stroke={activeFilters.has(pill.key) ? 'white' : 'var(--scale-gray-90)'}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* ─── Shop list ─── */}
      <div className="flex flex-col gap-4 px-4 py-3">
        {loading ? (
          /* Skeleton */
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-fade-in">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="w-[96px] h-[96px] rounded bg-surface-100 animate-shimmer shrink-0" />
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-5 w-3/4 animate-shimmer rounded" />
                <div className="h-3 w-1/2 animate-shimmer rounded" />
                <div className="h-3 w-2/3 animate-shimmer rounded" />
              </div>
              <div className="h-px bg-[rgba(0,0,0,0.12)] mt-4" />
            </div>
          ))
        ) : filteredShops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-50">
              <span className="text-3xl">🍰</span>
            </div>
            <h3 className="text-[15px] font-semibold text-surface-900">
              아직 {label} 케이크 가게가 없어요
            </h3>
            <p className="mt-1 text-[13px] text-surface-400">
              곧 등록될 예정이에요!
            </p>
          </div>
        ) : (
          filteredShops.map((shop, index) => (
            <React.Fragment key={shop.id}>
              <ShopListCard
                shop={shop as ShopListCardShop}
                showDivider={false}
              />
              {index < filteredShops.length - 1 && (
                <div className="slc-divider" />
              )}
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}
