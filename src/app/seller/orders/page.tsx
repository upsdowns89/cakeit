'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient, createDataClient } from '@/lib/supabase/client';
import type { OrderWithBuyer, OrderStatus } from '@/lib/types';
import { ORDER_STATUS_MAP } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { CakeIcon, ChevronRightIcon, ClipboardDocumentListIcon } from '@/components/icons';

const ALL_STATUSES: OrderStatus[] = ['pending', 'accepted', 'payment_waiting', 'confirmed', 'making', 'pickup_ready', 'completed', 'cancelled'];

export default function SellerOrdersPage() {
  const searchParams = useSearchParams();
  const filterStatus = searchParams.get('status') as OrderStatus | null;

  const [orders, setOrders] = useState<OrderWithBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>(filterStatus || 'all');

  useEffect(() => {
    let client: ReturnType<typeof createClient> | null = null;
    try { client = createClient(); } catch { setLoading(false); return; }

    async function fetchOrders() {
      if (!client) return;

      // Prepare data client early for faster subsequent queries
      const dataClient = createDataClient();

      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const { data: shopData } = await dataClient
        .from('shops').select('id').eq('owner_id', user.id).limit(1).single();
      if (!shopData) { setLoading(false); return; }

      let query = dataClient
        .from('orders')
        .select('*, profiles!orders_buyer_id_fkey(nickname, email, phone, avatar_url)')
        .eq('shop_id', (shopData as any).id)
        .order('created_at', { ascending: false });

      if (activeFilter !== 'all') {
        query = query.eq('status', activeFilter);
      }

      const { data } = await query.limit(50);
      setOrders((data as OrderWithBuyer[]) || []);
      setLoading(false);
    }

    fetchOrders();
  }, [activeFilter]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section-header">
        <h1 className="text-lg font-bold text-surface-900">주문 관리</h1>
      </div>

      {/* Filter Tabs */}
      <div className="section-header px-2 py-2">
        <div className="filter-scroll">
          <button
            onClick={() => setActiveFilter('all')}
            className={`${
              activeFilter === 'all' ? 'btn-pill-active' : 'btn-pill'
            }`}
          >
            전체
          </button>
          {ALL_STATUSES.map((s) => {
            const info = ORDER_STATUS_MAP[s];
            return (
              <button
                key={s}
                onClick={() => setActiveFilter(s)}
                className={`${
                  activeFilter === s ? 'btn-pill-active' : 'btn-pill'
                }`}
              >
                {info.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-shimmer rounded-xl" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="card-empty-state">
            <ClipboardDocumentListIcon className="mb-2 h-8 w-8 text-surface-300" />
            <p className="text-sm font-medium text-surface-500">
              {activeFilter === 'all' ? '주문이 없습니다' : `'${ORDER_STATUS_MAP[activeFilter as OrderStatus]?.label}' 상태의 주문이 없습니다`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/seller/orders/${order.id}`}
                className="card-interactive"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-50">
                  {order.design_img_url ? (
                    <img src={order.design_img_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <CakeIcon className="h-6 w-6 text-primary-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-surface-900">
                      {order.profiles?.nickname || '고객'}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-surface-400">
                    {[order.cake_size, order.cake_flavor].filter(Boolean).join(' · ') || '옵션 미지정'}
                    {' · '}
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {order.total_price && (
                    <span className="text-sm font-bold text-surface-800">
                      ₩{order.total_price.toLocaleString()}
                    </span>
                  )}
                </div>
                <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-surface-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
