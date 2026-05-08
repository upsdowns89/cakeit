'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type {
  ShopDetailData, ShopGalleryImage, ShopNotice, ShopMenuPrice,
  ShopMenu, ShopMenuSize,
  ReviewWithBuyer, BusinessHours, PickupInfoItem, ExternalReviewLinks,
} from '@/lib/types';
import { CAKE_SIZE_OPTIONS, CAKE_TYPE_OPTIONS, CUSTOM_TYPE_OPTIONS } from '@/lib/types';
import {
  CakeIcon, StorefrontIcon, MapPinIcon, ClockIcon, PhotoIcon, BellIcon,
  InformationCircleIcon, PlusIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon,
  ChevronRightIcon, StarIcon, ChatBubbleIcon, CogIcon, PencilIcon, XMarkIcon,
  ArrowLeftIcon, BookmarkIcon, BookmarkSolidIcon,
} from '@/components/icons';

/* ─── Photo Grouping (shared with buyer page) ─── */
interface PhotoGroup {
  id: string;
  images: ShopGalleryImage[];
  coverImage: ShopGalleryImage;
  count: number;
}

function groupPhotos(images: ShopGalleryImage[]): PhotoGroup[] {
  const groupMap = new Map<string, ShopGalleryImage[]>();
  const ungrouped: ShopGalleryImage[] = [];

  for (const img of images) {
    if ((img as any).group_id) {
      const gid = (img as any).group_id;
      if (!groupMap.has(gid)) groupMap.set(gid, []);
      groupMap.get(gid)!.push(img);
    } else {
      ungrouped.push(img);
    }
  }

  // Auto-group ungrouped photos by created_at proximity (within 60s) + same description
  const autoGroups: ShopGalleryImage[][] = [];
  const sorted = [...ungrouped].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const img of sorted) {
    const lastGroup = autoGroups[autoGroups.length - 1];
    if (lastGroup) {
      const lastImg = lastGroup[lastGroup.length - 1];
      const timeDiff = Math.abs(new Date(img.created_at).getTime() - new Date(lastImg.created_at).getTime());
      if (timeDiff < 60000 && (img as any).description === (lastImg as any).description) {
        lastGroup.push(img);
        continue;
      }
    }
    autoGroups.push([img]);
  }

  const groups: PhotoGroup[] = [];
  for (const [gid, imgs] of groupMap) {
    const s = imgs.sort((a, b) => a.position - b.position);
    groups.push({ id: gid, images: s, coverImage: s[0], count: s.length });
  }
  for (const imgs of autoGroups) {
    const s = imgs.sort((a, b) => a.position - b.position);
    groups.push({ id: s[0].id, images: s, coverImage: s[0], count: s.length });
  }
  groups.sort((a, b) => a.coverImage.position - b.coverImage.position);
  return groups;
}

type TabKey = 'menu' | 'notices' | 'photos' | 'reviews' | 'info';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'menu', label: '메뉴' },
  { key: 'notices', label: '공지' },
  { key: 'photos', label: '사진' },
  { key: 'reviews', label: '리뷰' },
  { key: 'info', label: '정보' },
];

/* ─── Menu Detail Popup View Type (mirrors buyer) ─── */
type MenuPopupView =
  | { type: 'menu'; menuId: string }
  | { type: 'portfolio'; imageId: string; images: ShopGalleryImage[] };
const DAYS_KR = ['월', '화', '수', '목', '금', '토', '일'];

export default function SellerStorePage() {
  const router = useRouter();
  const supabase = createClient();
  const tabBarRef = useRef<HTMLDivElement>(null);

  const [shop, setShop] = useState<ShopDetailData | null>(null);
  const [reviews, setReviews] = useState<ReviewWithBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('menu');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Gallery
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);

  // Edit modes
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingNotices, setEditingNotices] = useState(false);
  const [editingMenu, setEditingMenu] = useState(false);
  const [saving, setSaving] = useState(false);

  // Photo context menu & upload sheet
  const [photoMenuGroupId, setPhotoMenuGroupId] = useState<string | null>(null);
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);

  // Info edit state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editIsPickup, setEditIsPickup] = useState(true);
  const [editIsDelivery, setEditIsDelivery] = useState(false);
  const [editDeliveryFee, setEditDeliveryFee] = useState('');
  const [editMinOrder, setEditMinOrder] = useState('');
  const [editNaverMap, setEditNaverMap] = useState('');
  const [editHours, setEditHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>({});
  const [editPickupInfo, setEditPickupInfo] = useState<PickupInfoItem[]>([]);
  const [editExternalLinks, setEditExternalLinks] = useState<ExternalReviewLinks>({});

  // Notice add
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');

  // Menu add (new hierarchy)
  const [shopMenus, setShopMenus] = useState<ShopMenu[]>([]);
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuDesc, setNewMenuDesc] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuCakeTypes, setNewMenuCakeTypes] = useState<string[]>([]);
  const [newMenuCustomType, setNewMenuCustomType] = useState<string>('');
  const [modalSizes, setModalSizes] = useState<{id: string; cake_size: string; price_min: string; price_max: string}[]>([]);
  const [addingSizeForMenu, setAddingSizeForMenu] = useState<string | null>(null);
  const [newSizeSize, setNewSizeSize] = useState<string>(CAKE_SIZE_OPTIONS[0]);
  const [newSizeMin, setNewSizeMin] = useState('');
  const [newSizeMax, setNewSizeMax] = useState('');

  // Photo viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [viewerImages, setViewerImages] = useState<{ url: string; id?: string }[]>([]);

  // Menu tab filter
  const [menuSizeTab, setMenuSizeTab] = useState<string>(CAKE_SIZE_OPTIONS[0]);

  // Menu detail popup (mirrors buyer)
  const [menuPopupStack, setMenuPopupStack] = useState<MenuPopupView[]>([]);
  const menuPopupOpen = menuPopupStack.length > 0;

  // Schedule
  const [scheduleDate, setScheduleDate] = useState('');

  // Info accordion
  const [openPickupIdx, setOpenPickupIdx] = useState<number | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  /* ─── Fetch ─── */
  useEffect(() => {
    async function fetchShop() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const baseGallery = 'shop_gallery_images(id, url, alt_text, position, shop_id, is_portfolio, group_id, description, created_at)';
      const galleryWithPrimary = 'shop_gallery_images(id, url, alt_text, position, shop_id, is_primary, is_portfolio, group_id, description, created_at)';
      const restSelect = `*, profiles!owner_id(nickname, email, avatar_url),
          shop_notices(id, title, content, image_url, is_pinned, created_at, updated_at, shop_id),
          shop_menu_prices(id, cake_size, design_type, price_min, price_max, description, position, shop_id, created_at)`;

      // Try with is_primary column, fallback without it
      let result = await supabase
        .from('shops')
        .select(`${restSelect}, ${galleryWithPrimary}`)
        .eq('owner_id', user.id).limit(1).single();

      if (result.error) {
        result = await supabase
          .from('shops')
          .select(`${restSelect}, ${baseGallery}`)
          .eq('owner_id', user.id).limit(1).single();
      }

      const { data, error } = result;

      if (data) {
        const sd = data as unknown as ShopDetailData;
        sd.shop_gallery_images = (sd.shop_gallery_images || []).sort((a, b) => a.position - b.position);
        sd.shop_notices = (sd.shop_notices || []).sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        sd.shop_menu_prices = (sd.shop_menu_prices || []).sort((a, b) => a.position - b.position);
        setShop(sd);
      }

      // Reviews
      if (data) {
        const { data: rv } = await supabase
          .from('reviews').select('*, profiles!reviews_buyer_id_fkey(nickname, avatar_url)')
          .eq('shop_id', data.id).order('created_at', { ascending: false });
        setReviews((rv as ReviewWithBuyer[]) || []);
      }
      setLoading(false);
    }
    fetchShop();
  }, []);

  /* ─── Computed ─── */
  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  const isOpen = useMemo(() => {
    if (!shop?.business_hours) return false;
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const today = days[new Date().getDay()];
    const h = shop.business_hours[today];
    if (!h || h.closed) return false;
    const t = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    return t >= h.open && t <= h.close;
  }, [shop]);

  const todayName = useMemo(() => ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()], []);

  const galleryImages = useMemo(() => {
    if (!shop) return [];
    if (shop.shop_gallery_images.length > 0) {
      // Primary image first, then by position
      return [...shop.shop_gallery_images].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.position - b.position;
      });
    }
    if (shop.image_url) return [{ id: 'fallback', url: shop.image_url, alt_text: shop.name, position: 0, shop_id: shop.id, created_at: '', is_primary: false, is_portfolio: false, description: null, design_type: null, cake_size: null, price: null, made_date: null, menu_id: null, group_id: null, cake_type: null, occasion: null } as ShopGalleryImage];
    return [];
  }, [shop]);

  const reviewPhotos = useMemo(() => reviews.filter(r => r.photo_url).map(r => ({ url: r.photo_url!, reviewId: r.id })), [reviews]);

  const groupedGallery = useMemo(() => groupPhotos(galleryImages), [galleryImages]);

  // Portfolio photos grouped by menu_id (mirrors buyer page)
  const menuPhotoGroups = useMemo(() => {
    const map: Record<string, ShopGalleryImage[]> = {};
    for (const img of galleryImages) {
      if (img.menu_id) {
        if (!map[img.menu_id]) map[img.menu_id] = [];
        map[img.menu_id].push(img);
      }
    }
    const result: Record<string, PhotoGroup[]> = {};
    for (const [menuId, imgs] of Object.entries(map)) {
      result[menuId] = groupPhotos(imgs);
    }
    return result;
  }, [galleryImages]);

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

  const externalLinks = (shop?.external_review_links || {}) as ExternalReviewLinks;
  const pickupInfo = (shop?.pickup_info || []) as PickupInfoItem[];

  /* ─── Helpers ─── */
  const formatPrice = (n: number) => n.toLocaleString() + '원';
  const formatPriceRange = (min: number, max: number | null) =>
    max && max !== min ? `${formatPrice(min)} ~ ${formatPrice(max)}` : formatPrice(min);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatBusinessHours = (bh: BusinessHours) => {
    return ['월', '화', '수', '목', '금', '토', '일'].map(day => {
      const h = bh[day];
      if (!h || h.closed) return { day, display: '휴무', closed: true };
      return { day, display: `${h.open} - ${h.close}`, closed: false };
    });
  };


  const goTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    tabBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  // Menu popup helpers (mirrors buyer)
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

  /* ─── Info Edit ─── */
  const startEditInfo = () => {
    if (!shop) return;
    setEditName(shop.name || '');
    setEditDesc(shop.description || '');
    setEditAddress(shop.address || '');
    setEditIsPickup(shop.is_pickup);
    setEditIsDelivery(shop.is_delivery);
    setEditDeliveryFee(shop.delivery_fee?.toString() || '');
    setEditMinOrder(shop.min_order_price?.toString() || '');
    setEditNaverMap((shop as any).naver_map_url || '');
    setEditExternalLinks(externalLinks);
    setEditPickupInfo([...pickupInfo]);
    const hours: Record<string, { open: string; close: string; closed: boolean }> = {};
    for (const day of DAYS_KR) {
      const existing = shop.business_hours?.[day];
      hours[day] = { open: existing?.open || '10:00', close: existing?.close || '20:00', closed: existing?.closed || false };
    }
    setEditHours(hours);
    setEditingInfo(true);
  };

  const saveInfo = async () => {
    if (!shop) return;
    setSaving(true);
    const { error } = await (supabase as any).from('shops').update({
      name: editName, description: editDesc, address: editAddress,
      is_pickup: editIsPickup, is_delivery: editIsDelivery,
      delivery_fee: editDeliveryFee ? parseInt(editDeliveryFee) : null,
      min_order_price: editMinOrder ? parseInt(editMinOrder) : null,
      business_hours: editHours,
      naver_map_url: editNaverMap || null,
      external_review_links: editExternalLinks,
      pickup_info: editPickupInfo,
    }).eq('id', shop.id);
    if (error) { showMsg('error', '저장 실패'); }
    else {
      setShop({ ...shop, name: editName, description: editDesc, address: editAddress,
        is_pickup: editIsPickup, is_delivery: editIsDelivery,
        delivery_fee: editDeliveryFee ? parseInt(editDeliveryFee) : null,
        min_order_price: editMinOrder ? parseInt(editMinOrder) : null,
        business_hours: editHours as any,
        naver_map_url: editNaverMap || null,
        external_review_links: editExternalLinks as any,
        pickup_info: editPickupInfo as any,
      } as any);
      showMsg('success', '정보가 저장되었습니다.');
      setEditingInfo(false);
    }
    setSaving(false);
  };

  /* ─── Gallery Upload/Delete ─── */
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>, isPortfolio: boolean = false) => {
    if (!shop || !e.target.files?.length) return;
    setGalleryUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileList = Array.from(e.target.files);
      const groupId = fileList.length > 1 ? crypto.randomUUID() : null;
      const newImages: any[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const ext = file.name.split('.').pop();
        const prefix = isPortfolio ? 'portfolio' : 'gallery';
        const path = `${user.id}/${prefix}_${Date.now()}_${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from('shop-images').upload(path, file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('shop-images').getPublicUrl(path);
        const { data: img, error: insErr } = await (supabase as any)
          .from('shop_gallery_images')
          .insert({
            shop_id: shop.id,
            url: publicUrl,
            position: shop.shop_gallery_images.length + i,
            is_portfolio: isPortfolio,
            is_primary: shop.shop_gallery_images.length === 0 && i === 0,
            group_id: groupId,
          })
          .select().single();
        if (insErr) throw insErr;
        newImages.push(img);
      }

      // If first image ever, sync to shops.image_url
      if (shop.shop_gallery_images.length === 0 && newImages.length > 0) {
        await (supabase as any).from('shops').update({ image_url: newImages[0].url }).eq('id', shop.id);
      }
      setShop({ ...shop, shop_gallery_images: [...shop.shop_gallery_images, ...newImages] } as any);
      showMsg('success', isPortfolio ? '포트폴리오가 추가되었습니다. (홈에 노출)' : `이미지 ${newImages.length}장이 추가되었습니다.`);
    } catch (err: any) { showMsg('error', err.message || '업로드 실패'); }
    setGalleryUploading(false);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (portfolioInputRef.current) portfolioInputRef.current.value = '';
  };

  const handleGalleryDelete = async (imgId: string) => {
    if (!shop) return;
    const deletedImg = shop.shop_gallery_images.find(g => g.id === imgId);
    await (supabase as any).from('shop_gallery_images').delete().eq('id', imgId);
    const remaining = shop.shop_gallery_images.filter(g => g.id !== imgId);

    // If deleted image was primary, reassign to first remaining image
    if (deletedImg?.is_primary && remaining.length > 0) {
      await (supabase as any).from('shop_gallery_images').update({ is_primary: true }).eq('id', remaining[0].id);
      remaining[0] = { ...remaining[0], is_primary: true };
      await (supabase as any).from('shops').update({ image_url: remaining[0].url }).eq('id', shop.id);
    }
    if (remaining.length === 0) {
      await (supabase as any).from('shops').update({ image_url: null }).eq('id', shop.id);
    }

    setShop({ ...shop, shop_gallery_images: remaining } as any);
    showMsg('success', '이미지가 삭제되었습니다.');
  };

  // Delete an entire photo group (all images sharing the same group_id or auto-group)
  const handleGroupDelete = async (group: PhotoGroup) => {
    if (!shop) return;
    const ids = group.images.map(img => img.id);
    for (const id of ids) {
      await (supabase as any).from('shop_gallery_images').delete().eq('id', id);
    }
    const remaining = shop.shop_gallery_images.filter(g => !ids.includes(g.id));

    // If any deleted image was primary, reassign
    const hadPrimary = group.images.some(img => img.is_primary);
    if (hadPrimary && remaining.length > 0) {
      await (supabase as any).from('shop_gallery_images').update({ is_primary: true }).eq('id', remaining[0].id);
      remaining[0] = { ...remaining[0], is_primary: true };
      await (supabase as any).from('shops').update({ image_url: remaining[0].url }).eq('id', shop.id);
    }
    if (remaining.length === 0) {
      await (supabase as any).from('shops').update({ image_url: null }).eq('id', shop.id);
    }

    setShop({ ...shop, shop_gallery_images: remaining } as any);
    showMsg('success', `${ids.length}장의 사진이 삭제되었습니다.`);
  };

  /* ─── Set Primary Photo ─── */
  const handleSetPrimary = async (imgId: string) => {
    if (!shop) return;
    const targetImg = shop.shop_gallery_images.find(g => g.id === imgId);
    if (!targetImg || targetImg.is_primary) return;

    // Unset all, then set new primary
    await (supabase as any).from('shop_gallery_images').update({ is_primary: false }).eq('shop_id', shop.id);
    await (supabase as any).from('shop_gallery_images').update({ is_primary: true }).eq('id', imgId);
    // Sync shops.image_url with new primary
    await (supabase as any).from('shops').update({ image_url: targetImg.url }).eq('id', shop.id);

    const updated = shop.shop_gallery_images.map(g => ({
      ...g,
      is_primary: g.id === imgId,
    }));
    setShop({ ...shop, shop_gallery_images: updated, image_url: targetImg.url } as any);
    showMsg('success', '대표 사진이 변경되었습니다.');
  };

  /* ─── Notice CRUD ─── */
  const handleAddNotice = async () => {
    if (!shop || !newNoticeTitle || !newNoticeContent) return;
    const { data, error } = await (supabase as any).from('shop_notices')
      .insert({ shop_id: shop.id, title: newNoticeTitle, content: newNoticeContent }).select().single();
    if (error) { showMsg('error', '등록 실패'); return; }
    setShop({ ...shop, shop_notices: [data, ...shop.shop_notices] } as any);
    setNewNoticeTitle(''); setNewNoticeContent('');
    showMsg('success', '공지가 등록되었습니다.');
  };

  const handleDeleteNotice = async (id: string) => {
    if (!shop) return;
    await (supabase as any).from('shop_notices').delete().eq('id', id);
    setShop({ ...shop, shop_notices: shop.shop_notices.filter(n => n.id !== id) } as any);
    showMsg('success', '공지가 삭제되었습니다.');
  };

  /* ─── Hierarchical Menu CRUD (shop_menus + shop_menu_sizes) ─── */
  const fetchShopMenus = useCallback(async () => {
    if (!shop) return;
    const { data } = await (supabase as any)
      .from('shop_menus')
      .select('*, shop_menu_sizes(id, menu_id, cake_size, price_min, price_max, created_at)')
      .eq('shop_id', shop.id)
      .order('position');
    if (data) setShopMenus(data as ShopMenu[]);
  }, [shop, supabase]);

  /** Sync shops.cake_types from all menus' cake_types (union) */
  const syncShopCakeTypes = useCallback(async (menus: ShopMenu[]) => {
    if (!shop) return;
    const allTypes = new Set<string>();
    for (const m of menus) {
      if (m.cake_types) m.cake_types.forEach(t => allTypes.add(t));
    }
    const arr = Array.from(allTypes);
    await (supabase as any).from('shops').update({ cake_types: arr.length > 0 ? arr : null }).eq('id', shop.id);
  }, [shop, supabase]);

  useEffect(() => { fetchShopMenus(); }, [fetchShopMenus]);

  const handleAddShopMenu = async () => {
    if (!shop || !newMenuName.trim()) return;
    try {
      const basePrice = newMenuPrice ? parseInt(newMenuPrice) : null;
      const { data, error } = await (supabase as any).from('shop_menus').insert({
        shop_id: shop.id,
        name: newMenuName.trim(),
        description: newMenuDesc.trim() || null,
        price: basePrice,
        position: shopMenus.length,
        cake_types: newMenuCakeTypes.length > 0 ? newMenuCakeTypes : null,
        custom_type: newMenuCustomType || null,
      }).select('*, shop_menu_sizes(id, menu_id, cake_size, price_min, price_max, created_at)').single();
      if (error) {
        showMsg('error', '메뉴 생성 실패: ' + String(error.message || ''));
        return;
      }
      let createdMenu = data as ShopMenu;
      if (modalSizes.length > 0) {
        const sizesToInsert = modalSizes.map(s => ({
          menu_id: createdMenu.id,
          cake_size: s.cake_size,
          price_min: parseInt(s.price_min),
          price_max: s.price_max ? parseInt(s.price_max) : null,
        }));
        const { data: sizeData } = await (supabase as any)
          .from('shop_menu_sizes')
          .insert(sizesToInsert)
          .select();
        if (sizeData) createdMenu = { ...createdMenu, shop_menu_sizes: sizeData };
      }
      setShopMenus([...shopMenus, createdMenu]);
      await syncShopCakeTypes([...shopMenus, createdMenu]);
      resetMenuModal();
      showMsg('success', createdMenu.name + ' 메뉴가 생성되었습니다.');
    } catch (err: any) {
      showMsg('error', '메뉴 생성 오류: ' + String(err?.message || ''));
    }
  };

  const resetMenuModal = () => {
    setMenuModalOpen(false);
    setNewMenuName('');
    setNewMenuDesc('');
    setNewMenuPrice('');
    setNewMenuCakeTypes([]);
    setNewMenuCustomType('');
    setModalSizes([]);
  };

  const addModalSize = () => {
    if (!newSizeSize || !newSizeMin) return;
    if (modalSizes.some(s => s.cake_size === newSizeSize)) {
      showMsg('error', '이미 추가된 옵션입니다.');
      return;
    }
    setModalSizes([...modalSizes, {
      id: `tmp_${Date.now()}`,
      cake_size: newSizeSize,
      price_min: newSizeMin,
      price_max: newSizeMax,
    }]);
    setNewSizeMin(''); setNewSizeMax('');
  };

  const handleDeleteShopMenu = async (menuId: string) => {
    await (supabase as any).from('shop_menus').delete().eq('id', menuId);
    const remaining = shopMenus.filter(m => m.id !== menuId);
    setShopMenus(remaining);
    await syncShopCakeTypes(remaining);
    showMsg('success', '메뉴가 삭제되었습니다.');
  };

  const handleAddMenuSize = async (menuId: string) => {
    if (!newSizeMin) return;
    const { data, error } = await (supabase as any).from('shop_menu_sizes').insert({
      menu_id: menuId,
      cake_size: newSizeSize,
      price_min: parseInt(newSizeMin),
      price_max: newSizeMax ? parseInt(newSizeMax) : null,
    }).select().single();
    if (error) { showMsg('error', error.message?.includes('unique') ? '이미 등록된 사이즈입니다.' : '사이즈 추가 실패'); return; }
    setShopMenus(shopMenus.map(m =>
      m.id === menuId
        ? { ...m, shop_menu_sizes: [...(m.shop_menu_sizes || []), data as ShopMenuSize] }
        : m
    ));
    setNewSizeMin(''); setNewSizeMax('');
    setAddingSizeForMenu(null);
    showMsg('success', '사이즈가 추가되었습니다.');
  };

  const handleDeleteMenuSize = async (menuId: string, sizeId: string) => {
    await (supabase as any).from('shop_menu_sizes').delete().eq('id', sizeId);
    setShopMenus(shopMenus.map(m =>
      m.id === menuId
        ? { ...m, shop_menu_sizes: (m.shop_menu_sizes || []).filter(s => s.id !== sizeId) }
        : m
    ));
    showMsg('success', '사이즈가 삭제되었습니다.');
  };

  /* ─── Loading / Not Found ─── */
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="aspect-[4/3] animate-shimmer" />
        <div className="px-4 py-6 space-y-4">
          <div className="h-8 w-3/4 animate-shimmer rounded-lg" />
          <div className="h-5 w-1/2 animate-shimmer rounded-lg" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center">
        <div>
          <StorefrontIcon className="mx-auto mb-3 h-10 w-10 text-surface-300" />
          <p className="text-sm font-medium text-surface-500">등록된 가게가 없습니다</p>
          <a href="/seller/register" className="mt-3 inline-block rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white">가게 등록하기</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* ─── GNB ─── */}
      <div className="sticky top-0 z-50 flex items-center justify-between bg-white/95 px-4 py-2.5 backdrop-blur-lg border-b border-surface-200/60">
        <div className="flex items-center gap-2">
          <StorefrontIcon className="h-5 w-5 text-primary-500" />
          <h1 className="text-lg font-bold text-surface-900">내 스토어</h1>
        </div>
        <Link href="/seller/settings" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100 transition-colors">
          <CogIcon className="h-5 w-5 text-surface-600" />
        </Link>
      </div>

      {/* Message */}
      {message && (
        <div className={`mx-4 mt-2 rounded-lg px-3 py-2 text-xs font-medium animate-fade-in ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>{message.text}</div>
      )}

      {/* ─── Hero Image Carousel ─── */}
      {galleryImages.length > 0 ? (
        <section className="pb-2">
          {galleryImages.length === 1 ? (
            /* Single image: full width, 240px height, object-cover */
            <div
              className="w-full overflow-hidden bg-surface-100 cursor-pointer"
              style={{ height: 240 }}
              onClick={() => {
                setViewerImages(galleryImages.map(img => ({ url: img.url, id: img.id })));
                setViewerIdx(0);
                setViewerOpen(true);
              }}
            >
              <img src={galleryImages[0].url} alt={galleryImages[0].alt_text || shop.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            /* Multiple images: 240px height, width varies by image ratio, horizontal scroll */
            <div
              className="flex gap-2 overflow-x-auto pl-4 pr-4 hide-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', height: 240 }}
            >
              {galleryImages.slice(0, 12).map((img, i) => (
                <div
                  key={img.id || i}
                  className="flex-shrink-0 overflow-hidden rounded-2xl bg-surface-100 cursor-pointer"
                  style={{ height: 240 }}
                  onClick={() => {
                    setViewerImages(galleryImages.map(img => ({ url: img.url, id: img.id })));
                    setViewerIdx(i);
                    setViewerOpen(true);
                  }}
                >
                  <img src={img.url} alt={img.alt_text || shop.name} className="h-full w-auto object-cover" />
                </div>
              ))}
              {galleryImages.length > 12 && (
                <div className="flex-shrink-0 rounded-2xl" style={{ height: 240, width: 160 }}>
                  <button
                    onClick={() => goTab('photos')}
                    className="flex h-full w-full items-center justify-center rounded-2xl bg-surface-100 transition-colors hover:bg-surface-200"
                  >
                    <div className="text-center">
                      <PhotoIcon className="mx-auto h-8 w-8 text-surface-400" />
                      <span className="mt-1.5 block text-sm font-semibold text-surface-600">더보기</span>
                      <span className="text-xs text-surface-400">+{galleryImages.length - 12}</span>
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

      {/* Shop Basic Info + Description (matches buyer) */}
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
        <h2 className="mt-1.5 text-xl font-bold text-surface-900">{shop.name}</h2>
        {shop.description && (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-surface-500">
            {shop.description}
          </p>
        )}
        {shop.address && <p className="mt-2 flex items-center gap-1 text-xs text-surface-400"><MapPinIcon className="h-3 w-3" /> {shop.address}</p>}
      </div>

      {/* ─── Tab Bar ─── */}
      <div ref={tabBarRef} className="sticky top-[53px] z-40 border-b border-surface-200 bg-white/95 backdrop-blur-lg">
        <div className="flex">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`relative flex-1 py-3 text-center text-[13px] font-semibold transition-colors ${
                activeTab === tab.key ? 'text-primary-600' : 'text-surface-400 hover:text-surface-600'
              }`}>
              {tab.label}
              {tab.key === 'reviews' && reviews.length > 0 && <span className="ml-0.5 text-[10px] text-primary-400">{reviews.length}</span>}
              {activeTab === tab.key && <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="px-4 py-5">


        {/* ═══ NOTICES TAB ═══ */}
        {activeTab === 'notices' && (
          <div className="space-y-3">
            {shop.shop_notices.length === 0 && !editingNotices && (
              <div className="card-empty-state"><BellIcon className="mb-2 h-8 w-8 text-surface-300" /><p className="text-sm font-medium text-surface-500">공지사항이 없습니다</p></div>
            )}
            {shop.shop_notices.map(n => (
              <div key={n.id} className="rounded-2xl border border-surface-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {n.is_pinned && <span className="mt-0.5 rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-600">고정</span>}
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-surface-900">{n.title}</h4>
                      <time className="text-[10px] text-surface-400">{formatDate(n.created_at)}</time>
                    </div>
                  </div>
                  {editingNotices && (
                    <button onClick={() => handleDeleteNotice(n.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-surface-600">{n.content}</p>
                {n.image_url && (
                  <img src={n.image_url} alt="" className="mt-3 w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
                )}
              </div>
            ))}
            {/* Add Notice Form */}
            {editingNotices && (
              <div className="rounded-2xl border border-dashed border-primary-300 bg-primary-50/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-primary-600">새 공지 작성</p>
                <input type="text" value={newNoticeTitle} onChange={e => setNewNoticeTitle(e.target.value)} placeholder="제목" className="form-input" />
                <textarea value={newNoticeContent} onChange={e => setNewNoticeContent(e.target.value)} placeholder="내용" rows={3} className="form-textarea" />
                <button onClick={handleAddNotice} disabled={!newNoticeTitle || !newNoticeContent} className="btn-primary text-xs py-2 disabled:opacity-40">공지 등록</button>
              </div>
            )}
            {/* Edit Button */}
            <button onClick={() => setEditingNotices(!editingNotices)}
              className={`w-full rounded-xl py-3 text-sm font-semibold transition-all ${editingNotices ? 'bg-surface-200 text-surface-600' : 'border border-primary-200 bg-primary-50 text-primary-600'}`}>
              <PencilIcon className="inline h-4 w-4 mr-1" />
              {editingNotices ? '편집 완료' : '공지 관리하기'}
            </button>
          </div>
        )}

        {/* ═══ MENU TAB ═══ */}
        {activeTab === 'menu' && (
          <div>
            {shopMenus.length === 0 && !editingMenu ? (
              <div className="card-empty-state">
                <CakeIcon className="mb-2 h-8 w-8 text-surface-300" />
                <p className="text-sm font-medium text-surface-500">등록된 메뉴가 없습니다</p>
                <p className="mt-1 text-xs text-surface-400">편집 버튼을 눌러 메뉴를 만들어보세요</p>
              </div>
            ) : editingMenu ? (
              /* ─── Edit Mode: management UI ─── */
              <div className="space-y-3">
                {shopMenus.map((menu) => {
                  const sizes = menu.shop_menu_sizes || [];
                  return (
                    <div key={menu.id} className="rounded-2xl border border-surface-200 bg-white overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                            <CakeIcon className="h-5 w-5 text-primary-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-surface-900">{menu.name}</p>
                            {menu.description && <p className="text-[11px] text-surface-400 mt-0.5">{menu.description}</p>}
                            {((menu.cake_types && menu.cake_types.length > 0) || menu.custom_type) && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {menu.cake_types?.map(t => (
                                  <span key={t} className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-600">{t}</span>
                                ))}
                                {menu.custom_type && (
                                  <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-medium text-surface-600">{menu.custom_type}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteShopMenu(menu.id)} className="text-red-400 hover:text-red-600 ml-1">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                      {sizes.length > 0 && (
                        <div className="border-t border-surface-100 px-4 py-2 space-y-1">
                          {sizes.map((size) => (
                            <div key={size.id} className="flex items-center justify-between py-1">
                              <span className="text-xs text-surface-500">{size.cake_size}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-surface-700">{formatPriceRange(size.price_min, size.price_max)}</span>
                                <button onClick={() => handleDeleteMenuSize(menu.id, size.id)} className="text-red-300 hover:text-red-500">
                                  <XMarkIcon className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {addingSizeForMenu === menu.id ? (
                        <div className="border-t border-surface-100 px-4 py-3 space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <select value={newSizeSize} onChange={e => setNewSizeSize(e.target.value)} className="form-select text-xs">
                              {CAKE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input type="number" value={newSizeMin} onChange={e => setNewSizeMin(e.target.value)} placeholder="최소" className="form-input text-xs" />
                            <input type="number" value={newSizeMax} onChange={e => setNewSizeMax(e.target.value)} placeholder="최대" className="form-input text-xs" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleAddMenuSize(menu.id)} disabled={!newSizeMin} className="btn-primary text-xs py-1.5 flex-1 disabled:opacity-40">추가</button>
                            <button onClick={() => setAddingSizeForMenu(null)} className="text-xs text-surface-400 px-3">취소</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingSizeForMenu(menu.id); setNewSizeMin(''); setNewSizeMax(''); }}
                          className="flex w-full items-center justify-center gap-1 border-t border-surface-100 py-2.5 text-xs text-surface-400 hover:text-primary-500 transition-colors"
                        >
                          <PlusIcon className="h-3 w-3" /> 옵션 추가
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ─── View Mode: matches buyer shop detail menu tab ─── */
              <div>
                {/* Schedule picker (matches buyer) */}
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

                <div className="space-y-3">
                  {shopMenus.map(menu => {
                    const sizes = menu.shop_menu_sizes || [];
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
                              {sizes.length > 0 ? (
                                <span className="text-sm font-bold text-primary-600">
                                  {formatPriceRange(
                                    Math.min(...sizes.map(s => s.price_min)),
                                    Math.max(...sizes.map(s => s.price_max ?? s.price_min))
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
                            ) : (
                              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-50">
                                <CakeIcon className="h-7 w-7 text-primary-300" />
                              </div>
                            )}
                            <ChevronRightIcon className="h-4 w-4 text-surface-300 flex-shrink-0" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-4 flex gap-2">
              {editingMenu && (
                <button onClick={() => setMenuModalOpen(true)}
                  className="flex-1 rounded-xl border border-primary-200 bg-primary-50 py-3 text-sm font-semibold text-primary-600">
                  <PlusIcon className="inline h-4 w-4 mr-1" />
                  메뉴 추가
                </button>
              )}
              <button onClick={() => setEditingMenu(!editingMenu)}
                className={`${editingMenu ? 'flex-1' : 'w-full'} rounded-xl py-3 text-sm font-semibold transition-all ${editingMenu ? 'bg-surface-200 text-surface-600' : 'border border-primary-200 bg-primary-50 text-primary-600'}`}>
                <PencilIcon className="inline h-4 w-4 mr-1" />
                {editingMenu ? '편집 완료' : '메뉴 편집하기'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Menu Create Modal (Fullpage) ─── */}
        {menuModalOpen && (
          <div className="fixed inset-0 z-[100] flex justify-center">
          <div className="w-full max-w-[480px] bg-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3">
              <button onClick={resetMenuModal} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100">
                <XMarkIcon className="h-5 w-5 text-surface-700" />
              </button>
              <h2 className="text-base font-bold text-surface-900">새 메뉴 만들기</h2>
              <div className="w-9" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
              {/* Menu name */}
              <div>
                <label className="block text-sm font-bold text-surface-900 mb-1.5">
                  메뉴 이름 <span className="text-primary-500">*</span>
                </label>
                <input
                  type="text"
                  value={newMenuName}
                  onChange={e => setNewMenuName(e.target.value)}
                  placeholder="예: 레터링 케이크, 플라워 케이크"
                  className="form-input"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-surface-900 mb-1.5">설명</label>
                <textarea
                  value={newMenuDesc}
                  onChange={e => setNewMenuDesc(e.target.value)}
                  placeholder="메뉴에 대한 간단한 설명 (선택)"
                  rows={2}
                  className="form-textarea"
                />
              </div>

              {/* Cake types (multi-select chips) */}
              <div>
                <label className="block text-sm font-bold text-surface-900 mb-1.5">
                  케이크타입 <span className="text-primary-500">*</span>
                </label>
                <p className="text-[11px] text-surface-400 mb-2">해당하는 타입을 모두 선택해주세요</p>
                <div className="flex flex-wrap gap-2">
                  {CAKE_TYPE_OPTIONS.map(type => {
                    const selected = newMenuCakeTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setNewMenuCakeTypes(prev =>
                            selected ? prev.filter(t => t !== type) : [...prev, type]
                          );
                        }}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
                          selected
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white text-surface-600 border-surface-300 hover:border-primary-300'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom type (single select) */}
              <div>
                <label className="block text-sm font-bold text-surface-900 mb-1.5">
                  커스텀타입 <span className="text-primary-500">*</span>
                </label>
                <p className="text-[11px] text-surface-400 mb-2">주문 제작 방식을 선택해주세요</p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_TYPE_OPTIONS.map(type => {
                    const selected = newMenuCustomType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewMenuCustomType(selected ? '' : type)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
                          selected
                            ? 'bg-surface-800 text-white border-surface-800'
                            : 'bg-white text-surface-600 border-surface-300 hover:border-surface-500'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Base price */}
              <div>
                <label className="block text-sm font-bold text-surface-900 mb-1.5">기본 가격</label>
                <div className="relative">
                  <input
                    type="number"
                    value={newMenuPrice}
                    onChange={e => setNewMenuPrice(e.target.value)}
                    placeholder="옵션이 없을 때 표시되는 가격"
                    className="form-input pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">원</span>
                </div>
              </div>

              {/* Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-surface-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-surface-400">옵션 (사이즈별 가격)</span></div>
              </div>

              {/* Options list */}
              {modalSizes.length > 0 && (
                <div className="space-y-2">
                  {modalSizes.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5">
                      <span className="text-sm font-medium text-surface-800">{s.cake_size}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary-600">
                          {parseInt(s.price_min).toLocaleString()}원
                          {s.price_max ? ` ~ ${parseInt(s.price_max).toLocaleString()}원` : ''}
                        </span>
                        <button onClick={() => setModalSizes(modalSizes.filter(ms => ms.id !== s.id))} className="text-red-300 hover:text-red-500">
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add option form */}
              <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-4 space-y-3">
                <p className="text-xs font-semibold text-surface-500">옵션 추가</p>
                <div className="grid grid-cols-3 gap-2">
                  <select value={newSizeSize} onChange={e => setNewSizeSize(e.target.value)} className="form-select text-xs">
                    {CAKE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input type="number" value={newSizeMin} onChange={e => setNewSizeMin(e.target.value)} placeholder="최소 가격" className="form-input text-xs" />
                  <input type="number" value={newSizeMax} onChange={e => setNewSizeMax(e.target.value)} placeholder="최대 가격" className="form-input text-xs" />
                </div>
                <button onClick={addModalSize} disabled={!newSizeMin}
                  className="w-full rounded-lg border border-surface-300 py-2 text-xs font-medium text-surface-600 hover:bg-surface-100 disabled:opacity-40 transition-colors">
                  <PlusIcon className="inline h-3 w-3 mr-1" /> 옵션 추가
                </button>
              </div>

              {modalSizes.length > 0 && (
                <p className="text-[10px] text-surface-400 text-center">
                  💡 첫 번째 옵션의 가격이 대표 가격으로 표시됩니다
                </p>
              )}
            </div>

            {/* Bottom action */}
            <div className="border-t border-surface-200 p-4 safe-area-bottom">
              <button
                onClick={handleAddShopMenu}
                disabled={!newMenuName.trim() || newMenuCakeTypes.length === 0 || !newMenuCustomType}
                className="btn-primary w-full disabled:opacity-40"
              >
                <CakeIcon className="mr-1 inline h-4 w-4" />
                메뉴 생성하기
              </button>
            </div>
          </div>
          </div>
        )}

        {/* ═══ PHOTOS TAB ═══ */}
        {activeTab === 'photos' && (
          <div>
            {galleryImages.length === 0 && reviewPhotos.length === 0 ? (
              <div className="card-empty-state"><PhotoIcon className="mb-2 h-8 w-8 text-surface-300" /><p className="text-sm font-medium text-surface-500">등록된 사진이 없습니다</p></div>
            ) : (
              <>
                {galleryImages.length > 0 && (
                  <div className="mb-4">
                    <div className="grid grid-cols-3 gap-1.5">
                      {groupedGallery.map((group) => (
                        <div key={group.id} className="relative aspect-square overflow-hidden rounded-lg">
                          <Link href={`/portfolio/${group.coverImage.id}`} className="block h-full w-full">
                            <img src={group.coverImage.url} alt="" className="h-full w-full object-cover transition-transform active:scale-95" />
                          </Link>
                          {/* Multi-image badge */}
                          {group.count > 1 && (
                            <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                                <rect x="5" y="1" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
                              </svg>
                              <span className="text-[10px] font-semibold text-white leading-none">{group.count}</span>
                            </div>
                          )}
                          {/* Primary badge */}
                          {(group.coverImage as any).is_primary && (
                            <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-md bg-yellow-400 px-1.5 py-0.5 text-[9px] font-bold text-yellow-900 shadow-sm">★ 대표</span>
                          )}
                          {(group.coverImage as any).is_portfolio && !(group.coverImage as any).is_primary && (
                            <span className="portfolio-badge">포트폴리오</span>
                          )}
                          {/* ⋮ context menu button */}
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPhotoMenuGroupId(photoMenuGroupId === group.id ? null : group.id); }}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/60"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/></svg>
                          </button>
                          {/* Dropdown menu */}
                          {photoMenuGroupId === group.id && (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setPhotoMenuGroupId(null)} />
                              <div className="absolute right-1 top-8 z-[70] w-32 overflow-hidden rounded-xl border border-surface-200 bg-white shadow-xl animate-fade-in">
                                {!(group.coverImage as any).is_primary && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleSetPrimary(group.coverImage.id); setPhotoMenuGroupId(null); }}
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                                  >
                                    <span className="text-yellow-500">★</span> 대표사진 등록
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleGroupDelete(group); setPhotoMenuGroupId(null); }}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" /> {group.count > 1 ? `${group.count}장 삭제` : '삭제'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {reviewPhotos.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-surface-900 mb-2">리뷰 사진</h3>
                    <div className="grid grid-cols-3 gap-1.5">
                      {reviewPhotos.map((p, i) => (
                        <div key={i} className="aspect-square overflow-hidden rounded-lg cursor-pointer" onClick={() => { setViewerImages(reviewPhotos.map(rp => ({ url: rp.url }))); setViewerIdx(i); setViewerOpen(true); }}>
                          <img src={p.url} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {/* Upload button */}
            <button
              onClick={() => setUploadSheetOpen(true)}
              className="mt-4 w-full rounded-xl border border-primary-200 bg-primary-50 py-3 text-sm font-semibold text-primary-600 transition-all hover:bg-primary-100"
            >
              <PlusIcon className="inline h-4 w-4 mr-1" />
              사진올리기
            </button>
          </div>
        )}

        {/* Upload Bottom Sheet */}
        {uploadSheetOpen && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center" onClick={() => setUploadSheetOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="w-full max-w-[480px] relative" onClick={(e) => e.stopPropagation()}>
              <div className="rounded-t-2xl bg-white px-4 pb-6 pt-3 shadow-2xl animate-slide-up safe-area-bottom">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-300" />
                <h3 className="text-base font-bold text-surface-900 mb-4">사진올리기</h3>
                <div className="space-y-2">
                  <Link
                    href="/seller/portfolio/new?type=photo"
                    onClick={() => setUploadSheetOpen(false)}
                    className="flex items-start gap-3 rounded-xl border border-surface-200 bg-white p-4 transition-all hover:bg-surface-50 active:scale-[0.99]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-lg">📷</div>
                    <div>
                      <p className="text-sm font-bold text-surface-900">일반사진</p>
                      <p className="mt-0.5 text-xs text-surface-400">가게사진이나, 메뉴가 아닌 사진들을 올려요</p>
                    </div>
                  </Link>
                  <Link
                    href="/seller/portfolio/new?type=portfolio"
                    onClick={() => setUploadSheetOpen(false)}
                    className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50/30 p-4 transition-all hover:bg-primary-50 active:scale-[0.99]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-lg">🎂</div>
                    <div>
                      <p className="text-sm font-bold text-primary-700">포트폴리오</p>
                      <p className="mt-0.5 text-xs text-surface-400">메뉴에 포함된 케이크 작품 사진을 올려요</p>
                    </div>
                  </Link>
                </div>
                <button
                  onClick={() => setUploadSheetOpen(false)}
                  className="mt-4 w-full rounded-xl bg-surface-100 py-3 text-sm font-semibold text-surface-500 transition-all hover:bg-surface-200"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ REVIEWS TAB (matches buyer) ═══ */}
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

            {/* External Links */}
            <div className="flex items-center justify-end">
              <div className="flex gap-1.5">
                {(externalLinks as any).naver && (
                  <a href={(externalLinks as any).naver} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#03C75A]/10 px-2.5 py-1 text-[10px] font-semibold text-[#03C75A]">네이버 리뷰</a>
                )}
                {(externalLinks as any).kakao && (
                  <a href={(externalLinks as any).kakao} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#FEE500]/30 px-2.5 py-1 text-[10px] font-semibold text-[#3C1E1E]">카카오 리뷰</a>
                )}
                {(externalLinks as any).google && (
                  <a href={(externalLinks as any).google} target="_blank" rel="noopener noreferrer" className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-600">구글 리뷰</a>
                )}
              </div>
            </div>

            {/* Review List */}
            {reviews.length === 0 ? (
              <div className="card-empty-state"><ChatBubbleIcon className="h-8 w-8 text-surface-300" /><h3 className="mt-2 font-semibold text-surface-900">리뷰가 없어요</h3><p className="mt-1 text-sm text-surface-500">첫 번째 리뷰를 남겨보세요!</p></div>
            ) : (
              reviews.map(r => (
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
                      }} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ INFO TAB ═══ */}
        {activeTab === 'info' && !editingInfo && (
          <div className="space-y-5">
            {pickupInfo.length > 0 && (
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-900"><InformationCircleIcon className="h-4 w-4 text-primary-500" /> 픽업 안내</h3>
                <div className="space-y-2">
                  {pickupInfo.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-surface-200 overflow-hidden">
                      <button onClick={() => setOpenPickupIdx(openPickupIdx === idx ? null : idx)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
                        <span className="text-sm font-medium text-surface-800">{item.title}</span>
                        {openPickupIdx === idx ? <ChevronUpIcon className="h-4 w-4 text-surface-400" /> : <ChevronDownIcon className="h-4 w-4 text-surface-400" />}
                      </button>
                      {openPickupIdx === idx && (
                        <div className="border-t border-surface-100 px-3 py-3"><p className="whitespace-pre-wrap text-sm text-surface-600">{item.description}</p></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {shop.business_hours && (
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-900"><ClockIcon className="h-4 w-4 text-primary-500" /> 영업시간</h3>
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
            <div className="rounded-2xl border border-surface-200 bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-surface-900"><MapPinIcon className="h-4 w-4 text-primary-500" /> 위치</h3>
              <p className="text-sm text-surface-600 mb-3">{shop.address}</p>
              {(shop as any).naver_map_url && (
                <a href={(shop as any).naver_map_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#03C75A]/30 bg-[#03C75A]/5 py-3 text-sm font-semibold text-[#03C75A]">
                  <MapPinIcon className="h-4 w-4" /> 네이버 지도에서 보기
                </a>
              )}
            </div>
            <button onClick={startEditInfo}
              className="w-full rounded-xl border border-primary-200 bg-primary-50 py-3 text-sm font-semibold text-primary-600 transition-all">
              <PencilIcon className="inline h-4 w-4 mr-1" /> 정보 편집하기
            </button>
          </div>
        )}

        {/* ═══ INFO EDIT MODE ═══ */}
        {activeTab === 'info' && editingInfo && (
          <div className="space-y-4">
            <label className="block"><span className="form-label">가게 이름</span><input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="form-input" /></label>
            <label className="block"><span className="form-label">소개</span><textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} className="form-textarea" /></label>
            <label className="block"><span className="form-label">주소</span><input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} className="form-input" /></label>
            <label className="block"><span className="form-label">네이버 맵 URL</span><input type="url" value={editNaverMap} onChange={e => setEditNaverMap(e.target.value)} placeholder="https://naver.me/..." className="form-input" /></label>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-lg border border-surface-200 bg-white px-3 py-3">
                <span className="text-sm font-medium text-surface-700">픽업</span>
                <button onClick={() => setEditIsPickup(!editIsPickup)} className={`form-toggle ${editIsPickup ? 'bg-primary-500' : 'bg-surface-300'}`}>
                  <span className={`form-toggle-knob ${editIsPickup ? 'left-[22px]' : 'left-0.5'}`} /></button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-surface-200 bg-white px-3 py-3">
                <span className="text-sm font-medium text-surface-700">배달</span>
                <button onClick={() => setEditIsDelivery(!editIsDelivery)} className={`form-toggle ${editIsDelivery ? 'bg-primary-500' : 'bg-surface-300'}`}>
                  <span className={`form-toggle-knob ${editIsDelivery ? 'left-[22px]' : 'left-0.5'}`} /></button>
              </div>
            </div>

            {/* Business Hours */}
            <div>
              <span className="form-label">영업시간</span>
              <div className="mt-1 space-y-1.5">
                {DAYS_KR.map(day => {
                  const h = editHours[day]; if (!h) return null;
                  return (
                    <div key={day} className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2">
                      <span className={`w-6 text-center text-xs font-bold ${h.closed ? 'text-surface-300' : 'text-surface-700'}`}>{day}</span>
                      {h.closed ? <span className="flex-1 text-xs text-surface-400">휴무</span> : (
                        <div className="flex flex-1 items-center gap-1">
                          <input type="time" value={h.open} onChange={e => setEditHours({ ...editHours, [day]: { ...h, open: e.target.value } })}
                            className="w-20 rounded border border-surface-200 px-1.5 py-1 text-xs" />
                          <span className="text-xs text-surface-400">~</span>
                          <input type="time" value={h.close} onChange={e => setEditHours({ ...editHours, [day]: { ...h, close: e.target.value } })}
                            className="w-20 rounded border border-surface-200 px-1.5 py-1 text-xs" />
                        </div>
                      )}
                      <button onClick={() => setEditHours({ ...editHours, [day]: { ...h, closed: !h.closed } })}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${h.closed ? 'bg-red-50 text-red-500' : 'bg-surface-100 text-surface-400'}`}>
                        {h.closed ? '휴무' : '영업'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingInfo(false)} className="flex-1 rounded-xl border border-surface-200 py-3 text-sm font-medium text-surface-600">취소</button>
              <button onClick={saveInfo} disabled={saving} className="flex-[2] btn-primary disabled:opacity-50">{saving ? '저장 중...' : '변경사항 저장'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Photo Viewer (matches buyer) */}
      {viewerOpen && viewerImages.length > 0 && (
        <div className="fixed inset-0 z-[100] flex justify-center bg-black">
          <div className="w-full max-w-[480px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => { setViewerOpen(false); setViewerImages([]); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <XMarkIcon className="h-5 w-5 text-white" />
            </button>
            <span className="text-sm text-white/70">{viewerIdx + 1} / {viewerImages.length}</span>
            <div className="w-9" />
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <img src={viewerImages[viewerIdx].url} alt="" className="max-h-full max-w-full object-contain" />
          </div>
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

      {/* ─── Menu Detail Full-Page Popup (mirrors buyer) ─── */}
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
                ? shopMenus.find(m => m.id === currentPopupView.menuId)?.name || '메뉴 상세'
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
              const popupMenu = shopMenus.find(m => m.id === currentPopupView.menuId);
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
                      const menuName = shopMenus.find(m => m.id === mainImg.menu_id)?.name;
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
