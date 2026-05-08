'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient, createDataClient } from '@/lib/supabase/client';
import { trackShopView, trackPhotoView, trackOrderClick, trackShareClick } from '@/lib/track';
import type {
  ShopDetailData,
  ShopGalleryImage,
  ShopNotice,
  ShopMenuPrice,
  ShopMenu,
  ShopMenuSize,
  ReviewWithBuyer,
  BusinessHours,
  PickupInfoItem,
  ExternalReviewLinks,
} from '@/lib/types';
import { getShopImageUrl, CAKE_SIZE_OPTIONS } from '@/lib/types';
import {
  CakeIcon,
  ArrowLeftIcon,
  HomeIcon,
  BookmarkIcon,
  BookmarkSolidIcon,
  ShareIcon,
  DocumentTextIcon,
  MapPinIcon,
  ClockIcon,
  ChefHatIcon,
  ChatBubbleIcon,
  StarIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  BellIcon,
  InformationCircleIcon,
  XMarkIcon,
  CalendarIcon,
} from '@/components/icons';

type TabKey = 'menu' | 'notices' | 'photos' | 'reviews' | 'info';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'menu', label: '메뉴' },
  { key: 'notices', label: '공지' },
  { key: 'photos', label: '사진' },
  { key: 'reviews', label: '리뷰' },
  { key: 'info', label: '정보' },
];

/* ─── Photo Group helpers ─── */
interface PhotoGroup {
  id: string; // group_id or single image id
  images: ShopGalleryImage[];
  coverImage: ShopGalleryImage;
  count: number;
}

function groupPhotos(images: ShopGalleryImage[]): PhotoGroup[] {
  const groupMap = new Map<string, ShopGalleryImage[]>();
  const ungrouped: ShopGalleryImage[] = [];

  for (const img of images) {
    if (img.group_id) {
      if (!groupMap.has(img.group_id)) groupMap.set(img.group_id, []);
      groupMap.get(img.group_id)!.push(img);
    } else {
      ungrouped.push(img);
    }
  }

  // Auto-group ungrouped photos by created_at proximity (within 60 seconds)
  // and same description (uploaded together share the same description)
  const autoGroups: ShopGalleryImage[][] = [];
  const sorted = [...ungrouped].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const img of sorted) {
    const lastGroup = autoGroups[autoGroups.length - 1];
    if (lastGroup) {
      const lastImg = lastGroup[lastGroup.length - 1];
      const timeDiff = Math.abs(
        new Date(img.created_at).getTime() - new Date(lastImg.created_at).getTime()
      );
      // Group if: within 60s AND same description (batch uploads share description)
      if (timeDiff < 60000 && img.description === lastImg.description) {
        lastGroup.push(img);
        continue;
      }
    }
    autoGroups.push([img]);
  }

  const groups: PhotoGroup[] = [];

  // Explicit group_id groups
  for (const [gid, imgs] of groupMap) {
    const s = imgs.sort((a, b) => a.position - b.position);
    groups.push({ id: gid, images: s, coverImage: s[0], count: s.length });
  }

  // Auto-grouped (or single) photos
  for (const imgs of autoGroups) {
    const s = imgs.sort((a, b) => a.position - b.position);
    groups.push({ id: s[0].id, images: s, coverImage: s[0], count: s.length });
  }

  // Sort by first image position
  groups.sort((a, b) => a.coverImage.position - b.coverImage.position);
  return groups;
}

/* ─── Menu Detail Popup View Type ─── */
type MenuPopupView =
  | { type: 'menu'; menuId: string }
  | { type: 'portfolio'; imageId: string; images: ShopGalleryImage[] };

export default function ShopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shopId = params.id as string;
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Read ?tab= query param for deep-linking (e.g. from ShopListCard images)
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialTab = (searchParams?.get('tab') as TabKey) || 'menu';

  const [shop, setShop] = useState<ShopDetailData | null>(null);
  const [reviews, setReviews] = useState<ReviewWithBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Gallery
  const [galleryIdx, setGalleryIdx] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Bookmark
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Photo viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [viewerImages, setViewerImages] = useState<{ url: string; id?: string }[]>([]);

  // Menu tab
  const [menuSizeTab, setMenuSizeTab] = useState<string>(CAKE_SIZE_OPTIONS[0]);

  // Menu detail popup
  const [menuPopupStack, setMenuPopupStack] = useState<MenuPopupView[]>([]);
  const menuPopupOpen = menuPopupStack.length > 0;

  // Review filter
  const [photoOnly, setPhotoOnly] = useState(false);

  // Info accordion
  const [openPickupIdx, setOpenPickupIdx] = useState<number | null>(null);

  // Schedule
  const [scheduleDate, setScheduleDate] = useState('');

  /* ─── Data Fetching ─── */
  useEffect(() => {
    let authClient: ReturnType<typeof createClient> | null = null;
    let dataClient: ReturnType<typeof createDataClient> | null = null;
    try {
      authClient = createClient();
      dataClient = createDataClient();
    } catch { setLoading(false); return; }

    async function fetchAll() {
      if (!authClient || !dataClient) return;

      // Run auth, shop detail, and reviews queries in PARALLEL
      const galleryFields = 'id, url, alt_text, position, is_portfolio, is_primary, description, design_type, cake_size, price, made_date, menu_id, created_at';
      const galleryFieldsWithGroup = galleryFields + ', group_id';

      const buildShopQuery = (client: typeof dataClient, withGroupId: boolean) => client!
        .from('shops')
        .select(`
          *,
          profiles!owner_id(nickname, email, avatar_url),
          images(id, url, alt_text, is_primary, position, source),
          shop_gallery_images(${withGroupId ? galleryFieldsWithGroup : galleryFields}),
          shop_notices(id, title, content, image_url, is_pinned, created_at, updated_at),
          shop_menu_prices(id, cake_size, design_type, price_min, price_max, description, position),
          shop_menus(id, name, description, image_url, price, position, shop_menu_sizes(id, cake_size, price_min, price_max))
        `)
        .eq('id', shopId)
        .single();

      const [userResult, shopResult, reviewResult] = await Promise.all([
        // Auth — uses authClient (needs session cookies)
        authClient.auth.getUser(),
        // Shop + relations — try with group_id first
        buildShopQuery(dataClient, true),
        // Reviews — uses lightweight dataClient
        dataClient
          .from('reviews')
          .select('*, profiles!reviews_buyer_id_fkey(nickname, avatar_url)')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false }),
      ]);

      // Process user
      const user = userResult.data?.user ?? null;
      if (user) setUserId(user.id);

      // Process shop data (graceful fallback if new columns/tables don't exist yet)
      let shopData: any = null;
      if (shopResult.error) {
        // Try again without group_id (column may not exist yet)
        const retryResult = await buildShopQuery(dataClient, false) as any;
        if (retryResult.error && retryResult.error.code === 'PGRST200') {
          // Even the basic query with relations failed — try bare minimum
          const { data: basicData } = await dataClient
            .from('shops')
            .select('*, profiles!owner_id(nickname, email, avatar_url)')
            .eq('id', shopId)
            .single();
          if (basicData) {
            shopData = { ...(basicData as Record<string, any>), images: [], shop_gallery_images: [], shop_notices: [], shop_menu_prices: [], shop_menus: [] };
          }
        } else if (retryResult.data) {
          shopData = retryResult.data;
          // Ensure group_id is null for all gallery images when column doesn't exist
          if (shopData.shop_gallery_images) {
            shopData.shop_gallery_images = shopData.shop_gallery_images.map((img: any) => ({ ...img, group_id: img.group_id ?? null }));
          }
        }
      } else {
        shopData = shopResult.data;
      }

      if (!shopData) { setLoading(false); return; }

      // Sort gallery by position
      const sd = shopData as unknown as ShopDetailData;
      sd.shop_gallery_images = (sd.shop_gallery_images || []).sort((a, b) => a.position - b.position);
      sd.shop_notices = (sd.shop_notices || []).sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      sd.shop_menu_prices = (sd.shop_menu_prices || []).sort((a, b) => a.position - b.position);
      sd.shop_menus = ((sd as any).shop_menus || []).sort((a: ShopMenu, b: ShopMenu) => a.position - b.position);
      for (const menu of sd.shop_menus || []) {
        menu.shop_menu_sizes = (menu.shop_menu_sizes || []);
      }
      setShop(sd);

      // Process reviews
      setReviews((reviewResult.data as ReviewWithBuyer[]) || []);

      // Bookmark check — runs after we know the user (graceful if table doesn't exist)
      if (user) {
        try {
          const { data: bm } = await dataClient
            .from('bookmarks')
            .select('id')
            .eq('user_id', user.id)
            .eq('shop_id', shopId)
            .maybeSingle();
          setIsBookmarked(!!bm);
        } catch { /* bookmarks table may not exist yet */ }
      }

      setLoading(false);

      // Track shop view (deduplicated per session)
      trackShopView(shopId);
    }
    fetchAll();
  }, [shopId]);

  /* ─── Computed ─── */
  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  const isOpen = useMemo(() => {
    if (!shop?.business_hours) return false;
    const now = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const today = days[now.getDay()];
    const h = shop.business_hours[today];
    if (!h || h.closed) return false;
    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return t >= h.open && t <= h.close;
  }, [shop]);

  const todayName = useMemo(() => ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()], []);


  const filteredReviews = useMemo(() =>
    photoOnly ? reviews.filter(r => r.photo_url) : reviews,
    [reviews, photoOnly]
  );

  const menuPricesBySize = useMemo(() => {
    if (!shop?.shop_menu_prices) return {};
    const map: Record<string, ShopMenuPrice[]> = {};
    for (const mp of shop.shop_menu_prices) {
      if (!map[mp.cake_size]) map[mp.cake_size] = [];
      map[mp.cake_size].push(mp);
    }
    return map;
  }, [shop]);

  const availableSizes = useMemo(() => Object.keys(menuPricesBySize), [menuPricesBySize]);

  // Portfolio photos grouped by menu_id
  const menuPhotos = useMemo(() => {
    if (!shop?.shop_gallery_images) return {};
    const map: Record<string, typeof shop.shop_gallery_images> = {};
    for (const img of shop.shop_gallery_images) {
      if (img.menu_id) {
        if (!map[img.menu_id]) map[img.menu_id] = [];
        map[img.menu_id].push(img);
      }
    }
    return map;
  }, [shop]);

  // Grouped portfolio photos by menu_id
  const menuPhotoGroups = useMemo(() => {
    const map: Record<string, PhotoGroup[]> = {};
    for (const [menuId, imgs] of Object.entries(menuPhotos)) {
      map[menuId] = groupPhotos(imgs);
    }
    return map;
  }, [menuPhotos]);

  // All photos for the Photos tab: gallery images + portfolio + review photos
  const allPhotosForTab = useMemo(() => {
    const galleryImgs = shop?.shop_gallery_images || [];
    const revImgs: ShopGalleryImage[] = reviews
      .filter(r => r.photo_url)
      .map(r => ({
        id: `review-${r.id}`,
        shop_id: shop?.id || '',
        url: r.photo_url!,
        alt_text: null,
        position: 99999,
        is_portfolio: false,
        is_primary: false,
        description: r.comment || null,
        design_type: null,
        cake_size: null,
        price: null,
        made_date: null,
        menu_id: null,
        group_id: null,
        cake_type: null,
        occasion: null,
        created_at: r.created_at,
      }));
    return [...galleryImgs, ...revImgs];
  }, [shop, reviews]);

  const allPhotoGroups = useMemo(() => groupPhotos(allPhotosForTab), [allPhotosForTab]);

  // Menu popup helpers
  const openMenuPopup = useCallback((menuId: string) => {
    setMenuPopupStack([{ type: 'menu', menuId }]);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeMenuPopup = useCallback(() => {
    setMenuPopupStack([]);
    document.body.style.overflow = '';
  }, []);

  const pushMenuPopupView = useCallback((view: MenuPopupView) => {
    setMenuPopupStack(prev => [...prev, view]);
  }, []);

  const popMenuPopupView = useCallback(() => {
    setMenuPopupStack(prev => {
      if (prev.length <= 1) {
        document.body.style.overflow = '';
        return [];
      }
      return prev.slice(0, -1);
    });
  }, []);

  const currentPopupView = menuPopupStack[menuPopupStack.length - 1] ?? null;

  /* ─── Handlers ─── */
  const handleShare = useCallback(async () => {
    if (!shop) return;
    trackShareClick(shop.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: shop?.name, url: window.location.href });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('링크가 복사되었습니다.');
    }
  }, [shop]);

  const handleBookmark = useCallback(async () => {
    if (!userId || !shop) return;
    try {
      const client = createClient();
      if (isBookmarked) {
        await client.from('bookmarks').delete().eq('user_id', userId).eq('shop_id', shop.id);
        setIsBookmarked(false);
      } else {
        await client.from('bookmarks').insert({ user_id: userId, shop_id: shop.id });
        setIsBookmarked(true);
      }
    } catch { /* silent */ }
  }, [userId, shop, isBookmarked]);

  const goTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    tabBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const handleGalleryScroll = useCallback(() => {
    if (!galleryRef.current) return;
    const el = galleryRef.current;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setGalleryIdx(idx);
  }, []);

  /* ─── Format helpers ─── */
  const formatPrice = (n: number) => n.toLocaleString() + '원';
  const formatPriceRange = (min: number, max: number | null) =>
    max && max !== min ? `${formatPrice(min)} ~ ${formatPrice(max)}` : formatPrice(min);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

  const formatBusinessHours = (bh: BusinessHours) => {
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    return days.map(day => {
      const h = bh[day];
      if (!h || h.closed) return { day, display: '휴무', closed: true };
      return { day, display: `${h.open} - ${h.close}`, closed: false };
    });
  };

  /* ─── Loading / Not Found ─── */
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="aspect-[4/3] animate-shimmer" />
        <div className="px-4 py-6 space-y-4">
          <div className="h-8 w-3/4 animate-shimmer rounded-lg" />
          <div className="h-5 w-1/2 animate-shimmer rounded-lg" />
          <div className="h-20 w-full animate-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-100">
          <MagnifyingGlassIcon className="h-10 w-10 text-surface-300" />
        </div>
        <h1 className="text-xl font-bold text-surface-900">가게를 찾을 수 없어요</h1>
        <p className="mt-2 text-sm text-surface-500">삭제되었거나 존재하지 않는 가게입니다.</p>
        <Link href="/" className="mt-6 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-white">홈으로 돌아가기</Link>
      </div>
    );
  }

  // Build hero images from images table + gallery images + fallback
  // Primary images always come first in the carousel
  const shopImages = (shop as any).images || [];
  const heroImages = shopImages.length > 0
    ? shopImages
        .sort((a: any, b: any) => {
          // Primary first, then by position
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return (a.position || 0) - (b.position || 0);
        })
        .map((img: any) => ({ id: img.id, url: img.url, alt_text: img.alt_text || shop.name }))
    : shop.shop_gallery_images.length > 0
      ? [...shop.shop_gallery_images]
          .sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return a.position - b.position;
          })
          .map(img => ({ id: img.id, url: img.url, alt_text: img.alt_text || shop.name }))
      : shop.image_url
        ? [{ id: 'fallback', url: shop.image_url, alt_text: shop.name }]
        : [];

  const galleryImages = shop.shop_gallery_images.length > 0
    ? shop.shop_gallery_images
    : shop.image_url
      ? [{ id: 'fallback', url: shop.image_url, alt_text: shop.name, position: 0, shop_id: shop.id, created_at: '' }]
      : [];

  const externalLinks = (shop.external_review_links || {}) as ExternalReviewLinks;
  const pickupInfo = (shop.pickup_info || []) as PickupInfoItem[];

  return (
    <div className="page-container">
      {/* ─── GNB ─── */}
      <div className="sticky top-0 z-50 flex items-center justify-between bg-white/95 px-3 py-2.5 backdrop-blur-lg border-b border-surface-200/60">
        <div className="flex items-center gap-1">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100">
            <ArrowLeftIcon className="h-5 w-5 text-surface-700" />
          </button>
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100">
            <HomeIcon className="h-5 w-5 text-surface-700" />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleBookmark} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100">
            {isBookmarked ? (
              <BookmarkSolidIcon className="h-5 w-5 text-primary-500" />
            ) : (
              <BookmarkIcon className="h-5 w-5 text-surface-700" />
            )}
          </button>
          <button onClick={handleShare} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100">
            <ShareIcon className="h-5 w-5 text-surface-700" />
          </button>
        </div>
      </div>

      {/* ─── Hero Image Carousel (max 12) ─── */}
      {heroImages.length > 0 ? (
        <section id="shop-image-list-hero" className="pb-2">
          {heroImages.length === 1 ? (
            /* Single image: full width, 240px height, object-cover */
            <div
              className="w-full overflow-hidden bg-surface-100 cursor-pointer"
              style={{ height: 240 }}
              onClick={() => {
                setViewerImages(heroImages.map((img: { id: string; url: string; alt_text: string }) => ({ url: img.url, id: img.id })));
                setViewerIdx(0);
                setViewerOpen(true);
                trackPhotoView(shopId);
              }}
            >
              <img src={heroImages[0].url} alt={heroImages[0].alt_text || shop.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            /* Multiple images: 240px height, width varies by image ratio, horizontal scroll */
            <div
              className="flex gap-2 overflow-x-auto pl-4 pr-4 hide-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', height: 240 }}
            >
              {heroImages.slice(0, 12).map((img: { id: string; url: string; alt_text: string }, i: number) => (
                <div
                  key={img.id || i}
                  className="flex-shrink-0 overflow-hidden rounded-2xl bg-surface-100 cursor-pointer"
                  style={{ height: 240 }}
                  onClick={() => {
                    setViewerImages(heroImages.map((img: { id: string; url: string; alt_text: string }) => ({ url: img.url, id: img.id })));
                    setViewerIdx(i);
                    setViewerOpen(true);
                    trackPhotoView(shopId);
                  }}
                >
                  <img src={img.url} alt={img.alt_text || shop.name} className="h-full w-auto object-cover" />
                </div>
              ))}
              {heroImages.length > 12 && (
                <div className="flex-shrink-0 rounded-2xl" style={{ height: 240, width: 160 }}>
                  <button
                    onClick={() => goTab('photos')}
                    className="flex h-full w-full items-center justify-center rounded-2xl bg-surface-100 transition-colors hover:bg-surface-200"
                  >
                    <div className="text-center">
                      <PhotoIcon className="mx-auto h-8 w-8 text-surface-400" />
                      <span className="mt-1.5 block text-sm font-semibold text-surface-600">더보기</span>
                      <span className="text-xs text-surface-400">+{heroImages.length - 12}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <div className="mx-4 mt-3 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-warm-100" style={{ height: 240 }}>
          <CakeIcon className="h-16 w-16 text-primary-200" />
        </div>
      )}

      {/* Shop Basic Info + Description */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isOpen ? 'bg-success/10 text-success' : 'bg-surface-200 text-surface-500'}`}>
            {isOpen ? '영업중' : '영업종료'}
          </span>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1">
              <StarIcon className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-xs font-semibold text-surface-700">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-surface-400">({reviews.length})</span>
            </div>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-surface-900">{shop.name}</h1>
          <button onClick={handleBookmark} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100 transition-colors">
            {isBookmarked ? (
              <BookmarkSolidIcon className="h-6 w-6 text-primary-500" />
            ) : (
              <BookmarkIcon className="h-6 w-6 text-surface-300" />
            )}
          </button>
        </div>
        {shop.description && (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-surface-500">
            {shop.description}
          </p>
        )}
        {shop.address && (
          <p className="mt-2 flex items-center gap-1 text-xs text-surface-400">
            <MapPinIcon className="h-3 w-3" /> {shop.address}
          </p>
        )}
      </div>

      {/* ─── Tab Bar ─── */}
      <div ref={tabBarRef} className="sticky top-[53px] z-40 border-b border-surface-200 bg-white/95 backdrop-blur-lg">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex-1 py-3 text-center text-[13px] font-semibold transition-colors ${
                activeTab === tab.key ? 'text-primary-600' : 'text-surface-400 hover:text-surface-600'
              }`}
            >
              {tab.label}
              {tab.key === 'reviews' && reviews.length > 0 && (
                <span className="ml-0.5 text-[10px] text-primary-400">{reviews.length}</span>
              )}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="px-4 py-5">

        {/* ═══ NOTICES TAB ═══ */}
        {activeTab === 'notices' && (
          <div className="space-y-3">
            {shop.shop_notices.length === 0 ? (
              <div className="card-empty-state">
                <BellIcon className="mb-2 h-8 w-8 text-surface-300" />
                <p className="text-sm font-medium text-surface-500">공지사항이 없습니다</p>
              </div>
            ) : (
              shop.shop_notices.map(n => (
                <div key={n.id} className="rounded-2xl border border-surface-200 bg-white p-4">
                  <div className="flex items-start gap-2">
                    {n.is_pinned && <span className="mt-0.5 rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-600">고정</span>}
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-surface-900">{n.title}</h4>
                      <time className="text-[10px] text-surface-400">{formatDate(n.created_at)}</time>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-surface-600">{n.content}</p>
                  {n.image_url && (
                    <img src={n.image_url} alt="" className="mt-3 w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ MENU TAB ═══ */}
        {activeTab === 'menu' && (
          <div>
            {/* Schedule picker */}
            <div className="rounded-2xl border border-surface-200 bg-white p-4 mb-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-surface-900">
                <ClockIcon className="h-4 w-4 text-primary-500" /> 예약 가능 날짜
              </h3>
              <select
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="form-select mt-0"
              >
                <option value="">날짜를 선택하세요</option>
                {Array.from({ length: 14 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i + 1);
                  const ds = d.toISOString().split('T')[0];
                  const dayK = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
                  return <option key={ds} value={ds}>{ds} ({dayK})</option>;
                })}
              </select>
            </div>

            {/* New menu system: shop_menus */}
            {shop.shop_menus && shop.shop_menus.length > 0 ? (
              /* ─── Menu List View ─── */
              <div className="space-y-3">
                {shop.shop_menus.map(menu => {
                  const photoGrps = menuPhotoGroups[menu.id] || [];
                  return (
                    <button
                      key={menu.id}
                      onClick={() => openMenuPopup(menu.id)}
                      className="w-full rounded-xl border border-surface-200 bg-white overflow-hidden text-left transition-all hover:border-surface-300 hover:shadow-sm active:scale-[0.99]"
                    >
                      <div className="flex gap-3 px-4 py-3">
                        {/* Left: text info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-surface-900">{menu.name}</h4>
                            {menu.description && <p className="mt-0.5 text-xs text-surface-400 line-clamp-2">{menu.description}</p>}
                          </div>
                          <div className="mt-2">
                            {menu.shop_menu_sizes && menu.shop_menu_sizes.length > 0 ? (
                              <span className="text-sm font-bold text-primary-600">
                                {formatPriceRange(
                                  Math.min(...menu.shop_menu_sizes.map(s => s.price_min)),
                                  Math.max(...menu.shop_menu_sizes.map(s => s.price_max ?? s.price_min))
                                )}
                              </span>
                            ) : menu.price ? (
                              <span className="text-sm font-bold text-primary-600">{formatPrice(menu.price)}</span>
                            ) : null}
                          </div>
                        </div>
                        {/* Right: thumbnail + arrow */}
                        <div className="flex items-center gap-1.5">
                          {menu.image_url ? (
                            <img src={menu.image_url} alt={menu.name} className="h-16 w-16 rounded-xl object-cover" />
                          ) : photoGrps.length > 0 ? (
                            <img src={photoGrps[0].coverImage.url} alt={menu.name} className="h-16 w-16 rounded-xl object-cover" />
                          ) : null}
                          <ChevronRightIcon className="h-4 w-4 text-surface-300 flex-shrink-0" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : availableSizes.length === 0 ? (
              <div className="card-empty-state">
                <CakeIcon className="mb-2 h-8 w-8 text-surface-300" />
                <p className="text-sm font-medium text-surface-500">등록된 메뉴가 없습니다</p>
              </div>
            ) : (
              <>
                {/* Legacy: Size Tabs */}
                <div className="filter-scroll mb-4">
                  {availableSizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setMenuSizeTab(size)}
                      className={menuSizeTab === size ? 'btn-pill-active' : 'btn-pill'}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                {/* Legacy: Prices */}
                <div className="space-y-2">
                  {(menuPricesBySize[menuSizeTab] || []).map(mp => (
                    <div key={mp.id} className="flex items-center justify-between rounded-xl border border-surface-200 bg-white px-4 py-3">
                      <div>
                        <span className="text-sm font-medium text-surface-800">{mp.design_type}</span>
                        {mp.description && <p className="mt-0.5 text-xs text-surface-400">{mp.description}</p>}
                      </div>
                      <span className="text-sm font-bold text-primary-600">{formatPriceRange(mp.price_min, mp.price_max)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ PHOTOS TAB ═══ */}
        {activeTab === 'photos' && (
          <div>
            {allPhotoGroups.length === 0 ? (
              <div className="card-empty-state">
                <PhotoIcon className="mb-2 h-8 w-8 text-surface-300" />
                <p className="text-sm font-medium text-surface-500">아직 등록된 사진이 없습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {allPhotoGroups.map((grp) => (
                  <div
                    key={grp.id}
                    className="relative aspect-square overflow-hidden rounded-lg cursor-pointer transition-transform active:scale-95"
                    onClick={() => {
                      const imgs = grp.images.map(img => ({ url: img.url, id: img.id }));
                      setViewerImages(imgs);
                      setViewerIdx(0);
                      setViewerOpen(true);
                      trackPhotoView(shopId);
                    }}
                  >
                    <img src={grp.coverImage.url} alt="" className="h-full w-full object-cover" />
                    {grp.count > 1 && (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                          <rect x="5" y="1" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                        </svg>
                        <span className="text-[10px] font-semibold text-white leading-none">{grp.count}</span>
                      </div>
                    )}
                    {grp.coverImage.is_portfolio && (
                      <div className="absolute top-1 left-1 rounded bg-primary-500/80 px-1.5 py-0.5">
                        <span className="text-[8px] font-bold text-white">포트폴리오</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ REVIEWS TAB ═══ */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {/* Rating Summary */}
            {reviews.length > 0 && (
              <div className="flex items-center gap-6 rounded-2xl border border-surface-200 bg-white p-5">
                <div className="text-center">
                  <p className="text-4xl font-bold text-surface-900">{avgRating.toFixed(1)}</p>
                  <div className="mt-1 flex items-center gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <StarIcon key={s} className={`h-4 w-4 ${s <= Math.round(avgRating) ? 'text-yellow-400' : 'text-surface-200'}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-surface-400">{reviews.length}개의 리뷰</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5,4,3,2,1].map(star => {
                    const count = reviews.filter(r => r.rating === star).length;
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="w-3 text-xs text-surface-500">{star}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-100">
                          <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-right text-xs text-surface-400">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter + External Links */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-surface-600 cursor-pointer">
                <input type="checkbox" checked={photoOnly} onChange={() => setPhotoOnly(!photoOnly)} className="rounded border-surface-300 text-primary-500" />
                사진 포함 리뷰만
              </label>
              <div className="flex gap-1.5">
                {externalLinks.naver && (
                  <a href={externalLinks.naver} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#03C75A]/10 px-2.5 py-1 text-[10px] font-semibold text-[#03C75A]">네이버 리뷰</a>
                )}
                {externalLinks.kakao && (
                  <a href={externalLinks.kakao} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#FEE500]/30 px-2.5 py-1 text-[10px] font-semibold text-[#3C1E1E]">카카오 리뷰</a>
                )}
                {externalLinks.google && (
                  <a href={externalLinks.google} target="_blank" rel="noopener noreferrer" className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-600">구글 리뷰</a>
                )}
              </div>
            </div>

            {/* Review List */}
            {filteredReviews.length === 0 ? (
              <div className="card-empty-state">
                <ChatBubbleIcon className="h-8 w-8 text-surface-300" />
                <h3 className="mt-2 font-semibold text-surface-900">리뷰가 없어요</h3>
                <p className="mt-1 text-sm text-surface-500">첫 번째 리뷰를 남겨보세요!</p>
              </div>
            ) : (
              filteredReviews.map(r => (
                <div key={r.id} className="rounded-2xl border border-surface-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        {r.profiles?.avatar_url ? (
                          <img src={r.profiles.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : r.profiles?.nickname?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{r.profiles?.nickname}</p>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <StarIcon key={s} className={`h-3 w-3 ${s <= r.rating ? 'text-yellow-400' : 'text-surface-200'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <time className="text-xs text-surface-400">{formatDate(r.created_at)}</time>
                  </div>
                  {r.comment && <p className="mt-2 text-sm leading-relaxed text-surface-600">{r.comment}</p>}
                  {r.photo_url && (
                    <div className="mt-2 overflow-hidden rounded-xl">
                      <img src={r.photo_url} alt="리뷰 사진" className="h-48 w-full object-cover cursor-pointer" onClick={() => {
                        setViewerImages([{ url: r.photo_url!, id: r.id }]);
                        setViewerIdx(0);
                        setViewerOpen(true);
                        trackPhotoView(shopId);
                      }} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ INFO TAB ═══ */}
        {activeTab === 'info' && (
          <div className="space-y-5">
            {/* Pickup Info */}
            {pickupInfo.length > 0 && (
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-900">
                  <InformationCircleIcon className="h-4 w-4 text-primary-500" /> 픽업 안내
                </h3>
                <div className="space-y-2">
                  {pickupInfo.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-surface-200 overflow-hidden">
                      <button
                        onClick={() => setOpenPickupIdx(openPickupIdx === idx ? null : idx)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                      >
                        <span className="text-sm font-medium text-surface-800">{item.title}</span>
                        {openPickupIdx === idx
                          ? <ChevronUpIcon className="h-4 w-4 text-surface-400" />
                          : <ChevronDownIcon className="h-4 w-4 text-surface-400" />
                        }
                      </button>
                      {openPickupIdx === idx && (
                        <div className="border-t border-surface-100 px-3 py-3">
                          <p className="whitespace-pre-wrap text-sm text-surface-600">{item.description}</p>
                          {item.image_urls && item.image_urls.length > 0 && (
                            <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar">
                              {item.image_urls.map((url, i) => (
                                <img key={i} src={url} alt="" className="h-24 w-auto rounded-lg object-cover" />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Business Hours */}
            {shop.business_hours && (
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-900">
                  <ClockIcon className="h-4 w-4 text-primary-500" /> 영업시간
                </h3>
                <div className="space-y-1">
                  {formatBusinessHours(shop.business_hours).map(({ day, display, closed }) => (
                    <div key={day} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${day === todayName ? 'bg-primary-50 font-semibold' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 text-center font-semibold ${day === todayName ? 'text-primary-600' : 'text-surface-700'}`}>{day}</span>
                        {day === todayName && <span className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-600">오늘</span>}
                      </div>
                      <span className={closed ? 'text-surface-400' : day === todayName ? 'text-primary-600' : 'text-surface-600'}>{display}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Naver Map / Location */}
            <div className="rounded-2xl border border-surface-200 bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-900">
                <MapPinIcon className="h-4 w-4 text-primary-500" /> 위치
              </h3>
              <p className="text-sm text-surface-600 mb-3">{shop.address}</p>
              {shop.naver_map_url ? (
                <a
                  href={shop.naver_map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#03C75A]/30 bg-[#03C75A]/5 py-3 text-sm font-semibold text-[#03C75A] transition-all hover:bg-[#03C75A]/10"
                >
                  <MapPinIcon className="h-4 w-4" />
                  네이버 지도에서 보기
                </a>
              ) : (
                shop.address && (
                  <a
                    href={`https://map.naver.com/v5/search/${encodeURIComponent(shop.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-surface-50 py-3 text-sm font-medium text-surface-600 transition-all hover:bg-surface-100"
                  >
                    <MapPinIcon className="h-4 w-4" />
                    지도에서 검색하기
                  </a>
                )
              )}
            </div>

            {/* Seller Info */}
            <div className="rounded-2xl border border-surface-200 bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-900">
                <ChefHatIcon className="h-4 w-4 text-primary-500" /> 판매자 정보
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-primary-200 text-sm font-bold text-primary-700">
                  {shop.profiles?.avatar_url ? (
                    <img src={shop.profiles.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : shop.profiles?.nickname?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-surface-900">{shop.profiles?.nickname}</p>
                  <p className="text-xs text-surface-400">{shop.profiles?.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>



      {/* ─── Fullscreen Photo Viewer ─── */}
      {viewerOpen && viewerImages.length > 0 && (
        <div className="fixed inset-0 z-[100] flex justify-center bg-black">
          <div className="w-full max-w-[480px] flex flex-col">
          {/* Viewer Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => { setViewerOpen(false); setViewerImages([]); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <XMarkIcon className="h-5 w-5 text-white" />
            </button>
            <span className="text-sm text-white/70">{viewerIdx + 1} / {viewerImages.length}</span>
            <div className="w-9" />
          </div>

          {/* Photo */}
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <img src={viewerImages[viewerIdx].url} alt="" className="max-h-full max-w-full object-contain" />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setViewerIdx(Math.max(0, viewerIdx - 1))}
              disabled={viewerIdx === 0}
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-30"
            >
              ← 이전
            </button>
            <button
              onClick={() => { setViewerOpen(false); setViewerImages([]); }}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              닫기
            </button>
            <button
              onClick={() => setViewerIdx(Math.min(viewerImages.length - 1, viewerIdx + 1))}
              disabled={viewerIdx === viewerImages.length - 1}
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-30"
            >
              다음 →
            </button>
          </div>
          </div>
        </div>
      )}

      {/* ─── Menu Detail Full-Page Popup ─── */}
      {menuPopupOpen && currentPopupView && (
        <div className="fixed inset-0 z-[90] flex justify-center" style={{ animation: 'slideUp 0.25s ease-out' }}>
          <div className="w-full max-w-[480px] bg-white flex flex-col">
          {/* Popup Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200/60 bg-white/95 px-3 py-2.5 backdrop-blur-lg">
            <button
              onClick={popMenuPopupView}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100"
            >
              <ArrowLeftIcon className="h-5 w-5 text-surface-700" />
            </button>
            <h1 className="text-base font-bold text-surface-900">
              {currentPopupView.type === 'menu'
                ? shop?.shop_menus?.find(m => m.id === currentPopupView.menuId)?.name || '메뉴 상세'
                : '포트폴리오'}
            </h1>
            {menuPopupStack.length > 1 ? (
              <button
                onClick={closeMenuPopup}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100"
              >
                <XMarkIcon className="h-5 w-5 text-surface-700" />
              </button>
            ) : (
              <button
                onClick={closeMenuPopup}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100"
              >
                <XMarkIcon className="h-5 w-5 text-surface-700" />
              </button>
            )}
          </div>

          {/* Popup Content */}
          <div className="flex-1 overflow-y-auto">
            {currentPopupView.type === 'menu' && (() => {
              const popupMenu = shop?.shop_menus?.find(m => m.id === currentPopupView.menuId);
              if (!popupMenu) return null;
              const popupMenuPhotoGroups = menuPhotoGroups[popupMenu.id] || [];
              return (
                <div className="pb-20">
                  {/* Menu Image */}
                  {popupMenu.image_url && (
                    <img src={popupMenu.image_url} alt={popupMenu.name} className="w-full aspect-[16/9] object-cover" />
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-surface-900">{popupMenu.name}</h3>
                    {popupMenu.description && (
                      <p className="mt-1 text-sm text-surface-500 whitespace-pre-wrap">{popupMenu.description}</p>
                    )}
                    {/* Size prices */}
                    {popupMenu.shop_menu_sizes && popupMenu.shop_menu_sizes.length > 0 && (
                      <div className="mt-4 space-y-1.5">
                        {popupMenu.shop_menu_sizes.map(size => (
                          <div key={size.id} className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2.5">
                            <span className="text-sm text-surface-700">{size.cake_size}</span>
                            <span className="text-sm font-semibold text-primary-600">{formatPriceRange(size.price_min, size.price_max)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {popupMenu.price && !popupMenu.shop_menu_sizes?.length && (
                      <p className="mt-3 text-lg font-bold text-primary-600">{formatPrice(popupMenu.price)}</p>
                    )}
                  </div>

                  {/* Portfolio photos for this menu (grouped) */}
                  {popupMenuPhotoGroups.length > 0 && (
                    <div className="px-4 pb-4">
                      <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-surface-900">
                        <PhotoIcon className="h-4 w-4 text-primary-500" />
                        포트폴리오
                        <span className="text-xs font-normal text-surface-400">({popupMenuPhotoGroups.length})</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {popupMenuPhotoGroups.map((grp) => (
                          <div
                            key={grp.id}
                            className="group relative overflow-hidden rounded-xl bg-surface-100 cursor-pointer"
                            onClick={() => {
                              pushMenuPopupView({ type: 'portfolio', imageId: grp.coverImage.id, images: grp.images });
                              trackPhotoView(shopId);
                            }}
                          >
                            <img src={grp.coverImage.url} alt={grp.coverImage.alt_text || ''} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                            {grp.count > 1 && (
                              <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                                  <rect x="5" y="1" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                                </svg>
                                <span className="text-[10px] font-semibold text-white leading-none">{grp.count}</span>
                              </div>
                            )}
                            {grp.coverImage.description && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6">
                                <p className="text-xs text-white line-clamp-2">{grp.coverImage.description}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {currentPopupView.type === 'portfolio' && (() => {
              const pvImages = currentPopupView.images;
              const mainImg = pvImages.find(img => img.id === currentPopupView.imageId) || pvImages[0];
              if (!mainImg) return null;
              return (
                <div className="pb-20">
                  {/* Image carousel for grouped photos */}
                  {pvImages.length > 1 ? (
                    <div className="overflow-x-auto hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
                      <div className="flex">
                        {pvImages.map((img) => (
                          <div key={img.id} className="flex-shrink-0 w-full">
                            <img src={img.url} alt={img.alt_text || ''} className="w-full object-cover" style={{ maxHeight: '70vh' }} />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-center gap-1.5 py-2">
                        {pvImages.map((img, i) => (
                          <div key={img.id} className={`h-1.5 rounded-full transition-all ${i === 0 ? 'w-4 bg-primary-500' : 'w-1.5 bg-surface-300'}`} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <img src={mainImg.url} alt={mainImg.alt_text || ''} className="w-full object-cover" style={{ maxHeight: '70vh' }} />
                  )}

                  {/* Description */}
                  {mainImg.description && (
                    <div className="px-4 py-4 border-b border-surface-100">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-surface-700">{mainImg.description}</p>
                    </div>
                  )}

                  {/* Meta Info */}
                  <div className="px-4 py-4 space-y-2">
                    {mainImg.menu_id && (() => {
                      const menuName = shop?.shop_menus?.find(m => m.id === mainImg.menu_id)?.name;
                      return menuName ? (
                        <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CakeIcon className="h-4 w-4 text-primary-500" />
                            <span className="text-sm font-semibold text-primary-700">메뉴</span>
                          </div>
                          <span className="text-sm font-medium text-primary-600">{menuName}</span>
                        </div>
                      ) : null;
                    })()}
                    {mainImg.cake_size && (
                      <div className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3">
                        <span className="text-sm text-surface-500">사이즈</span>
                        <span className="text-sm font-semibold text-surface-800">{mainImg.cake_size}</span>
                      </div>
                    )}
                    {mainImg.price && (
                      <div className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3">
                        <span className="text-sm text-surface-500">가격</span>
                        <span className="text-sm font-bold text-primary-600">{formatPrice(mainImg.price)}</span>
                      </div>
                    )}
                    {mainImg.made_date && (
                      <div className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3">
                        <span className="text-sm text-surface-500">제작일</span>
                        <span className="text-sm font-medium text-surface-700">{formatDate(mainImg.made_date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="px-4 py-3 text-center">
                    <p className="text-[10px] text-surface-300">{formatDate(mainImg.created_at)} 등록</p>
                  </div>
                </div>
              );
            })()}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
