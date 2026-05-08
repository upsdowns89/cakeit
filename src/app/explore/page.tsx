'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createDataClient } from '@/lib/supabase/client';
import type { ShopWithImages } from '@/lib/types';
import { getShopImageUrl, CAKE_TYPE_OPTIONS } from '@/lib/types';
import {
  CakeIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  TruckIcon,
  SparklesIcon,
  FireIcon,
  ChevronRightIcon,
} from '@/components/icons';

/* ─── Grid Category definitions (cake types, 기타 제외) ─── */
const CAKE_TYPE_EMOJIS: Record<string, string> = {
  '레터링': '✍️',
  '입체': '🧊',
  '일러스트': '🎨',
  '포토': '📸',
  '플라워': '🌸',
  '피규어': '🧸',
  '2단': '🎂',
  '특수': '🧩',
  '도시락': '🍱',
};

const GRID_CATEGORIES = [
  { key: 'all', label: '전체', emoji: '🎂', href: '/explore/category/%EC%A0%84%EC%B2%B4' },
  ...CAKE_TYPE_OPTIONS
    .filter(t => t !== '기타')
    .map(t => ({
      key: t,
      label: t,
      emoji: CAKE_TYPE_EMOJIS[t] || '🍰',
      href: `/explore/category/${encodeURIComponent(t)}`,
    })),
];

/* ─── Extended shop type with menu prices ─── */
interface ShopWithMenuPrices extends ShopWithImages {
  shop_menus?: {
    id: string;
    shop_menu_sizes?: { price_min: number; price_max: number | null }[];
  }[];
  shop_popularity?: { score: number }[];
  _popularity?: number;
}

/* ─── Horizontal Carousel ─── */
function HorizontalCarousel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className={`flex gap-3 overflow-x-auto scroll-smooth px-4 pb-1 ${className}`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      {children}
    </div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({
  icon: Icon,
  title,
  href,
  iconColor = 'text-primary-500',
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 pb-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <h2 className="text-[15px] font-bold text-surface-900">{title}</h2>
      </div>
      <Link
        href={href}
        className="flex items-center gap-0.5 text-xs font-medium text-surface-400 transition-colors hover:text-surface-600"
      >
        전체보기
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ─── Helper: extract short area name from address ─── */
function getShortArea(shop: ShopWithImages): string {
  if (shop.area) return shop.area;
  if (shop.district) return shop.district;
  if (shop.address) {
    const match = shop.address.match(/([가-힣]+[시군구])\s*([가-힣]+[구동면읍])/);
    if (match) {
      const gu = match[2].replace(/[구동면읍]$/, '');
      return gu;
    }
  }
  return '';
}

/* ─── Helper: get price range from menus ─── */
function getMenuPriceRange(shop: ShopWithMenuPrices): { min: number; max: number } | null {
  const menus = shop.shop_menus;
  if (!menus || menus.length === 0) return null;

  let globalMin = Infinity;
  let globalMax = -Infinity;

  for (const menu of menus) {
    if (!menu.shop_menu_sizes || menu.shop_menu_sizes.length === 0) continue;
    for (const size of menu.shop_menu_sizes) {
      if (size.price_min < globalMin) globalMin = size.price_min;
      const maxVal = size.price_max ?? size.price_min;
      if (maxVal > globalMax) globalMax = maxVal;
    }
  }

  if (globalMin === Infinity) return null;
  return { min: globalMin, max: globalMax };
}

/* ─── Helper: format price range as 만원 string ─── */
function formatPriceRange(range: { min: number; max: number }): string {
  const fmtShort = (v: number) => {
    if (v >= 10000) {
      const m = v / 10000;
      return m % 1 === 0 ? `${m}만원` : `${m.toFixed(1)}만원`;
    }
    return `${v.toLocaleString()}원`;
  };
  if (range.min === range.max) return fmtShort(range.min);
  return `${fmtShort(range.min)}-${fmtShort(range.max)}`;
}

/* ─── Shop Item (thumbnail + text layout) ─── */
function ShopItem({ shop, index }: { shop: ShopWithMenuPrices; index: number }) {
  const imageUrl = getShopImageUrl(shop);
  const shortArea = getShortArea(shop);
  const priceRange = getMenuPriceRange(shop);

  return (
    <Link
      href={`/shop/${shop.id}`}
      className="animate-fade-in group flex-shrink-0"
      style={{ animationDelay: `${index * 0.05}s`, width: '150px' }}
    >
      {/* Thumbnail */}
      <div className="relative h-[150px] w-[150px] overflow-hidden rounded-2xl bg-surface-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={shop.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CakeIcon className="h-10 w-10 text-surface-300" />
          </div>
        )}
      </div>

      {/* Text group */}
      <div className="mt-2">
        <h3 className="truncate text-[13px] font-bold text-surface-900">{shop.name}</h3>
        <div className="mt-0.5 flex items-center gap-1.5">
          {shortArea && (
            <span className="text-[11px] text-surface-400">{shortArea}</span>
          )}
          {shortArea && priceRange && (
            <span className="text-[11px] text-surface-300">·</span>
          )}
          {priceRange && (
            <span className="text-[11px] font-semibold text-primary-600">
              {formatPriceRange(priceRange)}
            </span>
          )}
        </div>
        {/* Tags */}
        {(shop.is_delivery || shop.is_pickup) && (
          <div className="mt-1.5 flex gap-1">
            {shop.is_pickup && (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                픽업
              </span>
            )}
            {shop.is_delivery && (
              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                배달
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

/* ─── Main Page ─── */
export default function ExplorePage() {
  const router = useRouter();
  const [shops, setShops] = useState<ShopWithMenuPrices[]>([]);
  const [loading, setLoading] = useState(true);

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
        const baseSelect = '*, images(id, url, alt_text, is_primary, position, source), shop_menus(id, shop_menu_sizes(price_min, price_max))';

        // Try with shop_popularity join, fallback without
        const withPop = await client
          .from('shops')
          .select(`${baseSelect}, shop_popularity(score)`)
          .order('created_at', { ascending: false })
          .limit(20);

        let data: any[] | null;
        if (withPop.error) {
          const fallback = await client.from('shops').select(baseSelect).order('created_at', { ascending: false }).limit(20);
          data = fallback.data;
        } else {
          data = withPop.data;
        }

        if (data) {
          const enriched = data.map((shop: any) => ({
            ...shop,
            _popularity: shop.shop_popularity?.[0]?.score ?? 0,
          }));
          setShops(enriched);
        }
      } catch (err) {
        console.error('Failed to fetch shops:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchShops();
  }, []);

  // Split shops for different sections
  const popularShops = [...shops].sort((a, b) => (b._popularity || 0) - (a._popularity || 0)).slice(0, 6);
  const newShops = [...shops].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);
  const deliveryShops = shops.filter((s) => s.is_delivery).slice(0, 6);

  /* ─── Skeleton Item ─── */
  const SkeletonItem = () => (
    <div className="w-[150px] flex-shrink-0">
      <div className="h-[150px] w-[150px] animate-shimmer rounded-2xl" />
      <div className="mt-2 space-y-1.5">
        <div className="h-4 w-3/4 animate-shimmer rounded" />
        <div className="h-3 w-1/2 animate-shimmer rounded" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* ─── Search Bar (sticky) ─── */}
      <section className="sticky top-14 z-40 border-b border-surface-200/60 bg-white px-4 py-2.5">
        <button
          onClick={() => router.push('/search')}
          className="flex w-full items-center gap-3 rounded-full border border-surface-200 bg-surface-50 py-2.5 pl-4 pr-4 text-left transition-all hover:border-surface-300 active:scale-[0.99]"
        >
          <MagnifyingGlassIcon className="h-5 w-5 flex-shrink-0 text-surface-400" />
          <span className="text-sm text-surface-400">어떤 케이크를 찾으세요?</span>
        </button>
      </section>

      {/* ─── Grid Buttons Section (5×2 grid) ─── */}
      <section id="grid-buttons-section" className="border-b border-surface-200/60 px-4 py-4">
        <div className="grid grid-cols-5 gap-x-2 gap-y-3">
          {GRID_CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              href={cat.href}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-50 text-2xl transition-colors hover:bg-surface-100">
                {cat.emoji}
              </div>
              <span className="text-[11px] font-medium text-surface-700">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── 인기 가게 Section ─── */}
      <section id="popular-stores" className="pt-5 pb-2">
        <SectionHeader icon={FireIcon} title="지금 인기있는 가게" href="/search?sort=popular" iconColor="text-orange-500" />
        {loading ? (
          <HorizontalCarousel>
            {[1, 2, 3].map((i) => <SkeletonItem key={i} />)}
          </HorizontalCarousel>
        ) : popularShops.length === 0 ? (
          <EmptyState />
        ) : (
          <HorizontalCarousel>
            {popularShops.map((shop, i) => (
              <ShopItem key={shop.id} shop={shop} index={i} />
            ))}
          </HorizontalCarousel>
        )}
      </section>

      {/* ─── 새로 입점한 가게 Section ─── */}
      <section id="new-arrival-stores" className="pt-4 pb-2">
        <SectionHeader icon={SparklesIcon} title="새로 입점한 가게" href="/search?sort=newest" iconColor="text-violet-500" />
        {loading ? (
          <HorizontalCarousel>
            {[1, 2, 3].map((i) => <SkeletonItem key={i} />)}
          </HorizontalCarousel>
        ) : newShops.length === 0 ? (
          <EmptyState />
        ) : (
          <HorizontalCarousel>
            {newShops.map((shop, i) => (
              <ShopItem key={shop.id} shop={shop} index={i} />
            ))}
          </HorizontalCarousel>
        )}
      </section>

      {/* ─── 배달 가능 가게 Section ─── */}
      <section id="delivery-available-stores" className="pt-4 pb-4">
        <SectionHeader icon={TruckIcon} title="배달 가능한 가게" href="/search?type=delivery" iconColor="text-blue-500" />
        {loading ? (
          <HorizontalCarousel>
            {[1, 2, 3].map((i) => <SkeletonItem key={i} />)}
          </HorizontalCarousel>
        ) : deliveryShops.length === 0 ? (
          <div className="px-4">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-300 bg-surface-50/50 px-4 py-8 text-center">
              <TruckIcon className="mb-2 h-8 w-8 text-surface-300" />
              <p className="text-sm font-medium text-surface-500">배달 가능한 가게가 곧 등록됩니다</p>
            </div>
          </div>
        ) : (
          <HorizontalCarousel>
            {deliveryShops.map((shop, i) => (
              <ShopItem key={shop.id} shop={shop} index={i} />
            ))}
          </HorizontalCarousel>
        )}
      </section>


    </div>
  );
}

/* ─── Empty State Component ─── */
function EmptyState() {
  return (
    <div className="px-4">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-300 bg-surface-50/50 px-4 py-8 text-center">
        <CakeIcon className="mb-2 h-8 w-8 text-surface-300" />
        <h3 className="text-sm font-semibold text-surface-700">아직 등록된 가게가 없어요</h3>
        <p className="mt-0.5 text-xs text-surface-400">곧 맛있는 케이크 가게들이 등록될 거예요!</p>
      </div>
    </div>
  );
}
