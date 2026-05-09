'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createDataClient } from '@/lib/supabase/client';
import type { GalleryPost } from '@/lib/types';
import { DESIGN_TAGS, OCCASION_TAGS, SIZE_TAGS, SEOUL_DISTRICTS, CUSTOM_TYPE_OPTIONS } from '@/lib/types';
import { CakeIcon, ChevronDownIcon, XMarkIcon } from '@/components/icons';
import PostDetailModal from '@/components/PostDetailModal';
import FilterBottomSheet from '@/components/FilterBottomSheet';

const INITIAL_PAGE_SIZE = 16;
const LOAD_MORE_SIZE = 32;

/* ─── Filter config ─── */
type FilterKey = 'design' | 'custom' | 'occasion' | 'size' | 'region';

const FILTER_GROUPS: { key: FilterKey; label: string; options: readonly string[] }[] = [
  { key: 'design', label: '케이크타입', options: DESIGN_TAGS },
  { key: 'custom', label: '커스텀타입', options: CUSTOM_TYPE_OPTIONS },
  { key: 'occasion', label: '축하목적', options: OCCASION_TAGS },
  { key: 'size', label: '사이즈', options: SIZE_TAGS },
  { key: 'region', label: '지역', options: SEOUL_DISTRICTS },
];

/* ─── Gallery Card (Figma: home-list-thumb, ratio=3:4) ─── */
function GalleryCard({ post, onSelect }: { post: GalleryPost; index: number; onSelect: (post: GalleryPost) => void }) {
  const [loaded, setLoaded] = useState(false);
  const totalImages = 1 + (post.extra_images?.length || 0);

  return (
    <div className="gallery-card">
      <button onClick={() => onSelect(post)} className="group block w-full text-left">
        {/* Thumbnail — 3:4 fixed ratio */}
        <div className="gallery-card-image">
          {!loaded && (
            <div className="absolute inset-0 animate-shimmer rounded-2xl" />
          )}
          <img
            src={post.image_url}
            alt={`${post.shop_name} 케이크`}
            className={`gallery-card-img ${loaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
          {/* Multi-image badge — bottom-right */}
          {totalImages > 1 && (
            <div className="gallery-card-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 1.39286C10.2459 1.39286 8.53925 1.55321 6.9191 1.7338C4.19499 2.03744 2.0077 4.22195 1.71554 6.9527C1.54305 8.56495 1.39285 10.2593 1.39285 12C1.39285 13.7408 1.54305 15.4351 1.71555 17.0473C2.0077 19.7781 4.19499 21.9625 6.9191 22.2661C8.53925 22.4469 10.2459 22.6071 12 22.6071C13.7541 22.6071 15.4607 22.4469 17.0809 22.2661C19.805 21.9625 21.9922 19.7781 22.2845 17.0473C22.4569 15.4351 22.6071 13.7408 22.6071 12C22.6071 10.2593 22.4569 8.56495 22.2845 6.9527C21.9922 4.22195 19.805 2.03744 17.0809 1.7338C15.4607 1.55321 13.7541 1.39286 12 1.39286ZM15.1993 11.5997C16.9912 11.5997 17.9989 10.5918 17.9989 8.80001C17.9989 7.00823 16.9912 6.00035 15.1993 6.00035C13.4075 6.00035 12.3997 7.00823 12.3997 8.80001C12.3997 10.5918 13.4075 11.5997 15.1993 11.5997ZM9.94315 12.59C12.6866 14.4575 15.0394 17.148 16.746 19.8889C15.1696 20.0636 13.5932 20.2074 12.0001 20.2074C10.3837 20.2074 8.78452 20.0595 7.185 19.8812C5.57438 19.7017 4.2736 18.3981 4.10178 16.7921C4.00843 15.9195 3.92442 15.046 3.86763 14.1691C4.43668 13.6862 5.05826 13.2523 5.90826 12.6607C7.09519 11.8348 8.6988 11.7429 9.94315 12.59Z" fill="white"/>
              </svg>
              <span>{totalImages}</span>
            </div>
          )}
        </div>

        {/* Text group */}
        <div className="gallery-card-text">
          <p className="gallery-card-title">{post.menu_name || post.shop_name}</p>
          <div className="gallery-card-tags">
            <span>{post.shop_name}</span>
            {post.cake_type && (
              <>
                <span className="gallery-card-dot" />
                <span>{post.cake_type}</span>
              </>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

/* ─── Skeleton Card ─── */
function SkeletonCard() {
  return (
    <div className="gallery-card">
      <div className="gallery-card-image">
        <div className="absolute inset-0 animate-shimmer" />
      </div>
      <div className="gallery-card-text">
        <div className="h-[14px] w-3/4 animate-shimmer rounded" style={{ marginBottom: '4px' }} />
        <div className="h-[12px] w-1/2 animate-shimmer rounded" />
      </div>
    </div>
  );
}

/* ─── Main Home Page ─── */
function HomePageContent() {
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPost, setSelectedPost] = useState<GalleryPost | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const rowOffsetRef = useRef(0);
  const seenGroupIdsRef = useRef(new Set<string>());

  // Multi-select filter state
  const [filters, setFilters] = useState<Record<FilterKey, string[]>>({
    design: [],
    custom: [],
    occasion: [],
    size: [],
    region: [],
  });

  // Read URL search params for tag filter routing (from post detail)
  const searchParams = useSearchParams();
  useEffect(() => {
    const tagKey = searchParams.get('tag_key') as FilterKey | null;
    const tagValue = searchParams.get('tag_value');
    if (tagKey && tagValue && FILTER_GROUPS.some(g => g.key === tagKey)) {
      setFilters(prev => {
        if (prev[tagKey].includes(tagValue)) return prev;
        return { ...prev, [tagKey]: [...prev[tagKey], tagValue] };
      });
      // Clean up URL
      window.history.replaceState(null, '', '/');
    }
  }, [searchParams]);

  // Bottom sheet state
  const [activeBottomSheet, setActiveBottomSheet] = useState<FilterKey | null>(null);

  // Collect all active tags for display
  const allActiveTags: { key: FilterKey; value: string }[] = [];
  for (const group of FILTER_GROUPS) {
    for (const val of filters[group.key]) {
      allActiveTags.push({ key: group.key, value: val });
    }
  }

  const hasActiveFilters = allActiveTags.length > 0;

  const removeTag = (key: FilterKey, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].filter((v) => v !== value),
    }));
  };

  const handleBottomSheetApply = (key: FilterKey, selected: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: selected }));
    setActiveBottomSheet(null);
  };

  const fetchPosts = useCallback(async (offset: number, currentFilters: Record<FilterKey, string[]>, pageSize: number, existingGroupIds?: Set<string>) => {
    let client: ReturnType<typeof createDataClient> | null = null;
    try {
      client = createDataClient();
    } catch {
      setLoading(false);
      return [];
    }

    // Fetch more rows than needed to account for grouping (grouped images collapse into fewer cards)
    const fetchSize = pageSize * 3;

    // Build query with joins to get district
    let query = client
      .from('shop_gallery_images')
      .select('id, url, is_portfolio, created_at, shop_id, cake_type, occasion, cake_size, menu_id, group_id, position, shops!inner(name, owner_id, district, profiles!inner(nickname)), shop_menus(name, custom_type)')
      .eq('is_portfolio', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + fetchSize - 1);

    // Apply design filter
    if (currentFilters.design.length > 0) {
      query = query.in('cake_type', currentFilters.design);
    }

    // Apply occasion filter
    if (currentFilters.occasion.length > 0) {
      query = query.in('occasion', currentFilters.occasion);
    }

    // Apply size filter
    if (currentFilters.size.length > 0) {
      query = query.in('cake_size', currentFilters.size);
    }

    // Apply region filter
    if (currentFilters.region.length > 0) {
      query = query.in('shops.district', currentFilters.region);
    }

    // Apply custom type filter
    if (currentFilters.custom.length > 0) {
      query = query.in('custom_type', currentFilters.custom);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    // Group images by group_id (seller upload batch)
    const grouped = new Map<string, any[]>();
    const ungrouped: any[] = [];
    const seenGroupIds = existingGroupIds || new Set<string>();

    for (const item of data as any[]) {
      if (item.group_id) {
        // Skip groups already displayed in previous pages
        if (seenGroupIds.has(item.group_id)) continue;

        const existing = grouped.get(item.group_id);
        if (existing) {
          existing.push(item);
        } else {
          grouped.set(item.group_id, [item]);
        }
      } else {
        ungrouped.push(item);
      }
    }

    const galleryPosts: GalleryPost[] = [];

    // Process grouped images — use first as primary, rest as extra_images
    for (const [groupId, items] of grouped) {
      // Sort by position to get deterministic order
      items.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
      const primary = items[0];
      const extras = items.slice(1).map((img: any) => img.url);
      galleryPosts.push({
        id: `portfolio-group-${groupId}`,
        original_id: primary.id,
        image_url: primary.url,
        extra_images: extras.length > 0 ? extras : undefined,
        source: 'portfolio',
        shop_name: primary.shops?.name || '알 수 없음',
        shop_id: primary.shop_id,
        uploader_name: primary.shops?.profiles?.nickname || '셀러',
        created_at: primary.created_at,
        menu_name: primary.shop_menus?.name || undefined,
        cake_type: primary.cake_type,
        occasion: primary.occasion,
        district: primary.shops?.district || undefined,
      });
    }

    // Process ungrouped (single) images
    for (const item of ungrouped) {
      galleryPosts.push({
        id: `portfolio-${item.id}`,
        original_id: item.id,
        image_url: item.url,
        source: 'portfolio',
        shop_name: item.shops?.name || '알 수 없음',
        shop_id: item.shop_id,
        uploader_name: item.shops?.profiles?.nickname || '셀러',
        created_at: item.created_at,
        menu_name: item.shop_menus?.name || undefined,
        cake_type: item.cake_type,
        occasion: item.occasion,
        district: item.shops?.district || undefined,
      });
    }

    // Sort by created_at descending to maintain feed order
    galleryPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return galleryPosts;
  }, []);

  // Reset & reload when filters change
  useEffect(() => {
    async function load() {
      setLoading(true);
      rowOffsetRef.current = 0;
      seenGroupIdsRef.current = new Set();
      const data = await fetchPosts(0, filters, INITIAL_PAGE_SIZE);
      setPosts(data);
      // Track seen group_ids
      for (const p of data) {
        const gid = p.id.startsWith('portfolio-group-') ? p.id.replace('portfolio-group-', '') : null;
        if (gid) seenGroupIdsRef.current.add(gid);
      }
      setHasMore(data.length >= INITIAL_PAGE_SIZE);
      // Update row offset based on actual fetch (pageSize * 3)
      rowOffsetRef.current = INITIAL_PAGE_SIZE * 3;
      setLoading(false);
    }
    load();
  }, [fetchPosts, filters]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          setLoadingMore(true);
          const newPosts = await fetchPosts(rowOffsetRef.current, filters, LOAD_MORE_SIZE, seenGroupIdsRef.current);
          setPosts((prev) => [...prev, ...newPosts]);
          // Track new group_ids
          for (const p of newPosts) {
            const gid = p.id.startsWith('portfolio-group-') ? p.id.replace('portfolio-group-', '') : null;
            if (gid) seenGroupIdsRef.current.add(gid);
          }
          setHasMore(newPosts.length >= LOAD_MORE_SIZE);
          rowOffsetRef.current += LOAD_MORE_SIZE * 3;
          setLoadingMore(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchPosts, filters]);

  return (
    <div className="home-gallery-page">
      {/* ─── Filter Button Group ─── */}
      <div className="home-filter-group">
        {FILTER_GROUPS.map((group) => {
          const isActive = filters[group.key].length > 0;
          return (
            <button
              key={group.key}
              onClick={() => setActiveBottomSheet(group.key)}
              className={`home-filter-btn ${isActive ? 'home-filter-btn-active' : ''}`}
            >
              <span>{group.label}</span>
              {isActive && <span className="text-xs">{filters[group.key].length}</span>}
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>

      {/* ─── Active Tags ─── */}
      {hasActiveFilters && (
        <div className="home-active-tags">
          {allActiveTags.map((tag) => (
            <button
              key={`${tag.key}-${tag.value}`}
              className="home-active-tag"
              onClick={() => removeTag(tag.key, tag.value)}
            >
              <span>{tag.value}</span>
              <XMarkIcon />
            </button>
          ))}
        </div>
      )}

      {/* ─── Gallery Grid ─── */}
      {loading ? (
        <div className="gallery-grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={`sk-${i}`} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="gallery-empty">
          <div className="gallery-empty-icon">
            <CakeIcon className="h-12 w-12 text-primary-200" />
          </div>
          <h2 className="gallery-empty-title">
            {hasActiveFilters ? '조건에 맞는 케이크가 없어요' : '아직 포트폴리오가 없어요'}
          </h2>
          <p className="gallery-empty-desc">
            {hasActiveFilters
              ? '다른 조건으로 검색해 보세요!'
              : '셀러들의 포트폴리오가 곧 등록될 예정이에요!'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={() => setFilters({ design: [], custom: [], occasion: [], size: [], region: [] })}
              className="gallery-empty-link"
            >
              필터 초기화 →
            </button>
          ) : (
            <Link href="/explore" className="gallery-empty-link">
              가게 탐색하기 →
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="gallery-grid">
            {posts.map((post, i) => (
              <GalleryCard key={post.id} post={post} index={i} onSelect={setSelectedPost} />
            ))}
          </div>

          {/* Infinite scroll trigger */}
          {hasMore && (
            <div ref={observerRef} className="gallery-loading-more">
              {loadingMore && (
                <div className="flex items-center gap-2">
                  <div className="gallery-spinner" />
                  <span className="text-xs text-surface-400">더 불러오는 중...</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Bottom Sheet ─── */}
      {activeBottomSheet && (
        <FilterBottomSheet
          title={FILTER_GROUPS.find((g) => g.key === activeBottomSheet)!.label}
          options={FILTER_GROUPS.find((g) => g.key === activeBottomSheet)!.options}
          selected={filters[activeBottomSheet]}
          onApply={(selected) => handleBottomSheetApply(activeBottomSheet, selected)}
          onClose={() => setActiveBottomSheet(null)}
        />
      )}

      {/* ─── Full Page Detail Modal ─── */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="home-gallery-page">
        <div className="gallery-grid">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
