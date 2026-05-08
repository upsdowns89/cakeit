'use client';

import { ClipboardDocumentListIcon } from '@/components/icons';

export default function OrdersPage() {
  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-100 to-primary-200">
        <ClipboardDocumentListIcon className="h-10 w-10 text-primary-500" />
      </div>
      <h1 className="text-xl font-bold text-surface-900">내 주문</h1>
      <p className="mt-2 text-sm text-surface-500">
        주문 내역이 여기에 표시됩니다
      </p>
      <div className="mt-6 rounded-2xl border border-dashed border-surface-300 bg-surface-50 px-8 py-6">
        <p className="text-xs text-surface-400">📋 아직 주문 내역이 없어요</p>
      </div>
    </div>
  );
}
