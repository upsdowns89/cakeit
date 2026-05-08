/**
 * Shop popularity scoring based on consumer engagement metrics.
 *
 * Score components (weighted):
 *   - Shop view count         × 1.0
 *   - Photo view count        × 0.5
 *   - Bookmark count          × 5.0
 *   - Review count            × 10.0
 *   - Average rating (1-5)    × 5.0
 *   - Order/CTA click count   × 3.0
 *
 * The score is pre-computed in `shop_popularity` table via
 * the `refresh_shop_popularity()` SQL function.
 *
 * This module provides a client-side fallback calculator
 * for when the pre-computed scores haven't been generated yet.
 */

export interface PopularityInput {
  viewCount: number;
  photoViewCount: number;
  bookmarkCount: number;
  reviewCount: number;
  avgRating: number;
  orderClickCount: number;
}

export function calculatePopularityScore(input: PopularityInput): number {
  return (
    input.viewCount * 1.0 +
    input.photoViewCount * 0.5 +
    input.bookmarkCount * 5.0 +
    input.reviewCount * 10.0 +
    input.avgRating * 5.0 +
    input.orderClickCount * 3.0
  );
}
