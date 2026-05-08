'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { StorefrontIcon, PhotoIcon } from '@/components/icons';

export default function RegisterShopPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Business hours state
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const [businessHours, setBusinessHours] = useState<
    Record<string, { open: string; close: string; closed: boolean }>
  >(
    Object.fromEntries(
      days.map((day) => [day, { open: '10:00', close: '20:00', closed: false }])
    )
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('이미지 크기는 5MB 이하여야 합니다.');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateBusinessHours = (
    day: string,
    field: 'open' | 'close' | 'closed',
    value: string | boolean
  ) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      // Upload image if provided
      let imageUrl: string | null = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('shop-images')
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          setError(`이미지 업로드 실패: ${uploadError.message}`);
          setLoading(false);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('shop-images').getPublicUrl(uploadData.path);
        imageUrl = publicUrl;
      }

      // Create shop
      const { error: shopError } = await supabase.from('shops').insert({
        owner_id: user.id,
        name,
        description,
        address,
        image_url: imageUrl,
        business_hours: businessHours,
      });

      if (shopError) {
        setError(shopError.message);
        setLoading(false);
        return;
      }

      router.push('/seller');
      router.refresh();
    } catch {
      setError('Supabase 설정을 확인해주세요. (.env.local)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
          <StorefrontIcon className="h-4 w-4" /> 가게 등록
        </div>
        <h1 className="text-xl font-bold text-surface-900">
          내 케이크 가게를 등록하세요
        </h1>
        <p className="mt-2 text-surface-500">
          가게 정보를 입력하면 소비자들이 검색하고 주문할 수 있습니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-surface-200 bg-white p-5 shadow-sm"
      >
        {error && (
          <div className="animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Image Upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-surface-700">
            가게 대표 이미지
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-48 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-surface-300 bg-surface-50 transition-all hover:border-primary-400 hover:bg-primary-50/30"
          >
            {imagePreview ? (
              <>
                <img
                  src={imagePreview}
                  alt="미리보기"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-medium text-surface-700">
                    이미지 변경
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-surface-400">
                <PhotoIcon className="h-10 w-10 transition-colors group-hover:text-primary-400" />
                <span className="text-sm">클릭하여 이미지를 업로드하세요</span>
                <span className="text-xs text-surface-400">
                  JPG, PNG (최대 5MB)
                </span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>

        {/* Shop Name */}
        <div>
          <label
            htmlFor="shopName"
            className="mb-1.5 block text-sm font-medium text-surface-700"
          >
            가게 이름 <span className="text-danger">*</span>
          </label>
          <input
            id="shopName"
            type="text"
            placeholder="예: 달콤한 케이크 공방"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="mb-1.5 block text-sm font-medium text-surface-700"
          >
            가게 소개 <span className="text-danger">*</span>
          </label>
          <textarea
            id="description"
            placeholder="가게의 특징, 시그니처 메뉴 등을 소개해주세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            className="w-full resize-none rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        {/* Address */}
        <div>
          <label
            htmlFor="address"
            className="mb-1.5 block text-sm font-medium text-surface-700"
          >
            주소 <span className="text-danger">*</span>
          </label>
          <input
            id="address"
            type="text"
            placeholder="서울시 강남구 역삼동 123-45"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        {/* Business Hours */}
        <div>
          <label className="mb-2 block text-sm font-medium text-surface-700">
            영업시간
          </label>
          <div className="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-4">
            {days.map((day) => (
              <div
                key={day}
                className="flex items-center gap-3"
              >
                <span
                  className={`w-6 text-center text-sm font-semibold ${
                    businessHours[day].closed
                      ? 'text-surface-400'
                      : 'text-surface-700'
                  }`}
                >
                  {day}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateBusinessHours(day, 'closed', !businessHours[day].closed)
                  }
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                    businessHours[day].closed
                      ? 'bg-surface-200 text-surface-500'
                      : 'bg-success/10 text-success'
                  }`}
                >
                  {businessHours[day].closed ? '휴무' : '영업'}
                </button>
                {!businessHours[day].closed && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={businessHours[day].open}
                      onChange={(e) =>
                        updateBusinessHours(day, 'open', e.target.value)
                      }
                      className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700"
                    />
                    <span className="text-xs text-surface-400">~</span>
                    <input
                      type="time"
                      value={businessHours[day].close}
                      onChange={(e) =>
                        updateBusinessHours(day, 'close', e.target.value)
                      }
                      className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              router.push('/seller');
              router.refresh();
            }}
            className="flex-1 rounded-xl border border-surface-200 px-4 py-3.5 text-sm font-medium text-surface-600 transition-all hover:bg-surface-50"
          >
            나중에
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:shadow-xl hover:shadow-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                등록 중...
              </span>
            ) : (
              '가게 등록하기'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
