'use client';

import Link from 'next/link';
import { CakeIcon } from '@/components/icons';

/* ─── Types for the card ─── */
export interface ShopListCardShop {
  id: string;
  name: string;
  address?: string | null;
  district?: string | null;
  area?: string | null;
  is_delivery?: boolean;
  is_pickup?: boolean;
  is_custom_order?: boolean;
  cake_types?: string[] | null;
  images?: { url: string }[];
  shop_gallery_images?: { url: string }[];
  shop_menus?: {
    name: string;
    shop_menu_sizes?: { price_min: number }[];
  }[];
}

interface ShopListCardProps {
  shop: ShopListCardShop;
  showDivider?: boolean;
}

/* ─── Helper: short area from address ─── */
function getShortAddress(shop: ShopListCardShop): string {
  if (shop.area) return shop.area;
  if (shop.district) return shop.district;
  if (shop.address) {
    // Try "서울 강남구 개포동" style
    const match = shop.address.match(/(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충[남북]|전[남북]|경[남북]|제주)\s*([가-힣]+[시군구])\s*([가-힣]+[동면읍리])/);
    if (match) return `${match[1]} ${match[2]} ${match[3]}`;
    return shop.address;
  }
  return '';
}

/* ─── Collect portfolio images for horizontal scroll ─── */
function getPortfolioImages(shop: ShopListCardShop): string[] {
  const imgs: string[] = [];
  if (shop.shop_gallery_images) {
    for (const img of shop.shop_gallery_images) {
      if (img.url && !imgs.includes(img.url)) imgs.push(img.url);
    }
  }
  if (shop.images) {
    for (const img of shop.images) {
      if (img.url && !imgs.includes(img.url)) imgs.push(img.url);
    }
  }
  return imgs.slice(0, 8);
}

/* ─── ShopListCard Component ─── */
export default function ShopListCard({ shop, showDivider = true }: ShopListCardProps) {
  const portfolioImages = getPortfolioImages(shop);
  const shortAddr = getShortAddress(shop);
  const menus = shop.shop_menus || [];
  const firstMenu = menus[0];

  /* Badges: 주문제작/배달가능 (highlight) + cake_types (neutral) */
  const highlightBadges: string[] = [];
  if (shop.is_custom_order) highlightBadges.push('주문제작');
  if (shop.is_delivery) highlightBadges.push('배달가능');

  const tagBadges: string[] = (shop.cake_types || []).slice(0, 4);

  return (
    <div className="slc-root">
      <Link href={`/shop/${shop.id}`} className="slc-card-link">
        {/* ─ Portfolio images ─ */}
        {portfolioImages.length === 1 ? (
          /* Single image: full width */
          <div
            className="slc-image-single"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.location.href = `/shop/${shop.id}?tab=photos`;
            }}
          >
            <div className="slc-image-overlay" />
            <img src={portfolioImages[0]} alt="" className="slc-image-img" loading="lazy" />
          </div>
        ) : portfolioImages.length > 1 ? (
          /* Multiple images: horizontal scroll */
          <div
            className="slc-image-scroll"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.location.href = `/shop/${shop.id}?tab=photos`;
            }}
          >
            {portfolioImages.map((url, i) => {
              const isLast = i === portfolioImages.length - 1 && portfolioImages.length >= 8;
              return (
                <div key={i} className="slc-image-item">
                  <div className="slc-image-overlay" />
                  <img src={url} alt="" className="slc-image-img" loading="lazy" />
                  {isLast && (
                    <div className="slc-image-more">
                      <span className="slc-image-more-text">더보기</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* ─ Info group ─ */}
        <div className="slc-info">
          {/* Name + more icon */}
          <div className="slc-name-row">
            <h3 className="slc-name">{shop.name}</h3>
            <div className="slc-more-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="4" cy="10" r="1.5" fill="var(--scale-gray-40)" />
                <circle cx="10" cy="10" r="1.5" fill="var(--scale-gray-40)" />
                <circle cx="16" cy="10" r="1.5" fill="var(--scale-gray-40)" />
              </svg>
            </div>
          </div>

          {/* Status + address */}
          <div className="slc-detail-group">
            <div className="slc-meta-row">
              <span className="slc-meta-text">영업중</span>
              <span className="slc-dot" />
              <span className="slc-meta-text slc-meta-truncate">{shortAddr}</span>
            </div>

            {/* Representative menu line (피그마: 대표 + 메뉴 gap: 6px, 메뉴간 dot gap: 4px) */}
            {firstMenu && (
              <div className="slc-meta-row">
                <div className="slc-rep-group">
                  <span className="slc-badge-rep">대표</span>
                  <span className="slc-menu-text">{firstMenu.name}</span>
                </div>
                {menus[1] && (
                  <>
                    <span className="slc-dot" />
                    <span className="slc-menu-text">{menus[1].name}</span>
                  </>
                )}
                {menus[2] && (
                  <>
                    <span className="slc-dot" />
                    <span className="slc-menu-text">{menus[2].name}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─ Badge group ─ */}
        {(highlightBadges.length > 0 || tagBadges.length > 0) && (
          <div className="slc-badge-group">
            {highlightBadges.map((b) => (
              <span key={b} className="slc-badge-highlight">
                <span className="slc-badge-fire">🔥</span>
                {b}
              </span>
            ))}
            {tagBadges.map((b) => (
              <span key={b} className="slc-badge-neutral">{b}</span>
            ))}
          </div>
        )}
      </Link>

      {/* Divider */}
      {showDivider && <div className="slc-divider" />}
    </div>
  );
}
