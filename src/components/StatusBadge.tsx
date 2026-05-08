'use client';

import type { OrderStatus } from '@/lib/types';
import { ORDER_STATUS_MAP } from '@/lib/types';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const info = ORDER_STATUS_MAP[status] || ORDER_STATUS_MAP.pending;

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${info.color} ${info.bgColor} ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      {info.label}
    </span>
  );
}
