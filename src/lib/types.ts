export type UserRole = 'seller' | 'buyer' | 'admin';

export interface Profile {
  id: string;
  email: string;
  nickname: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface BusinessHours {
  [day: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}

export interface PickupInfoItem {
  title: string;
  description: string;
  image_urls?: string[];
}

export interface ExternalReviewLinks {
  naver?: string;
  kakao?: string;
  google?: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  description: string;
  business_hours: BusinessHours | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  min_order_price: number | null;
  is_pickup: boolean;
  is_delivery: boolean;
  region: string | null;
  area: string | null;
  district: string | null;
  delivery_fee: number | null;
  cake_types: string[] | null;
  naver_map_url: string | null;
  pickup_info: PickupInfoItem[] | null;
  external_review_links: ExternalReviewLinks | null;
  created_at: string;
}

export interface ShopImage {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  position: number;
  source: string;
}

export interface ShopWithImages extends Shop {
  images: ShopImage[];
}

/* ─── Shop Detail Types ─── */

export interface ShopGalleryImage {
  id: string;
  shop_id: string;
  url: string;
  alt_text: string | null;
  position: number;
  is_portfolio: boolean;
  is_primary: boolean;
  description: string | null;
  design_type: string | null;
  cake_size: string | null;
  price: number | null;
  made_date: string | null;
  menu_id: string | null;
  group_id: string | null;
  cake_type: string | null;
  occasion: string | null;
  created_at: string;
}

export interface ShopNotice {
  id: string;
  shop_id: string;
  title: string;
  content: string;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopMenuPrice {
  id: string;
  shop_id: string;
  cake_size: string;
  design_type: string;
  price_min: number;
  price_max: number | null;
  description: string | null;
  position: number;
  created_at: string;
}

/* ─── Menu Hierarchy ─── */

export interface ShopMenu {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  position: number;
  cake_types: string[] | null;
  custom_type: string | null;
  created_at: string;
  // Joined relations
  shop_menu_sizes?: ShopMenuSize[];
}

export interface ShopMenuSize {
  id: string;
  menu_id: string;
  cake_size: string;
  price_min: number;
  price_max: number | null;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  shop_id: string;
  created_at: string;
}

export interface ShopDetailData extends Shop {
  profiles: Pick<Profile, 'nickname' | 'email' | 'avatar_url'>;
  shop_gallery_images: ShopGalleryImage[];
  shop_notices: ShopNotice[];
  shop_menu_prices: ShopMenuPrice[];
  shop_menus?: ShopMenu[];
}

/* ─── Cake Type & Custom Type Constants ─── */
export const CAKE_TYPE_OPTIONS = ['레터링', '입체', '일러스트', '포토', '플라워', '피규어', '2단', '특수', '도시락', '기타'] as const;
export const CUSTOM_TYPE_OPTIONS = ['고정 디자인', '레터링 추가', '부분 주문제작', '주문제작'] as const;

/* ─── Portfolio Tag Constants ─── */
export const CAKE_TYPE_TAGS = ['레터링케이크', '3D케이크', '일러스트케이크', '특수케이크'] as const;
export const OCCASION_TAGS = ['생일', '퇴사', '출산', '개업', '기념일', '부모님', '입대', '취업', '입학', '졸업'] as const;

/* ─── Home Filter Constants ─── */
export const DESIGN_TAGS = CAKE_TYPE_OPTIONS; // alias for home filter backward compat
export const SIZE_TAGS = ['도시락', '미니', '1호', '2호'] as const;
export const SEOUL_DISTRICTS = [
  '강남구', '강동구', '강북구', '강서구', '관악구',
  '광진구', '구로구', '금천구', '노원구', '도봉구',
  '동대문구', '동작구', '마포구', '서대문구', '서초구',
  '성동구', '성북구', '송파구', '양천구', '영등포구',
  '용산구', '은평구', '종로구', '중구', '중랑구',
] as const;

/** Get the primary image URL from a shop's joined images, falling back to gallery primary, then image_url */
export function getShopImageUrl(shop: ShopWithImages | Shop | any): string | null {
  // 1. Check images table (ShopImage) for is_primary
  if ('images' in shop && Array.isArray(shop.images) && shop.images.length > 0) {
    const primary = shop.images.find((img: ShopImage) => img.is_primary);
    if (primary) return primary.url;
  }

  // 2. Check shop_gallery_images for is_primary
  if ('shop_gallery_images' in shop && Array.isArray(shop.shop_gallery_images) && shop.shop_gallery_images.length > 0) {
    const primary = shop.shop_gallery_images.find((img: ShopGalleryImage) => img.is_primary);
    if (primary) return primary.url;
    // Fallback to first gallery image
    return shop.shop_gallery_images[0].url;
  }

  // 3. First image from images table
  if ('images' in shop && Array.isArray(shop.images) && shop.images.length > 0) {
    return shop.images[0].url;
  }

  // 4. Direct image_url fallback
  return shop.image_url;
}

export type CakeCategory = string;

export interface SearchFilters {
  serviceType: 'all' | 'pickup' | 'delivery';
  date: string | null;
  time: string | null;
  region: string;
  priceRange: string;
  query: string;
  cakeCategory: string | null;
}

export interface ShopWithSeller extends Shop {
  profiles: Pick<Profile, 'nickname' | 'email' | 'avatar_url'>;
}

export interface Review {
  id: string;
  order_id: string;
  buyer_id: string;
  shop_id: string;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  is_photo_review: boolean;
  is_home_featured: boolean;
  created_at: string;
}

/* ─── Home Gallery Feed Types ─── */

export interface GalleryPost {
  id: string;
  original_id: string;
  image_url: string;
  extra_images?: string[];
  source: 'portfolio' | 'review';
  shop_name: string;
  shop_id: string;
  uploader_name: string;
  created_at: string;
  menu_name?: string;
  cake_type?: string | null;
  occasion?: string | null;
  district?: string | null;
}

export interface ReviewWithBuyer extends Review {
  profiles: Pick<Profile, 'nickname' | 'avatar_url'>;
}

export interface CakePreset {
  id: string;
  category: string;
  title: string;
  image_url: string | null;
  created_at: string;
}

/* ─── Order Types ─── */

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'payment_waiting'
  | 'confirmed'
  | 'making'
  | 'pickup_ready'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  buyer_id: string;
  shop_id: string;
  status: OrderStatus;
  pickup_date: string | null;
  design_img_url: string | null;
  total_price: number | null;
  original_price: number | null;
  request_detail: string | null;
  cake_size: string | null;
  cake_flavor: string | null;
  cream_type: string | null;
  lettering_text: string | null;
  seller_note: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface OrderWithBuyer extends Order {
  profiles: Pick<Profile, 'nickname' | 'email' | 'phone' | 'avatar_url'>;
}

export interface OrderOption {
  id: string;
  order_id: string;
  option_name: string;
  option_value: string;
}

/* ─── Slot Types ─── */

export interface Slot {
  id: string;
  shop_id: string;
  date: string;
  capacity: number;
  booked_count: number;
  is_closed: boolean;
  created_at: string;
}

/* ─── Message Types ─── */

export interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface MessageWithSender extends Message {
  profiles: Pick<Profile, 'nickname' | 'avatar_url'>;
}

/* ─── Status Helpers ─── */

export const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '대기', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  accepted: { label: '수락', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  payment_waiting: { label: '입금대기', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  confirmed: { label: '입금확인', color: 'text-cyan-700', bgColor: 'bg-cyan-50 border-cyan-200' },
  making: { label: '제작중', color: 'text-violet-700', bgColor: 'bg-violet-50 border-violet-200' },
  pickup_ready: { label: '픽업대기', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  completed: { label: '완료', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  cancelled: { label: '취소', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'pending', 'accepted', 'payment_waiting', 'confirmed', 'making', 'pickup_ready', 'completed',
];

export const CAKE_SIZE_OPTIONS = ['도시락', '미니', '1호', '2호', '3호'] as const;
export const CAKE_FLAVOR_OPTIONS = ['바닐라', '초코', '얼그레이', '당근', '레드벨벳', '딸기', '말차'] as const;
export const CREAM_TYPE_OPTIONS = ['생크림', '버터크림', '크림치즈', '가나슈', '앙금'] as const;
