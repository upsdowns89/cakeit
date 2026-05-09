'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createDataClient } from '@/lib/supabase/client';
import ShopListCard, { type ShopListCardShop } from '@/components/ShopListCard';

import { BookmarkIcon, CakeIcon, XMarkIcon } from '@/components/icons';
import PostDetailModal from '@/components/PostDetailModal';
import type { GalleryPost } from '@/lib/types';
import {
  getSaveGroups,
  getSavedItems,
  getItemsByGroup,
  removeItemFromGroup,
  saveSaveGroups,
  saveSavedItems,
  type SaveGroup,
  type SavedItem,
} from '@/components/SaveBookmarkSheet';

/* ─── Saved shop bookmark row ─── */
interface SavedShopRich {
  id: string;
  shop_id: string;
  created_at: string;
  shops: ShopListCardShop & { image_url?: string | null };
}

export default function SavedPage() {
  const [savedShops, setSavedShops] = useState<SavedShopRich[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Portfolio groups
  const [groups, setGroups] = useState<SaveGroup[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SaveGroup | null>(null);
  const [selectedPost, setSelectedPost] = useState<GalleryPost | null>(null);

  const [groupImageCounts, setGroupImageCounts] = useState<Record<string, number>>({});
  const [imageGroupIdMap, setImageGroupIdMap] = useState<Record<string, string>>({});

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id || null);
      } catch {
        setUserId(null);
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  // Fetch saved shops with richer data (graceful fallback)
  const fetchSavedShops = useCallback(async () => {
    if (!userId) return;
    try {
      const client = createClient();
      // Try full query first
      const fullSelect = 'id, shop_id, created_at, shops(*, images(url), shop_gallery_images(url), shop_menus(name, shop_menu_sizes(price_min)))';
      const { data, error } = await client
        .from('bookmarks')
        .select(fullSelect)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback: minimal query without relations that may not exist
        const fallback = await client
          .from('bookmarks')
          .select('id, shop_id, created_at, shops(name, district, address, image_url)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (fallback.data) setSavedShops(fallback.data as any);
      } else if (data) {
        setSavedShops(data as any);
      }
    } catch {
      // silently fail
    }
  }, [userId]);

  // Load portfolio groups from localStorage
  const loadPortfolioGroups = useCallback(() => {
    setGroups(getSaveGroups());
    setSavedItems(getSavedItems());
  }, []);

  useEffect(() => {
    if (userId) {
      fetchSavedShops();
    }
    loadPortfolioGroups();
  }, [userId, fetchSavedShops, loadPortfolioGroups]);



  // Fetch multi-image counts and group_id mapping when viewing group detail
  useEffect(() => {
    if (!selectedGroup) {
      setGroupImageCounts({});
      setImageGroupIdMap({});
      return;
    }
    const groupItems = getItemsByGroup(selectedGroup.id);
    if (groupItems.length === 0) return;

    async function fetchGroupCounts() {
      try {
        const client = createDataClient();
        const imageIds = groupItems.map(i => i.imageId);
        const { data } = await client
          .from('shop_gallery_images')
          .select('id, group_id')
          .in('id', imageIds);

        if (!data) return;

        const groupIds = [...new Set(data.filter((d: any) => d.group_id).map((d: any) => d.group_id))];

        // Build imageId -> DB group_id mapping
        const groupIdByImageId: Record<string, string> = {};
        for (const d of data as any[]) {
          if (d.group_id) groupIdByImageId[d.id] = d.group_id;
        }
        setImageGroupIdMap(groupIdByImageId);

        if (groupIds.length === 0) return;

        const { data: counts } = await client
          .from('shop_gallery_images')
          .select('group_id')
          .in('group_id', groupIds);

        if (!counts) return;

        const countMap: Record<string, number> = {};
        for (const c of counts as any[]) {
          countMap[c.group_id] = (countMap[c.group_id] || 0) + 1;
        }

        const result: Record<string, number> = {};
        for (const [imgId, gid] of Object.entries(groupIdByImageId)) {
          result[imgId] = countMap[gid] || 1;
        }
        setGroupImageCounts(result);
      } catch { /* silent */ }
    }
    fetchGroupCounts();
  }, [selectedGroup]);

  // Delete group handler
  const handleDeleteGroup = (groupId: string) => {
    if (groupId === 'default') return;
    const updated = groups.filter(g => g.id !== groupId);
    saveSaveGroups(updated);
    const items = getSavedItems().filter(i => i.groupId !== groupId);
    saveSavedItems(items);
    setGroups(updated);
    setSavedItems(items);
    if (selectedGroup?.id === groupId) setSelectedGroup(null);
  };

  // Remove item from group
  const handleRemoveItem = (imageId: string, groupId: string) => {
    removeItemFromGroup(imageId, groupId);
    setSavedItems(getSavedItems());
  };

  // Open portfolio detail
  const openPortfolioDetail = (item: SavedItem) => {
    setSelectedPost({
      id: `saved-${item.imageId}`,
      original_id: item.imageId,
      image_url: item.imageUrl,
      source: 'portfolio',
      shop_name: item.shopName,
      shop_id: item.shopId,
      uploader_name: '',
      created_at: item.savedAt,
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="gallery-spinner !h-6 !w-6" />
      </div>
    );
  }

  // ─── Group Detail View (depth navigation) ───
  if (selectedGroup) {
    const allGroupItems = getItemsByGroup(selectedGroup.id);

    // Filter out duplicate items from the same DB group_id (show only the first saved one)
    const groupItems = allGroupItems.filter((item, _idx, arr) => {
      const dbGroupId = imageGroupIdMap[item.imageId];
      if (!dbGroupId) return true; // no group_id → always show
      // Keep only the first item in this array that maps to this dbGroupId
      const firstOfGroup = arr.find(i => imageGroupIdMap[i.imageId] === dbGroupId);
      return firstOfGroup === item;
    });

    return (
      <div className="min-h-screen bg-white" style={{ marginTop: '-52px', paddingTop: 0 }}>
        {/* Depth-style GNB */}
        <nav className="sticky top-0 z-50 bg-white">
          <div className="flex h-[52px] items-center px-4">
            <button
              onClick={() => { setSelectedGroup(null); loadPortfolioGroups(); }}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100 transition-colors active:scale-95"
            >
              <svg className="h-5 w-5 text-surface-900" viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-[15px] font-bold text-surface-900 truncate">{selectedGroup.name}</h1>
              <p className="text-[11px] text-surface-400 -mt-0.5">{groupItems.length}개 저장됨</p>
            </div>
            <div className="w-9" />
          </div>
        </nav>

        {groupItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-surface-50">
              <CakeIcon className="h-8 w-8 text-surface-200" />
            </div>
            <h3 className="text-base font-bold text-surface-800">아직 비어있어요</h3>
            <p className="mt-1 text-sm text-surface-400">포트폴리오에서 저장해보세요</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {groupItems.map((item) => (
              <div key={`${item.imageId}-${item.groupId}`} className="gallery-card group">
                <button onClick={() => openPortfolioDetail(item)} className="block w-full text-left">
                  <div className="gallery-card-image">
                    <img
                      src={item.imageUrl}
                      alt={`${item.shopName} 케이크`}
                      className="transition-all duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Multi-image badge */}
                    {(groupImageCounts[item.imageId] || 0) > 1 && (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                          <rect x="5" y="1" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                        </svg>
                        <span className="text-[10px] font-semibold text-white leading-none">{groupImageCounts[item.imageId]}</span>
                      </div>
                    )}
                  </div>
                  <div className="gallery-card-info">
                    <p className="gallery-card-shop">{item.shopName}</p>
                    <div className="gallery-card-meta">
                      {item.district && (
                        <>
                          <span>{item.district}</span>
                          {item.menuName && <span className="gallery-card-meta-dot" />}
                        </>
                      )}
                      {item.menuName && <span className="truncate">{item.menuName}</span>}
                      {!item.district && !item.menuName && <span>&nbsp;</span>}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => handleRemoveItem(item.imageId, selectedGroup.id)}
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <XMarkIcon className="h-4 w-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedPost && (
          <PostDetailModal
            post={selectedPost}
            onClose={() => { setSelectedPost(null); loadPortfolioGroups(); }}
          />
        )}
      </div>
    );
  }

  // ─── Not Logged In: show login prompt ───
  if (!userId) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-50 to-warm-50">
            <BookmarkIcon className="h-10 w-10 text-primary-300" />
          </div>
          <h3 className="text-lg font-bold text-surface-800">로그인이 필요해요</h3>
          <p className="mt-1.5 text-sm text-surface-400 leading-relaxed">
            로그인하고 마음에 드는 케이크와 가게를 저장해보세요
          </p>
          <Link
            href="/login"
            className="mt-5 rounded-full bg-surface-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-surface-800 active:scale-95"
          >
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  // ─── Main Page ───
  const allItems = getSavedItems();
  const hasPortfolio = groups.length > 0 && allItems.length > 0;
  const hasShops = savedShops.length > 0;
  const isAllEmpty = !hasPortfolio && !hasShops;

  return (
    <div className="min-h-screen bg-white pb-20">

      {/* ─── Empty State ─── */}
      {isAllEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-50 to-warm-50">
            <BookmarkIcon className="h-10 w-10 text-primary-300" />
          </div>
          <h3 className="text-lg font-bold text-surface-800">아직 저장한 것이 없어요</h3>
          <p className="mt-1.5 text-sm text-surface-400 leading-relaxed">
            마음에 드는 케이크와 가게를 저장해보세요
          </p>
          <Link
            href="/"
            className="mt-5 rounded-full bg-surface-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-surface-800 active:scale-95"
          >
            발견에서 둘러보기
          </Link>
        </div>
      )}

      {/* ─── 케이크 앨범 Section (Figma: 2x2 mosaic per album) ─── */}
      {hasPortfolio && (
        <section className="px-4 py-3">
          {/* Section Header */}
          <div className="flex items-center gap-1 pb-5">
            <h2 className="text-[16px] font-semibold text-surface-900 leading-[1.25]">케이크 앨범</h2>
            <span className="text-[16px] font-semibold text-surface-400 leading-[1.25]">{groups.filter(g => getItemsByGroup(g.id).length > 0).length}</span>
          </div>

          {/* Album Grid */}
          <div className="grid grid-cols-2 gap-4">
            {groups.map((group) => {
              const groupItems = getItemsByGroup(group.id);
              const count = groupItems.length;
              if (count === 0) return null;

              // Get up to 4 preview images
              const previews = groupItems.slice(-4).reverse();

              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className="flex flex-col gap-3 items-start pb-2 text-left transition-transform active:scale-[0.97]"
                >
                  {/* Dynamic mosaic thumbnail */}
                  {count === 1 ? (
                    <div className="w-full rounded-[20px] overflow-hidden aspect-square relative">
                      <div className="absolute inset-0 bg-black/[0.04] z-[1]" />
                      <img src={previews[0].imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 grid-rows-2 gap-px w-full rounded-[20px] overflow-hidden aspect-square">
                      {[0, 1, 2, 3].map((idx) => (
                        <div key={idx} className="relative">
                          {previews[idx] ? (
                            <>
                              <div className="absolute inset-0 bg-black/[0.04] z-[1]" />
                              <img src={previews[idx].imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            </>
                          ) : (
                            <div className="w-full h-full bg-black/[0.04]" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Album name */}
                  <p className="text-[14px] font-semibold text-surface-900 leading-[1.25] truncate w-full">
                    {group.name}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Section Divider ─── */}
      {hasPortfolio && hasShops && (
        <div className="mx-4 my-2" style={{ height: '1px', backgroundColor: 'var(--stroke-neutral-deep)' }} />
      )}

      {/* ─── 저장된 베이커리 Section (ShopListCard reuse) ─── */}
      {hasShops && (
        <section className="px-4 py-3">
          {/* Section Header */}
          <div className="flex items-center gap-1 pb-5">
            <h2 className="text-[16px] font-semibold text-surface-900 leading-[1.25]">저장된 베이커리</h2>
            <span className="text-[16px] font-semibold text-surface-400 leading-[1.25]">{savedShops.length}</span>
          </div>

          {/* Shop Cards — reuse ShopListCard from category detail */}
          <div className="flex flex-col gap-4">
            {savedShops.map((item, index) => {
              const shopData = item.shops;
              if (!shopData) return null;
              // Map to ShopListCardShop shape
              const cardShop: ShopListCardShop = {
                id: item.shop_id,
                name: shopData.name,
                address: shopData.address,
                district: shopData.district,
                is_delivery: shopData.is_delivery,
                is_pickup: shopData.is_pickup,
                is_custom_order: shopData.is_custom_order,
                cake_types: shopData.cake_types,
                images: shopData.images,
                shop_gallery_images: shopData.shop_gallery_images,
                shop_menus: shopData.shop_menus,
              };
              return (
                <React.Fragment key={item.id}>
                  <ShopListCard shop={cardShop} showDivider={false} />
                  {index < savedShops.length - 1 && <div className="slc-divider" />}
                </React.Fragment>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Partial Empty States ─── */}
      {!hasPortfolio && hasShops && (
        <section className="px-4 py-3">
          <div className="flex items-center gap-1 pb-5">
            <h2 className="text-[16px] font-semibold text-surface-900 leading-[1.25]">케이크 앨범</h2>
          </div>
          <div className="saved-empty-inline">
            <CakeIcon className="h-6 w-6 text-surface-200" />
            <p>마음에 드는 케이크를 저장해보세요</p>
          </div>
        </section>
      )}

      {hasPortfolio && !hasShops && userId && (
        <section className="px-4 py-3">
          <div className="flex items-center gap-1 pb-5">
            <h2 className="text-[16px] font-semibold text-surface-900 leading-[1.25]">저장된 베이커리</h2>
          </div>
          <div className="saved-empty-inline">
            <BookmarkIcon className="h-6 w-6 text-surface-200" />
            <p>가게 페이지에서 저장해보세요</p>
          </div>
        </section>
      )}

      {/* Portfolio Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => { setSelectedPost(null); loadPortfolioGroups(); }}
        />
      )}
    </div>
  );
}
