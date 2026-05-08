'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient, createDataClient } from '@/lib/supabase/client';
import type { OrderWithBuyer, OrderStatus } from '@/lib/types';
import {
  ORDER_STATUS_MAP,
  ORDER_STATUS_FLOW,
  CAKE_SIZE_OPTIONS,
  CAKE_FLAVOR_OPTIONS,
  CREAM_TYPE_OPTIONS,
} from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { ArrowLeftIcon, CakeIcon, PhotoIcon } from '@/components/icons';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderWithBuyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editable fields
  const [cakeSize, setCakeSize] = useState('');
  const [cakeFlavor, setCakeFlavor] = useState('');
  const [creamType, setCreamType] = useState('');
  const [letteringText, setLetteringText] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [sellerNote, setSellerNote] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [status, setStatus] = useState<OrderStatus>('pending');

  useEffect(() => {
    let client: ReturnType<typeof createClient> | null = null;
    try { client = createClient(); } catch { setLoading(false); return; }

    async function fetchOrder() {
      if (!client) return;
      const dataClient = createDataClient();

      const { data } = await dataClient
        .from('orders')
        .select('*, profiles!orders_buyer_id_fkey(nickname, email, phone, avatar_url)')
        .eq('id', orderId)
        .single();

      if (data) {
        const o = data as OrderWithBuyer;
        setOrder(o);
        setCakeSize(o.cake_size || '');
        setCakeFlavor(o.cake_flavor || '');
        setCreamType(o.cream_type || '');
        setLetteringText(o.lettering_text || '');
        setTotalPrice(o.total_price?.toString() || '');
        setSellerNote(o.seller_note || '');
        setPickupDate(o.pickup_date ? new Date(o.pickup_date).toISOString().slice(0, 16) : '');
        setStatus(o.status);
      }
      setLoading(false);
    }

    fetchOrder();
  }, [orderId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const dataClient = createDataClient();
      const updateData: Record<string, unknown> = {
        cake_size: cakeSize || null,
        cake_flavor: cakeFlavor || null,
        cream_type: creamType || null,
        lettering_text: letteringText || null,
        total_price: totalPrice ? parseInt(totalPrice) : null,
        seller_note: sellerNote || null,
        status,
      };

      if (pickupDate) {
        updateData.pickup_date = new Date(pickupDate).toISOString();
      }

      // If price changed and no original_price set, save original
      if (order && order.total_price && totalPrice && parseInt(totalPrice) !== order.total_price && !order.original_price) {
        updateData.original_price = order.total_price;
      }

      const { error } = await (dataClient as any)
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // Send system message if status changed
      if (order && status !== order.status) {
        const client = createClient();
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          const statusLabel = ORDER_STATUS_MAP[status].label;
          await (dataClient as any).from('messages').insert({
            order_id: orderId,
            sender_id: user.id,
            content: `[시스템] 주문 상태가 '${statusLabel}'(으)로 변경되었습니다.`,
          });
        }
      }

      // Update local order state
      setOrder((prev) => prev ? { ...prev, ...updateData, total_price: totalPrice ? parseInt(totalPrice) : null } as OrderWithBuyer : null);
      setMessage({ type: 'success', text: '주문이 업데이트되었습니다.' });
    } catch (err) {
      console.error('Update failed:', err);
      setMessage({ type: 'error', text: '업데이트에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusAdvance = async (newStatus: OrderStatus) => {
    setStatus(newStatus);
  };

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="h-6 w-40 animate-shimmer rounded-lg" />
        <div className="mt-6 h-48 animate-shimmer rounded-xl" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-shimmer rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center">
        <p className="text-sm text-surface-500">주문을 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section-header-sticky">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-600 hover:bg-surface-100">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-surface-900">주문서 편집</h1>
            <p className="text-xs text-surface-400">#{orderId.slice(0, 8)}</p>
          </div>
          <StatusBadge status={order.status} size="md" />
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mx-4 mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Customer Info */}
      <section className="section-panel mt-0">
        <h3 className="section-title mb-2">고객 정보</h3>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
            {order.profiles?.nickname?.charAt(0) || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900">{order.profiles?.nickname || '(이름 없음)'}</p>
            <p className="text-xs text-surface-400">{order.profiles?.phone || order.profiles?.email || '-'}</p>
          </div>
        </div>
      </section>

      {/* Design Image & Request */}
      <section className="section-panel">
        <h3 className="section-title mb-2">디자인 & 요청사항</h3>
        {order.design_img_url ? (
          <div className="overflow-hidden rounded-xl border border-surface-200">
            <img src={order.design_img_url} alt="케이크 디자인" className="w-full object-cover" style={{ maxHeight: '200px' }} />
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-surface-300 bg-surface-50">
            <div className="flex flex-col items-center gap-1">
              <PhotoIcon className="h-6 w-6 text-surface-300" />
              <span className="text-xs text-surface-400">디자인 이미지 없음</span>
            </div>
          </div>
        )}
        {order.request_detail && (
          <div className="mt-3 rounded-lg bg-surface-50 p-3">
            <p className="text-xs font-medium text-surface-400">고객 요청:</p>
            <p className="mt-1 text-sm text-surface-700">{order.request_detail}</p>
          </div>
        )}
      </section>

      {/* Status Flow */}
      <section className="section-panel">
        <h3 className="section-title mb-3">상태 변경</h3>
        <div className="filter-scroll gap-1.5">
          {ORDER_STATUS_FLOW.map((s) => {
            const info = ORDER_STATUS_MAP[s];
            const isCurrentDb = order.status === s;
            const isSelected = status === s;
            return (
              <button
                key={s}
                onClick={() => handleStatusAdvance(s)}
                className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                  isSelected
                    ? 'bg-surface-900 border-surface-900 text-white'
                    : isCurrentDb
                    ? `${info.bgColor} ${info.color}`
                    : 'border-surface-200 bg-white text-surface-400 hover:bg-surface-50'
                }`}
              >
                {info.label}
              </button>
            );
          })}
          <button
            onClick={() => handleStatusAdvance('cancelled')}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
              status === 'cancelled'
                ? 'bg-red-600 border-red-600 text-white'
                : 'border-red-200 bg-red-50 text-red-400 hover:bg-red-100'
            }`}
          >
            취소
          </button>
        </div>
      </section>

      {/* Editable Form */}
      <section className="px-4 py-4">
        <h3 className="section-title mb-3">주문 상세 편집</h3>
        <div className="space-y-3">
          {/* Cake Size */}
          <label className="block">
            <span className="form-label">케이크 사이즈</span>
            <select
              value={cakeSize}
              onChange={(e) => setCakeSize(e.target.value)}
              className="form-select"
            >
              <option value="">선택</option>
              {CAKE_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>

          {/* Cake Flavor */}
          <label className="block">
            <span className="form-label">시트 맛</span>
            <select
              value={cakeFlavor}
              onChange={(e) => setCakeFlavor(e.target.value)}
              className="form-select"
            >
              <option value="">선택</option>
              {CAKE_FLAVOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>

          {/* Cream Type */}
          <label className="block">
            <span className="form-label">크림 종류</span>
            <select
              value={creamType}
              onChange={(e) => setCreamType(e.target.value)}
              className="form-select"
            >
              <option value="">선택</option>
              {CREAM_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>

          {/* Lettering Text */}
          <label className="block">
            <span className="form-label">레터링 문구</span>
            <input
              type="text"
              value={letteringText}
              onChange={(e) => setLetteringText(e.target.value)}
              placeholder="예: 생일 축하해요!"
              className="form-input"
            />
          </label>

          {/* Pickup Date */}
          <label className="block">
            <span className="form-label">픽업 날짜 & 시간</span>
            <input
              type="datetime-local"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className="form-input"
            />
          </label>

          {/* Total Price */}
          <label className="block">
            <span className="form-label">총 금액 (원)</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">₩</span>
              <input
                type="number"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder='0'
                className="w-full rounded-lg border border-surface-200 bg-white py-2.5 pl-7 pr-3 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
              />
            </div>
            {order.original_price && order.total_price !== order.original_price && (
              <p className="mt-1 text-[11px] text-surface-400">
                원래 가격: ₩{order.original_price.toLocaleString()}
              </p>
            )}
          </label>

          {/* Seller Note */}
          <label className="block">
            <span className="form-label">사장님 메모</span>
            <textarea
              value={sellerNote}
              onChange={(e) => setSellerNote(e.target.value)}
              placeholder="내부 메모 (고객에게 보이지 않음)"
              rows={3}
              className="form-textarea"
            />
          </label>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="action-bar">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? '저장 중...' : '주문 업데이트'}
        </button>
      </div>
    </div>
  );
}
