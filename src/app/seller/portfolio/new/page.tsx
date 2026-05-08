'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CAKE_SIZE_OPTIONS, CAKE_TYPE_TAGS, OCCASION_TAGS } from '@/lib/types';
import type { ShopMenu } from '@/lib/types';
import {
  ArrowLeftIcon,
  PhotoIcon,
  XMarkIcon,
  PlusIcon,
  CakeIcon,
  ChevronRightIcon,
} from '@/components/icons';

const MAX_FILES = 10;
const MAX_TEXT = 500;

type Step = 1 | 2;

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export default function SellerPortfolioNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // type=photo (regular) or type=portfolio (default)
  const postType = searchParams.get('type') || 'portfolio';
  const isPortfolio = postType === 'portfolio';

  /* ─── State ─── */
  const [step, setStep] = useState<Step>(1);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [description, setDescription] = useState('');

  // Step 2 fields
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [cakeSize, setCakeSize] = useState('');
  const [price, setPrice] = useState('');
  const [madeDate, setMadeDate] = useState('');
  const [cakeType, setCakeType] = useState('');
  const [occasion, setOccasion] = useState('');

  // Shop data
  const [shopId, setShopId] = useState<string | null>(null);
  const [menus, setMenus] = useState<ShopMenu[]>([]);
  const [availableSizes, setAvailableSizes] = useState<string[]>([...CAKE_SIZE_OPTIONS]);

  // UI state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  /* ─── Fetch shop data ─── */
  useEffect(() => {
    async function fetchShop() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: shop } = await supabase
          .from('shops')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1)
          .single();

        if (shop) {
          setShopId(shop.id);

          // Fetch shop_menus with sizes
          const { data: menuData } = await (supabase as any)
            .from('shop_menus')
            .select('*, shop_menu_sizes(id, menu_id, cake_size, price_min, price_max)')
            .eq('shop_id', shop.id)
            .order('position');

          if (menuData && menuData.length > 0) {
            setMenus(menuData as ShopMenu[]);
            // Collect available sizes from all menus
            const sizeSet = new Set<string>();
            menuData.forEach((m: any) =>
              (m.shop_menu_sizes || []).forEach((s: any) => sizeSet.add(s.cake_size))
            );
            if (sizeSet.size > 0) setAvailableSizes([...sizeSet]);
          }
        }
      } catch { /* silently fail */ }
    }
    fetchShop();
  }, []);

  /* ─── File handling ─── */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).slice(0, MAX_FILES - files.length);

    const uploads: UploadFile[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }));

    setFiles((prev) => [...prev, ...uploads].slice(0, MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [files.length]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const f = prev.find((p) => p.id === id);
      if (f) URL.revokeObjectURL(f.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  /* ─── Navigation ─── */
  const canGoStep2 = files.length > 0;
  const canSubmit = files.length > 0;

  const goToStep2 = () => {
    if (!canGoStep2) return;
    setStep(2);
  };

  const goBackToStep1 = () => {
    setStep(1);
  };

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    if (!shopId || !canSubmit || uploading) return;
    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const totalFiles = files.length;
      let uploaded = 0;
      // Generate a shared group_id for all files in this batch
      const groupId = totalFiles > 1 ? crypto.randomUUID() : null;

      for (const uploadFile of files) {
        const ext = uploadFile.file.name.split('.').pop();
        const path = `${user.id}/portfolio_${Date.now()}_${uploaded}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('shop-images')
          .upload(path, uploadFile.file);
        if (upErr) throw upErr;

        const { data: { publicUrl } } = supabase.storage
          .from('shop-images')
          .getPublicUrl(path);

        const selectedMenu = menus.find(m => m.id === selectedMenuId);

        const insertData: Record<string, any> = {
          shop_id: shopId,
          url: publicUrl,
          position: uploaded,
          is_portfolio: isPortfolio,
          description: description || null,
          design_type: isPortfolio ? (selectedMenu?.name || null) : null,
          cake_size: isPortfolio ? (cakeSize || null) : null,
          price: isPortfolio && price ? parseInt(price) : null,
          made_date: isPortfolio ? (madeDate || null) : null,
          menu_id: isPortfolio ? (selectedMenuId || null) : null,
          group_id: groupId,
          cake_type: isPortfolio ? (cakeType || null) : null,
          occasion: isPortfolio ? (occasion || null) : null,
          custom_type: isPortfolio ? (selectedMenu?.custom_type || null) : null,
        };

        const { error: insErr } = await (supabase as any)
          .from('shop_gallery_images')
          .insert(insertData);
        if (insErr) throw insErr;

        uploaded++;
        setUploadProgress(Math.round((uploaded / totalFiles) * 100));
      }

      // Success - redirect back
      router.push('/seller/shop');
      router.refresh();
    } catch (err: any) {
      setError(err.message || '업로드에 실패했습니다');
      setUploading(false);
    }
  };

  /* ─── Step 1: Media + Text ─── */
  const renderStep1 = () => (
    <div className="flex flex-col gap-5 px-4 py-5">
      {/* Media Upload Area */}
      <div>
        <label className="mb-2 block text-sm font-bold text-surface-900">
          사진 / 동영상 <span className="text-primary-500">*</span>
          <span className="ml-1 text-xs font-normal text-surface-400">({files.length}/{MAX_FILES})</span>
        </label>

        {files.length === 0 ? (
          /* Empty state - big upload zone */
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-surface-300 bg-surface-50 py-16 transition-all hover:border-primary-400 hover:bg-primary-50/30 active:scale-[0.99]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100">
              <PhotoIcon className="h-7 w-7 text-primary-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-surface-700">사진 또는 동영상 추가</p>
              <p className="mt-0.5 text-xs text-surface-400">최대 {MAX_FILES}개까지 업로드 가능</p>
            </div>
          </button>
        ) : (
          /* File grid */
          <div className="grid grid-cols-3 gap-2">
            {files.map((f) => (
              <div key={f.id} className="group relative aspect-square overflow-hidden rounded-xl bg-surface-100">
                {f.type === 'video' ? (
                  <video src={f.preview} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={f.preview} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  onClick={() => removeFile(f.id)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-transform active:scale-90"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
                {f.type === 'video' && (
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    VIDEO
                  </span>
                )}
              </div>
            ))}
            {files.length < MAX_FILES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-surface-300 bg-surface-50 transition-colors hover:border-primary-400 hover:bg-primary-50/30"
              >
                <PlusIcon className="h-6 w-6 text-surface-400" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="mb-2 block text-sm font-bold text-surface-900">
          설명
          <span className="ml-1 text-xs font-normal text-surface-400">({description.length}/{MAX_TEXT})</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => {
            if (e.target.value.length <= MAX_TEXT) setDescription(e.target.value);
          }}
          placeholder="케이크 설명, 작업 비하인드, 레시피 포인트 등을 작성해보세요..."
          rows={5}
          className="form-textarea"
        />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );

  /* ─── Step 2: Additional Info ─── */
  const renderStep2 = () => (
    <div className="flex flex-col gap-5 px-4 py-5">
      {/* Preview */}
      <div className="flex items-center gap-3 rounded-xl bg-surface-50 p-3">
        {files[0] && (
          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
            <img src={files[0].preview} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-900">
            {files.length}개의 미디어
          </p>
          <p className="mt-0.5 truncate text-xs text-surface-400">
            {description || '설명 없음'}
          </p>
        </div>
        <button
          onClick={goBackToStep1}
          className="text-xs font-medium text-primary-500"
        >
          수정
        </button>
      </div>

      <div className="h-px bg-surface-200" />

      <p className="text-xs text-surface-400">아래 정보는 선택사항이에요. 입력하면 더 풍부한 포트폴리오가 돼요!</p>

      {/* Cake Type Tag */}
      <div>
        <label className="form-label">케이크 종류</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {CAKE_TYPE_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setCakeType(cakeType === t ? '' : t)}
              className={cakeType === t ? 'btn-pill-active' : 'btn-pill'}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Occasion Tag */}
      <div>
        <label className="form-label">축하 목적</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {OCCASION_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setOccasion(occasion === t ? '' : t)}
              className={occasion === t ? 'btn-pill-active' : 'btn-pill'}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Selection */}
      <div>
        <label className="form-label">메뉴 선택</label>
        {menus.length > 0 ? (
          <div className="mt-1.5 space-y-2">
            {menus.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  const newId = selectedMenuId === m.id ? '' : m.id;
                  setSelectedMenuId(newId);
                  // Auto-fill cake_type from menu's cake_types
                  if (newId) {
                    const menu = menus.find(mm => mm.id === newId);
                    if (menu?.cake_types && menu.cake_types.length > 0 && !cakeType) {
                      setCakeType(menu.cake_types[0]);
                    }
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  selectedMenuId === m.id
                    ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-200'
                    : 'border-surface-200 bg-white hover:border-surface-300'
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  selectedMenuId === m.id ? 'bg-primary-500' : 'bg-surface-100'
                }`}>
                  <CakeIcon className={`h-4 w-4 ${selectedMenuId === m.id ? 'text-white' : 'text-surface-400'}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${selectedMenuId === m.id ? 'text-primary-700' : 'text-surface-800'}`}>
                    {m.name}
                  </p>
                  {((m.cake_types && m.cake_types.length > 0) || m.custom_type) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.cake_types?.map(t => (
                        <span key={t} className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-600">{t}</span>
                      ))}
                      {m.custom_type && (
                        <span className="rounded-full bg-surface-100 px-1.5 py-0.5 text-[10px] font-medium text-surface-600">{m.custom_type}</span>
                      )}
                    </div>
                  )}
                  {m.shop_menu_sizes && m.shop_menu_sizes.length > 0 && (
                    <p className="mt-0.5 text-xs text-surface-400">
                      {m.shop_menu_sizes.map((s: any) => s.cake_size).join(', ')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-surface-400">등록된 메뉴가 없어요. 내 스토어에서 메뉴를 먼저 만들어보세요!</p>
        )}
      </div>

      {/* Cake Size */}
      <div>
        <label className="form-label">케이크 사이즈</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {availableSizes.map((s) => (
            <button
              key={s}
              onClick={() => setCakeSize(cakeSize === s ? '' : s)}
              className={cakeSize === s ? 'btn-pill-active' : 'btn-pill'}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <label className="form-label">가격</label>
        <div className="relative mt-1.5">
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="50000"
            className="form-input pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">원</span>
        </div>
      </div>

      {/* Made Date */}
      <div>
        <label className="form-label">제작 날짜</label>
        <input
          type="date"
          value={madeDate}
          onChange={(e) => setMadeDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="form-input mt-1.5"
        />
      </div>
    </div>
  );

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-white">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-surface-200/60 bg-white/95 px-4 py-3 backdrop-blur-lg">
        <button
          onClick={() => {
            if (step === 2) goBackToStep1();
            else router.back();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100"
        >
          <ArrowLeftIcon className="h-5 w-5 text-surface-700" />
        </button>

        <h1 className="text-base font-bold text-surface-900">
          {!isPortfolio
            ? '사진 등록'
            : step === 1 ? '포트폴리오 등록' : '추가 정보'}
        </h1>

        {/* Step indicator (portfolio only) */}
        {isPortfolio ? (
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-4 rounded-full ${step === 1 ? 'bg-primary-500' : 'bg-surface-200'}`} />
            <span className={`h-1.5 w-4 rounded-full ${step === 2 ? 'bg-primary-500' : 'bg-surface-200'}`} />
          </div>
        ) : <div className="w-9" />}
      </div>

      {/* ─── Content ─── */}
      {(!isPortfolio || step === 1) ? renderStep1() : renderStep2()}

      {/* ─── Bottom Action ─── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-surface-200 bg-white safe-area-bottom flex justify-center">
        <div className="w-full max-w-[480px] p-4">
        {!isPortfolio ? (
          /* Regular photo: submit directly */
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || uploading}
            className="btn-primary w-full disabled:opacity-40"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="gallery-spinner" />
                업로드 중... {uploadProgress}%
              </span>
            ) : (
              <>
                <PhotoIcon className="mr-1 inline h-4 w-4" />
                사진 등록하기
              </>
            )}
          </button>
        ) : step === 1 ? (
          <button
            onClick={goToStep2}
            disabled={!canGoStep2}
            className="btn-primary w-full disabled:opacity-40"
          >
            다음
            <ChevronRightIcon className="ml-1 inline h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || uploading}
            className="btn-primary w-full disabled:opacity-40"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="gallery-spinner" />
                업로드 중... {uploadProgress}%
              </span>
            ) : (
              <>
                <CakeIcon className="mr-1 inline h-4 w-4" />
                포스팅하기
              </>
            )}
          </button>
        )}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed left-4 right-4 top-20 z-[100] animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-lg">
          {error}
          <button onClick={() => setError('')} className="absolute right-3 top-3">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
