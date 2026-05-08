'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient, createDataClient } from '@/lib/supabase/client';
import type { OrderWithBuyer, Shop, OrderStatus } from '@/lib/types';
import { ORDER_STATUS_MAP } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import {
  CakeIcon,
  ClockIcon,
  ChevronRightIcon,
  SparklesIcon,
  MapPinIcon,
} from '@/components/icons';

const STATUS_COUNTS_KEYS: OrderStatus[] = ['pending', 'accepted', 'payment_waiting', 'making', 'pickup_ready'];

export default function SellerDashboard() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [todayOrders, setTodayOrders] = useState<OrderWithBuyer[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderWithBuyer[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let client: ReturnType<typeof createClient> | null = null;
    try {
      client = createClient();
    } catch {
      setLoading(false);
      return;
    }

    async function fetchData() {
      if (!client) return;
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const dataClient = createDataClient();

      // Get shop
      const { data: shopData } = await dataClient
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
        .single();

      if (!shopData) {
        setLoading(false);
        return;
      }
      setShop(shopData as Shop);

      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      // Get today's pickup orders
      const { data: todayData } = await dataClient
        .from('orders')
        .select('*, profiles!orders_buyer_id_fkey(nickname, email, phone, avatar_url)')
        .eq('shop_id', (shopData as any).id)
        .gte('pickup_date', startOfDay)
        .lt('pickup_date', endOfDay)
        .order('pickup_date', { ascending: true });

      setTodayOrders((todayData as OrderWithBuyer[]) || []);

      // Get recent orders (all statuses)
      const { data: recentData } = await dataClient
        .from('orders')
        .select('*, profiles!orders_buyer_id_fkey(nickname, email, phone, avatar_url)')
        .eq('shop_id', (shopData as any).id)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentOrders((recentData as OrderWithBuyer[]) || []);

      // Count by status
      const counts: Record<string, number> = {};
      for (const s of STATUS_COUNTS_KEYS) {
        const { count } = await dataClient
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', (shopData as any).id)
          .eq('status', s);
        counts[s] = count || 0;
      }
      setStatusCounts(counts);
      setLoading(false);
    }

    fetchData();

    // Realtime subscription for order updates
    const supabaseRef = client;
    const channel = client
      .channel('seller-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => { fetchData(); }
      )
      .subscribe();

    return () => { supabaseRef.removeChannel(channel); };
  }, []);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="mb-6">
          <div className="h-7 w-40 animate-shimmer rounded-lg" />
          <div className="mt-2 h-4 w-56 animate-shimmer rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-shimmer rounded-xl" />)}
        </div>
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section-header py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-sm">
            <CakeIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-surface-900">{shop?.name || '내 가게'}</h1>
            <p className="text-xs text-surface-400">{todayStr}</p>
          </div>
        </div>
      </div>

      {/* Status Counts */}
      <section className="px-4 pt-4">
        <div className="grid grid-cols-5 gap-1.5">
          {STATUS_COUNTS_KEYS.map((s) => {
            const info = ORDER_STATUS_MAP[s];
            return (
              <Link
                key={s}
                href={`/seller/orders?status=${s}`}
                className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition-all active:scale-95 ${info.bgColor}`}
              >
                <span className={`text-lg font-bold ${info.color}`}>{statusCounts[s] || 0}</span>
                <span className={`text-[10px] font-medium ${info.color}`}>{info.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Today's Pickup Timeline */}
      <section className="px-4 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-primary-500" />
            <h2 className="text-[15px] font-bold text-surface-900">
              오늘 픽업 ({todayOrders.length}건)
            </h2>
          </div>
        </div>

        {todayOrders.length === 0 ? (
          <div className="card-empty-state py-8">
            <CakeIcon className="mb-2 h-8 w-8 text-surface-300" />
            <p className="text-sm font-medium text-surface-500">오늘 픽업 예정 건이 없어요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayOrders.map((order) => (
              <Link
                key={order.id}
                href={`/seller/orders/${order.id}`}
                className="card-interactive"
              >
                {/* Time */}
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-surface-900">{formatTime(order.pickup_date)}</span>
                </div>
                {/* Divider */}
                <div className="h-10 w-px bg-surface-200" />
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-surface-900">
                      {order.profiles?.nickname || '고객'}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-surface-400">
                    {[order.cake_size, order.cake_flavor, order.cream_type].filter(Boolean).join(' · ') || '옵션 미지정'}
                  </p>
                </div>
                {/* Price */}
                <div className="text-right flex-shrink-0">
                  {order.total_price && (
                    <span className="text-sm font-bold text-surface-900">
                      ₩{order.total_price.toLocaleString()}
                    </span>
                  )}
                </div>
                <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-surface-300" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Orders */}
      <section className="px-4 pt-6 pb-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-violet-500" />
            <h2 className="text-[15px] font-bold text-surface-900">최근 주문</h2>
          </div>
          <Link
            href="/seller/orders"
            className="flex items-center gap-0.5 text-xs font-medium text-surface-400 hover:text-surface-600"
          >
            전체보기
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="card-empty-state py-8">
            <p className="text-sm text-surface-400">아직 주문이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/seller/orders/${order.id}`}
                className="card-interactive"
              >
                {/* Design image or placeholder */}
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
      </section>
    </div>
  );
}
