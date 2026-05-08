'use client';

import { useEffect, useState } from 'react';
import { MapPinIcon } from '@/components/icons';

export default function MapPage() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setHasPermission(true),
        () => setHasPermission(false)
      );
    } else {
      setHasPermission(false);
    }
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-100 to-blue-200">
        <MapPinIcon className="h-10 w-10 text-blue-500" />
      </div>
      <h1 className="text-xl font-bold text-surface-900">내 주변 케이크 가게</h1>
      <p className="mt-2 text-sm text-surface-500">
        {hasPermission === null
          ? '위치 권한을 확인하고 있어요...'
          : hasPermission
            ? '곧 지도에서 내 주변 케이크 가게를 찾을 수 있어요!'
            : '위치 권한을 허용하면 내 주변 가게를 볼 수 있어요'}
      </p>
      <div className="mt-6 rounded-2xl border border-dashed border-surface-300 bg-surface-50 px-8 py-6">
        <p className="text-xs text-surface-400">🗺️ 지도 기능 준비 중</p>
      </div>
    </div>
  );
}
