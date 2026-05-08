'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createDataClient } from '@/lib/supabase/client';
import type { ShopGalleryImage } from '@/lib/types';
import {
  ArrowLeftIcon,
  CakeIcon,
  MapPinIcon,
  CalendarIcon,
  StarIcon,
  ChevronRightIcon,
} from '@/components/icons';

interface PortfolioDetail extends ShopGalleryImage {
  shops?: { id: string; name: string; address: string; image_url: string | null };
  shop_menus?: { id: string; name: string } | null;
}

interface RelatedGroup {
  groupKey: string; // group_id or single image id
  coverImage: ShopGalleryImage;
  count: number;
}

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = params.id as string;

  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null);
  const [groupImages, setGroupImages] = useState<ShopGalleryImage[]>([]);
  const [relatedGroups, setRelatedGroups] = useState<RelatedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const client = createDataClient();

        // Fetch portfolio item with shop info
        const { data } = await client
          .from('shop_gallery_images')
          .select('*, shops!inner(id, name, address, image_url), shop_menus(id, name)')
          .eq('id', portfolioId)
          .single();

        if (data) {
          const portfolioData = data as unknown as PortfolioDetail;
          setPortfolio(portfolioData);

          // If this image has a group_id, fetch all images in the group
          if (portfolioData.group_id) {
            const { data: groupData } = await client
              .from('shop_gallery_images')
              .select('*')
              .eq('group_id', portfolioData.group_id)
              .order('position', { ascending: true });

            if (groupData && groupData.length > 1) {
              setGroupImages(groupData as unknown as ShopGalleryImage[]);
              // Set current slide to the position of this image in the group
              const idx = groupData.findIndex((g: any) => g.id === portfolioId);
              if (idx >= 0) setCurrentSlide(idx);
            } else {
              setGroupImages([portfolioData]);
            }
          } else {
            setGroupImages([portfolioData]);
          }

          // Fetch related (same shop, portfolio only) — grouped by group_id
          const { data: related } = await client
            .from('shop_gallery_images')
            .select('id, url, is_portfolio, created_at, group_id, position')
            .eq('shop_id', (data as any).shop_id)
            .eq('is_portfolio', true)
            .order('created_at', { ascending: false })
            .limit(30);

          if (related) {
            // Group by group_id, exclude current group
            const currentGroupId = portfolioData.group_id;
            const groupMap = new Map<string, ShopGalleryImage[]>();
            const ungrouped: ShopGalleryImage[] = [];

            for (const img of related as unknown as ShopGalleryImage[]) {
              // Skip images from the current group or current image
              if (currentGroupId && img.group_id === currentGroupId) continue;
              if (img.id === portfolioId) continue;

              if (img.group_id) {
                if (!groupMap.has(img.group_id)) groupMap.set(img.group_id, []);
                groupMap.get(img.group_id)!.push(img);
              } else {
                ungrouped.push(img);
              }
            }

            const groups: RelatedGroup[] = [];
            for (const [gid, imgs] of groupMap) {
              const sorted = imgs.sort((a, b) => a.position - b.position);
              groups.push({ groupKey: gid, coverImage: sorted[0], count: sorted.length });
            }
            for (const img of ungrouped) {
              groups.push({ groupKey: img.id, coverImage: img, count: 1 });
            }

            // Sort by created_at desc, limit to 6 groups
            groups.sort((a, b) =>
              new Date(b.coverImage.created_at).getTime() - new Date(a.coverImage.created_at).getTime()
            );
            setRelatedGroups(groups.slice(0, 6));
          }
        }
      } catch {
        /* silent */
      }
      setLoading(false);
    }
    load();
  }, [portfolioId]);

  const handleSliderScroll = useCallback(() => {
    if (!sliderRef.current) return;
    const el = sliderRef.current;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setCurrentSlide(idx);
  }, []);

  const formatPrice = (n: number) => n.toLocaleString() + '원';
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="aspect-square animate-shimmer" />
        <div className="px-4 py-5 space-y-3">
          <div className="h-5 w-3/4 animate-shimmer rounded-lg" />
          <div className="h-4 w-1/2 animate-shimmer rounded-lg" />
          <div className="h-20 w-full animate-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <CakeIcon className="mb-3 h-12 w-12 text-surface-200" />
        <p className="text-sm text-surface-500">포트폴리오를 찾을 수 없어요</p>
        <button onClick={() => router.back()} className="mt-4 text-sm font-medium text-primary-500">
          돌아가기
        </button>
      </div>
    );
  }

  const shop = portfolio.shops;

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-50 flex items-center justify-between bg-white/95 px-3 py-2.5 backdrop-blur-lg border-b border-surface-200/60">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100">
          <ArrowLeftIcon className="h-5 w-5 text-surface-700" />
        </button>
        <h1 className="text-base font-bold text-surface-900">포트폴리오</h1>
        <div className="w-9" />
      </div>

      {/* ─── Image Slider (group_id based) ─── */}
      <div className="relative bg-surface-100">
        {groupImages.length > 1 ? (
          <>
            <div
              ref={sliderRef}
              onScroll={handleSliderScroll}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {groupImages.map((img, i) => (
                <div key={img.id} className="w-full flex-shrink-0 snap-center">
                  <img
                    src={img.url}
                    alt={img.alt_text || '케이크 포트폴리오'}
                    className="w-full object-cover"
                    style={{ maxHeight: '70vh' }}
                  />
                </div>
              ))}
            </div>
            {/* Slide indicator */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm">
              {groupImages.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${
                    i === currentSlide
                      ? 'h-1.5 w-4 bg-white'
                      : 'h-1.5 w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
            {/* Count badge */}
            <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
              <span className="text-[11px] font-semibold text-white">
                {currentSlide + 1} / {groupImages.length}
              </span>
            </div>
          </>
        ) : (
          <img
            src={portfolio.url}
            alt={portfolio.alt_text || '케이크 포트폴리오'}
            className="w-full object-cover"
            style={{ maxHeight: '70vh' }}
          />
        )}
      </div>

      {/* ─── Shop Info Bar ─── */}
      {shop && (
        <Link
          href={`/shop/${shop.id}`}
          className="flex items-center gap-3 border-b border-surface-200 px-4 py-3 transition-colors hover:bg-surface-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 overflow-hidden">
            {shop.image_url ? (
              <img src={shop.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <CakeIcon className="h-5 w-5 text-primary-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-surface-900">{shop.name}</p>
            {shop.address && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-surface-400">
                <MapPinIcon className="h-3 w-3" /> {shop.address}
              </p>
            )}
          </div>
          <ChevronRightIcon className="h-4 w-4 text-surface-300" />
        </Link>
      )}

      {/* ─── Description ─── */}
      {portfolio.description && (
        <div className="px-4 py-4 border-b border-surface-100">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-surface-700">
            {portfolio.description}
          </p>
        </div>
      )}

      {/* ─── Meta Info Cards ─── */}
      <div className="px-4 py-4 space-y-2">
        {/* Menu Link */}
        {portfolio.shop_menus && (
          <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <CakeIcon className="h-4 w-4 text-primary-500" />
              <span className="text-sm font-semibold text-primary-700">메뉴</span>
            </div>
            <span className="text-sm font-medium text-primary-600">{portfolio.shop_menus.name}</span>
          </div>
        )}

        {/* Design Type (fallback if no menu) */}
        {!portfolio.shop_menus && portfolio.design_type && (
          <div className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3">
            <span className="text-sm text-surface-500">디자인 타입</span>
            <span className="text-sm font-semibold text-surface-800">{portfolio.design_type}</span>
          </div>
        )}

        {portfolio.cake_size && (
          <div className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3">
            <span className="text-sm text-surface-500">사이즈</span>
            <span className="text-sm font-semibold text-surface-800">{portfolio.cake_size}</span>
          </div>
        )}

        {portfolio.price && (
          <div className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3">
            <span className="text-sm text-surface-500">가격</span>
            <span className="text-sm font-bold text-primary-600">{formatPrice(portfolio.price)}</span>
          </div>
        )}

        {portfolio.made_date && (
          <div className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-surface-500">제작일</span>
            </div>
            <span className="text-sm font-medium text-surface-700">{formatDate(portfolio.made_date)}</span>
          </div>
        )}
      </div>

      {/* ─── Related Portfolios (grouped) ─── */}
      {relatedGroups.length > 0 && (
        <div className="px-4 py-4 border-t border-surface-100">
          <h3 className="mb-3 text-sm font-bold text-surface-900">이 가게의 다른 작품</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {relatedGroups.map((grp) => (
              <Link
                key={grp.groupKey}
                href={`/portfolio/${grp.coverImage.id}`}
                className="relative aspect-square overflow-hidden rounded-lg transition-transform active:scale-95"
              >
                <img src={grp.coverImage.url} alt="" className="h-full w-full object-cover" />
                {grp.count > 1 && (
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                      <rect x="5" y="1" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                    </svg>
                    <span className="text-[9px] font-semibold text-white leading-none">{grp.count}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ─── Date ─── */}
      <div className="px-4 py-3 text-center">
        <p className="text-[10px] text-surface-300">
          {formatDate(portfolio.created_at)} 등록
        </p>
      </div>
    </div>
  );
}
