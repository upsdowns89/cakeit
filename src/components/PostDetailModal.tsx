'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createDataClient } from '@/lib/supabase/client';
import type { ShopGalleryImage, GalleryPost } from '@/lib/types';
import {
  ArrowLeftIcon,
  XMarkIcon as CloseIcon,
  CakeIcon,
  HeartIcon,
  HeartSolidIcon,
  ShareIcon,
  DownloadIcon,
  BookmarkSolidIcon,
  BookmarkIcon,
} from '@/components/icons';
import SaveBookmarkSheet, { isItemSaved } from '@/components/SaveBookmarkSheet';

interface PortfolioDetail extends ShopGalleryImage {
  shops?: { id: string; name: string; address: string; image_url: string | null; district: string | null };
  shop_menus?: { id: string; name: string } | null;
}

interface PostDetailModalProps {
  post: GalleryPost;
  onClose: () => void;
  /** If provided, enables prev/next navigation in the same shop's portfolios */
  siblingIds?: string[];
  onNavigate?: (newPost: GalleryPost) => void;
}

export default function PostDetailModal({ post, onClose, siblingIds, onNavigate }: PostDetailModalProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  // Internal history stack for in-place navigation
  const [historyStack, setHistoryStack] = useState<GalleryPost[]>([]);
  const [currentPost, setCurrentPost] = useState<GalleryPost>(post);

  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null);
  const [groupImages, setGroupImages] = useState<ShopGalleryImage[]>([]);
  const [relatedImages, setRelatedImages] = useState<ShopGalleryImage[]>([]);
  const [relatedGroupCounts, setRelatedGroupCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Download menu state
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Image slider state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchDiffX = useRef(0);
  const isDragging = useRef(false);
  const isHorizontalSwipe = useRef(false);
  const currentTranslateX = useRef(0);

  const hasHistory = historyStack.length > 0;

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2200);
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(), 280);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleClose]);

  // Close download menu when clicking outside
  useEffect(() => {
    if (!showDownloadMenu) return;
    const handleClickOutside = () => setShowDownloadMenu(false);
    setTimeout(() => window.addEventListener('click', handleClickOutside), 0);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showDownloadMenu]);

  // Load portfolio data — reacts to currentPost changes
  useEffect(() => {
    async function load() {
      setLoading(true);
      setPortfolio(null);
      setGroupImages([]);
      setRelatedImages([]);
      setCurrentImageIndex(0);
      setLiked(false);
      setIsSaved(isItemSaved(currentPost.original_id));

      try {
        const client = createDataClient();

        const { data } = await client
          .from('shop_gallery_images')
          .select('*, shops!inner(id, name, address, image_url, district), shop_menus(id, name)')
          .eq('id', currentPost.original_id)
          .single();

        if (data) {
          setPortfolio(data as unknown as PortfolioDetail);

          // Fetch group images (same group_id)
          if ((data as any).group_id) {
            const { data: grouped } = await client
              .from('shop_gallery_images')
              .select('id, url, is_portfolio, created_at, group_id, position')
              .eq('group_id', (data as any).group_id)
              .order('position', { ascending: true });

            if (grouped && grouped.length > 1) {
              setGroupImages(grouped as unknown as ShopGalleryImage[]);
            }
          }

          // Fetch related (same shop, portfolio only)
          const currentGroupId = (data as any).group_id;
          const { data: related } = await client
            .from('shop_gallery_images')
            .select('id, url, is_portfolio, created_at, shop_id, group_id, position')
            .eq('shop_id', (data as any).shop_id)
            .eq('is_portfolio', true)
            .neq('id', currentPost.original_id)
            .order('position', { ascending: true })
            .limit(50);

          if (related) {
            // Group by group_id: keep the image with the lowest position per group
            const groupCountMap: Record<string, number> = {};
            const groupBestImage: Record<string, any> = {};
            const ungrouped: any[] = [];

            for (const img of related as any[]) {
              // Skip images from the same group as the current portfolio
              if (currentGroupId && img.group_id === currentGroupId) continue;

              if (img.group_id) {
                groupCountMap[img.group_id] = (groupCountMap[img.group_id] || 0) + 1;
                // Keep the image with the lowest position as cover
                if (!groupBestImage[img.group_id] || img.position < groupBestImage[img.group_id].position) {
                  groupBestImage[img.group_id] = img;
                }
              } else {
                ungrouped.push(img);
              }
            }

            // Build deduplicated list: one cover per group + ungrouped
            const deduped: ShopGalleryImage[] = [];
            const countsById: Record<string, number> = {};

            for (const [gid, coverImg] of Object.entries(groupBestImage)) {
              deduped.push(coverImg as unknown as ShopGalleryImage);
              countsById[coverImg.id] = groupCountMap[gid] || 1;
            }
            for (const img of ungrouped) {
              deduped.push(img as unknown as ShopGalleryImage);
              countsById[img.id] = 1;
            }

            // Sort by position for consistent ordering
            deduped.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

            setRelatedImages(deduped.slice(0, 9));
            setRelatedGroupCounts(countsById);
          }
        }
      } catch { /* silent */ }
      setLoading(false);

      // Scroll content to top
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    load();
  }, [currentPost]);

  // All images to show in the slider
  const allImages = groupImages.length > 1 ? groupImages : (portfolio ? [portfolio] : []);
  const totalImages = allImages.length;
  const hasMultipleImages = totalImages > 1;

  // Use refs for currentImageIndex and totalImages so native listeners always see latest values
  const currentImageIndexRef = useRef(currentImageIndex);
  currentImageIndexRef.current = currentImageIndex;
  const totalImagesRef = useRef(totalImages);
  totalImagesRef.current = totalImages;

  // Attach native (non-passive) touch listeners for proper swipe handling
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchDiffX.current = 0;
      isDragging.current = true;
      isHorizontalSwipe.current = false;
      currentTranslateX.current = 0;
      el.style.transition = 'none';
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;

      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;

      // Determine direction on first significant move
      if (!isHorizontalSwipe.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

      if (!isHorizontalSwipe.current) {
        if (Math.abs(dx) > Math.abs(dy)) {
          isHorizontalSwipe.current = true;
        } else {
          isDragging.current = false;
          return;
        }
      }

      // This works because we register with { passive: false }
      e.preventDefault();
      e.stopPropagation();

      touchDiffX.current = dx;
      currentTranslateX.current = dx;

      const baseOffset = -(currentImageIndexRef.current * 100);
      const containerWidth = el.parentElement?.offsetWidth || 375;
      const pctOffset = (dx / containerWidth) * 100;
      el.style.transform = `translateX(${baseOffset + pctOffset}%)`;
    };

    const handleTouchEnd = () => {
      if (!isDragging.current && !isHorizontalSwipe.current) return;
      isDragging.current = false;

      el.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

      const threshold = 50;
      if (isHorizontalSwipe.current) {
        const idx = currentImageIndexRef.current;
        const total = totalImagesRef.current;
        if (touchDiffX.current < -threshold && idx < total - 1) {
          setCurrentImageIndex(i => i + 1);
        } else if (touchDiffX.current > threshold && idx > 0) {
          setCurrentImageIndex(i => i - 1);
        } else {
          el.style.transform = `translateX(-${idx * 100}%)`;
        }
      }

      isHorizontalSwipe.current = false;
    };

    // ── Mouse drag handlers (desktop support) ──
    const handleMouseDown = (e: MouseEvent) => {
      touchStartX.current = e.clientX;
      touchStartY.current = e.clientY;
      touchDiffX.current = 0;
      isDragging.current = true;
      isHorizontalSwipe.current = false;
      currentTranslateX.current = 0;
      el.style.transition = 'none';
      el.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const dx = e.clientX - touchStartX.current;
      const dy = e.clientY - touchStartY.current;

      if (!isHorizontalSwipe.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

      if (!isHorizontalSwipe.current) {
        if (Math.abs(dx) > Math.abs(dy)) {
          isHorizontalSwipe.current = true;
        } else {
          isDragging.current = false;
          el.style.cursor = 'grab';
          return;
        }
      }

      e.preventDefault();
      touchDiffX.current = dx;
      currentTranslateX.current = dx;

      const baseOffset = -(currentImageIndexRef.current * 100);
      const containerWidth = el.parentElement?.offsetWidth || 375;
      const pctOffset = (dx / containerWidth) * 100;
      el.style.transform = `translateX(${baseOffset + pctOffset}%)`;
    };

    const handleMouseUp = () => {
      if (!isDragging.current && !isHorizontalSwipe.current) return;
      isDragging.current = false;
      el.style.cursor = 'grab';

      el.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

      const threshold = 50;
      if (isHorizontalSwipe.current) {
        const idx = currentImageIndexRef.current;
        const total = totalImagesRef.current;
        if (touchDiffX.current < -threshold && idx < total - 1) {
          setCurrentImageIndex(i => i + 1);
        } else if (touchDiffX.current > threshold && idx > 0) {
          setCurrentImageIndex(i => i - 1);
        } else {
          el.style.transform = `translateX(-${idx * 100}%)`;
        }
      }

      isHorizontalSwipe.current = false;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mouseleave', handleMouseUp);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [portfolio, groupImages]); // Re-attach when data changes

  // Toolbar actions
  const handleShare = async () => {
    const url = `${window.location.origin}/portfolio/${post.original_id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${post.shop_name} 케이크`, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast('링크가 복사되었습니다!');
      }
    } catch { /* cancelled */ }
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `everycake-${post.original_id}-${index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleDownload = () => {
    if (!hasMultipleImages) {
      // Single image — download directly
      if (allImages[currentImageIndex]) {
        downloadImage(allImages[currentImageIndex].url, currentImageIndex);
      }
      return;
    }
    // Multiple images — show menu
    setShowDownloadMenu(true);
  };

  const handleDownloadCurrent = () => {
    setShowDownloadMenu(false);
    if (allImages[currentImageIndex]) {
      downloadImage(allImages[currentImageIndex].url, currentImageIndex);
    }
  };

  const handleDownloadAll = async () => {
    setShowDownloadMenu(false);
    showToast('전체 사진 다운로드 중...');
    for (let i = 0; i < allImages.length; i++) {
      await downloadImage(allImages[i].url, i);
      // Small delay between downloads
      if (i < allImages.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    showToast(`${allImages.length}장 다운로드 완료!`);
  };

  // Build tags from portfolio data
  const buildTags = (): { label: string; filterKey: string; value: string }[] => {
    if (!portfolio) return [];
    const tags: { label: string; filterKey: string; value: string }[] = [];

    if (portfolio.cake_type) tags.push({ label: portfolio.cake_type, filterKey: 'design', value: portfolio.cake_type });
    if (portfolio.occasion) tags.push({ label: portfolio.occasion, filterKey: 'occasion', value: portfolio.occasion });
    if (portfolio.cake_size) tags.push({ label: portfolio.cake_size, filterKey: 'size', value: portfolio.cake_size });

    return tags;
  };
  const tags = buildTags();

  const handleTagClick = (filterKey: string, value: string) => {
    handleClose();
    setTimeout(() => {
      router.push(`/?tag_key=${filterKey}&tag_value=${value}`);
    }, 300);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  // Handle clicking a related portfolio — navigate in-place
  const handleRelatedClick = (imgId: string) => {
    // Push current post to history stack
    setHistoryStack(prev => [...prev, currentPost]);
    // Navigate to the new post
    setCurrentPost({
      id: `portfolio-${imgId}`,
      original_id: imgId,
      image_url: '',
      source: 'portfolio',
      shop_name: currentPost.shop_name,
      shop_id: currentPost.shop_id,
      uploader_name: currentPost.uploader_name,
      created_at: '',
    });
  };

  // Go back in history
  const handleBack = () => {
    if (historyStack.length > 0) {
      const prev = historyStack[historyStack.length - 1];
      setHistoryStack(s => s.slice(0, -1));
      setCurrentPost(prev);
    }
  };

  // Save bookmark callback
  const handleSaved = (groupName: string) => {
    setIsSaved(true);
    showToast(`'${groupName}'에 저장되었습니다`);
  };

  const handleRemoved = (groupName: string) => {
    setIsSaved(isItemSaved(currentPost.original_id));
    showToast(`'${groupName}'에서 삭제되었습니다`);
  };

  return (
    <>
    <div className={`post-modal-overlay ${isClosing ? 'post-modal-closing' : ''}`}>
      <div className={`post-modal-container ${isClosing ? 'post-modal-slide-down' : ''}`}>
        {/* ─── Header ─── */}
        <div className="post-modal-header">
          {hasHistory ? (
            <button onClick={handleBack} className="post-modal-back-btn">
              <ArrowLeftIcon className="h-5 w-5 text-surface-900" />
            </button>
          ) : (
            <div className="w-9" />
          )}
          <div className="flex-1" />
          <button onClick={handleClose} className="post-modal-back-btn">
            <CloseIcon className="h-6 w-6 text-surface-900" />
          </button>
        </div>

          {/* ─── Content ─── */}
          <div ref={contentRef} className="post-modal-content hide-scrollbar">
            {loading ? (
              <div className="min-h-screen bg-white">
                <div className="aspect-square animate-shimmer" />
                <div className="px-4 py-5 space-y-3">
                  <div className="h-5 w-3/4 animate-shimmer rounded-lg" />
                  <div className="h-4 w-1/2 animate-shimmer rounded-lg" />
                  <div className="h-20 w-full animate-shimmer rounded-xl" />
                </div>
              </div>
            ) : portfolio ? (
              <>
                {/* ─── Image Slider ─── */}
                <div className="post-image-slider">
                  <div
                    ref={sliderRef}
                    className="post-image-track"
                    style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                  >
                    {allImages.map((img, i) => (
                      <div key={img.id || i} className="post-image-slide">
                        <img
                          src={img.url}
                          alt={`케이크 ${i + 1}`}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Counter badge */}
                  {hasMultipleImages && (
                    <div className="post-image-counter">
                      {currentImageIndex + 1}/{totalImages}
                    </div>
                  )}

                  {/* Indicator dots */}
                  {hasMultipleImages && (
                    <div className="post-image-indicators">
                      {allImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImageIndex(i)}
                          className={`post-image-dot ${i === currentImageIndex ? 'post-image-dot-active' : ''}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── Toolbar ─── */}
                <div className="post-toolbar">
                  <button
                    onClick={() => setLiked(!liked)}
                    className="post-toolbar-btn"
                  >
                    {liked
                      ? <HeartSolidIcon className="h-6 w-6 text-red-500" />
                      : <HeartIcon className="h-6 w-6 text-surface-900" />
                    }
                  </button>

                  <div className="flex items-center gap-1">
                    <button onClick={handleShare} className="post-toolbar-btn">
                      <ShareIcon className="h-6 w-6 text-surface-900" />
                    </button>
                    <div className="relative">
                      <button onClick={handleDownload} className="post-toolbar-btn">
                        <DownloadIcon className="h-6 w-6 text-surface-900" />
                      </button>
                      {/* Download Menu */}
                      {showDownloadMenu && (
                        <div className="post-download-menu" onClick={e => e.stopPropagation()}>
                          <button onClick={handleDownloadCurrent} className="post-download-menu-item">
                            이 사진 다운로드
                          </button>
                          <div className="post-download-menu-divider" />
                          <button onClick={handleDownloadAll} className="post-download-menu-item">
                            전체 다운로드 ({totalImages}장)
                          </button>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setShowSaveSheet(true)} className={isSaved ? 'post-save-btn post-save-btn-saved' : 'post-save-btn'}>
                      {isSaved
                        ? <BookmarkSolidIcon className="h-4 w-4 text-white" />
                        : <BookmarkIcon className="h-4 w-4 text-white" />
                      }
                      <span>{isSaved ? '저장됨' : '저장'}</span>
                    </button>
                  </div>
                </div>

                {/* ─── Text Group ─── */}
                <div className="post-text-group">
                  {/* Shop name | district | menu */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/shop/${portfolio.shops?.id}`}
                      onClick={(e) => { e.preventDefault(); handleClose(); setTimeout(() => router.push(`/shop/${portfolio.shops?.id}`), 300); }}
                      className="text-sm font-semibold text-surface-900 hover:underline"
                    >
                      {portfolio.shops?.name || post.shop_name}
                    </Link>
                    {portfolio.shops?.district && (
                      <>
                        <span className="post-text-divider" />
                        <span className="text-sm text-surface-400">{portfolio.shops.district}</span>
                      </>
                    )}
                    {portfolio.shop_menus?.name && (
                      <>
                        <span className="post-text-divider" />
                        <span className="text-sm text-surface-400">{portfolio.shop_menus.name}</span>
                      </>
                    )}
                  </div>

                  {/* Description */}
                  {portfolio.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-surface-900">
                      {portfolio.description}
                    </p>
                  )}

                  {/* Date */}
                  <p className="mt-3 text-xs text-surface-400">
                    {formatDate(portfolio.created_at)}
                  </p>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {tags.map((tag, i) => (
                        <button
                          key={`${tag.filterKey}-${tag.value}-${i}`}
                          onClick={() => handleTagClick(tag.filterKey, tag.value)}
                          className="post-tag-pill"
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── Related Portfolios ─── */}
                {relatedImages.length > 0 && (
                  <div className="post-related-section">
                    <h3 className="text-sm font-semibold text-surface-900">
                      이 가게의 다른 포트폴리오
                    </h3>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {relatedImages.slice(0, 9).map((img, i) => {
                        const isLast = i === 8 && relatedImages.length > 8;
                        const count = relatedGroupCounts[img.id] || 1;
                        return (
                          <button
                            key={img.id}
                            onClick={() => handleRelatedClick(img.id)}
                            className="relative aspect-square overflow-hidden rounded-lg transition-transform active:scale-95"
                          >
                            <img src={img.url} alt="" className="h-full w-full object-cover" />
                            {count > 1 && !isLast && (
                              <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                                  <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                                  <rect x="5" y="1" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                                </svg>
                                <span className="text-[9px] font-semibold text-white leading-none">{count}</span>
                              </div>
                            )}
                            {isLast && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                <span className="text-sm font-semibold text-white">더보기</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Spacer for bottom nav */}
                <div className="h-40" />
              </>
            ) : (
              /* ─── Not Found ─── */
              <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
                <CakeIcon className="mb-3 h-12 w-12 text-surface-200" />
                <p className="text-sm text-surface-500">포스트를 찾을 수 없어요</p>
                <button onClick={handleClose} className="mt-4 text-sm font-medium text-primary-500">
                  돌아가기
                </button>
              </div>
            )}
          </div>

          {/* ─── Bottom Navigation ─── */}
          {!loading && portfolio && (
            <div className="post-bottom-nav">
              <div className="post-bottom-gradient" />
              <div className="post-bottom-buttons">
                {hasHistory && (
                  <button onClick={handleBack} className="post-bottom-btn">
                    이전
                  </button>
                )}
                <button onClick={handleClose} className="post-bottom-btn">
                  닫기
                </button>
              </div>
            </div>
          )}
      </div>
    </div>

    {/* ─── Toast Message ─── */}
    {toastMessage && (
      <div className="post-toast">
        <div className="post-toast-content">
          <svg className="h-4 w-4 text-white flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      </div>
    )}

    {/* ─── Save Bookmark Bottom Sheet ─── */}
    {portfolio && (
      <SaveBookmarkSheet
        isOpen={showSaveSheet}
        onClose={() => {
          setShowSaveSheet(false);
          setIsSaved(isItemSaved(currentPost.original_id));
        }}
        onSaved={handleSaved}
        onRemoved={handleRemoved}
        imageId={currentPost.original_id}
        imageUrl={allImages[0]?.url || ''}
        shopName={portfolio.shops?.name || currentPost.shop_name}
        shopId={portfolio.shop_id}
        district={portfolio.shops?.district || undefined}
        menuName={portfolio.shop_menus?.name || undefined}
      />
    )}
    </>
  );
}
