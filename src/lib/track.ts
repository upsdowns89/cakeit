/**
 * Client-side event tracking for shop engagement metrics.
 * Events are fire-and-forget — failures are silently ignored to avoid UX impact.
 */

import { createDataClient } from '@/lib/supabase/client';

export type ShopEventType =
  | 'shop_view'       // user opens shop detail page
  | 'photo_view'      // user views a gallery photo (fullscreen)
  | 'photo_bookmark'  // user bookmarks a photo
  | 'order_click'     // user clicks "주문하기" CTA
  | 'share_click';    // user clicks share button

/**
 * Track a shop engagement event. Fire-and-forget.
 */
export function trackShopEvent(
  shopId: string,
  eventType: ShopEventType,
  metadata?: Record<string, any>
): void {
  try {
    const client = createDataClient();
    // Fire and forget — don't await
    // Cast to any because shop_events table may not be in generated types yet
    (client as any)
      .from('shop_events')
      .insert({
        shop_id: shopId,
        event_type: eventType,
        metadata: metadata || {},
      })
      .then(() => {})
      .catch(() => {}); // silently fail
  } catch {
    // supabase client not available
  }
}

/**
 * Track shop view — deduplicated per session.
 * Only tracks once per shop per browser session to avoid inflating views.
 */
const viewedShops = new Set<string>();

export function trackShopView(shopId: string): void {
  if (viewedShops.has(shopId)) return;
  viewedShops.add(shopId);
  trackShopEvent(shopId, 'shop_view');
}

export function trackPhotoView(shopId: string, photoId?: string): void {
  trackShopEvent(shopId, 'photo_view', photoId ? { photo_id: photoId } : undefined);
}

export function trackOrderClick(shopId: string): void {
  trackShopEvent(shopId, 'order_click');
}

export function trackShareClick(shopId: string): void {
  trackShopEvent(shopId, 'share_click');
}
