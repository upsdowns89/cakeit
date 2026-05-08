'use client';

import { useEffect, useState } from 'react';
import { createClient, createDataClient } from '@/lib/supabase/client';
import type { Slot } from '@/lib/types';
import { CalendarIcon, ChevronDownIcon } from '@/components/icons';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export default function SchedulePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editCapacity, setEditCapacity] = useState(5);
  const [editClosed, setEditClosed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Order counts per day
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let client: ReturnType<typeof createClient> | null = null;
    try { client = createClient(); } catch { setLoading(false); return; }

    async function init() {
      if (!client) return;
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      const dataClient = createDataClient();
      const { data: shopData } = await dataClient
        .from('shops').select('id').eq('owner_id', user.id).limit(1).single();
      if (!shopData) { setLoading(false); return; }
      setShopId((shopData as any).id);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!shopId) return;
    fetchSlots();
    fetchOrderCounts();
  }, [shopId, year, month]);

  const fetchSlots = async () => {
    if (!shopId) return;
    const dataClient = createDataClient();
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0')}-01`;

    const { data } = await dataClient
      .from('slots')
      .select('*')
      .eq('shop_id', shopId)
      .gte('date', startDate)
      .lt('date', endDate);

    setSlots((data as Slot[]) || []);
  };

  const fetchOrderCounts = async () => {
    if (!shopId) return;
    const dataClient = createDataClient();
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 1).toISOString();

    const { data } = await dataClient
      .from('orders')
      .select('pickup_date')
      .eq('shop_id', shopId)
      .gte('pickup_date', startDate)
      .lt('pickup_date', endDate)
      .not('status', 'eq', 'cancelled');

    const counts: Record<string, number> = {};
    (data as any[])?.forEach((order: any) => {
      if (order.pickup_date) {
        const dateStr = new Date(order.pickup_date).toISOString().split('T')[0];
        counts[dateStr] = (counts[dateStr] || 0) + 1;
      }
    });
    setOrderCounts(counts);
  };

  const getSlotForDate = (day: number): Slot | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return slots.find((s) => s.date === dateStr);
  };

  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    const slot = getSlotForDate(day);
    setEditCapacity(slot?.capacity ?? 5);
    setEditClosed(slot?.is_closed ?? false);
  };

  const handleSaveSlot = async () => {
    if (!shopId || !selectedDate) return;
    setSaving(true);

    try {
      const dataClient = createDataClient();
      const existingSlot = slots.find((s) => s.date === selectedDate);

      if (existingSlot) {
        await (dataClient as any)
          .from('slots')
          .update({ capacity: editCapacity, is_closed: editClosed })
          .eq('id', existingSlot.id);
      } else {
        await (dataClient as any)
          .from('slots')
          .insert({ shop_id: shopId, date: selectedDate, capacity: editCapacity, is_closed: editClosed });
      }

      await fetchSlots();
    } catch (err) {
      console.error('Slot save failed:', err);
    }
    setSaving(false);
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const days = getMonthDays(year, month);
  const isToday = (day: number) => {
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };
  const isPast = (day: number) => {
    const d = new Date(year, month, day);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < t;
  };

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="h-6 w-32 animate-shimmer rounded-lg" />
        <div className="mt-4 h-80 animate-shimmer rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section-header">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary-500" />
          <h1 className="text-lg font-bold text-surface-900">스케줄 관리</h1>
        </div>
      </div>

      {/* Month Nav */}
      <div className="section-header flex items-center justify-between py-3">
        <button onClick={prevMonth} className="rounded-lg px-3 py-1.5 text-sm font-medium text-surface-600 hover:bg-surface-100">
          ← 이전
        </button>
        <h2 className="text-base font-bold text-surface-900">
          {year}년 {month + 1}월
        </h2>
        <button onClick={nextMonth} className="rounded-lg px-3 py-1.5 text-sm font-medium text-surface-600 hover:bg-surface-100">
          다음 →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white px-2 py-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d, i) => (
            <div key={d} className={`text-center text-[11px] font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-surface-400'}`}>
              {d}
            </div>
          ))}
        </div>
        {/* Days grid */}
        <div className="grid grid-cols-7 gap-px">
          {days.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="h-16" />;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const slot = getSlotForDate(day);
            const count = orderCounts[dateStr] || 0;
            const isClosed = slot?.is_closed;
            const isSelected = selectedDate === dateStr;
            const past = isPast(day);

            return (
              <button
                key={dateStr}
                onClick={() => !past && handleDateClick(day)}
                disabled={past}
                className={`relative flex flex-col items-center justify-start rounded-lg p-1 h-16 transition-all ${
                  isSelected
                    ? 'bg-primary-50 ring-2 ring-primary-400'
                    : past
                    ? 'opacity-40'
                    : isClosed
                    ? 'bg-red-50'
                    : 'hover:bg-surface-50'
                }`}
              >
                <span className={`text-xs font-semibold ${
                  isToday(day) ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white' :
                  isClosed ? 'text-red-400' :
                  'text-surface-700'
                }`}>
                  {day}
                </span>
                {count > 0 && (
                  <span className="mt-0.5 text-[9px] font-bold text-primary-600">{count}건</span>
                )}
                {isClosed && (
                  <span className="mt-0.5 text-[8px] font-semibold text-red-400">마감</span>
                )}
                {slot && !isClosed && (
                  <span className="mt-0.5 text-[8px] text-surface-400">{slot.capacity}석</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Editor */}
      {selectedDate && (
        <div className="mx-4 mt-3 mb-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-surface-900">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          </h3>

          <div className="mt-3 space-y-3">
            {/* Capacity */}
            <label className="block">
              <span className="text-xs font-medium text-surface-600">예약 가능 수량</span>
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => setEditCapacity(Math.max(0, editCapacity - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50"
                >
                  -
                </button>
                <input
                  type="number"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)}
                  className="w-16 rounded-lg border border-surface-200 px-2 py-2 text-center text-sm font-bold text-surface-900 outline-none focus:border-primary-400"
                />
                <button
                  onClick={() => setEditCapacity(editCapacity + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50"
                >
                  +
                </button>
              </div>
            </label>

            {/* Close Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-surface-600">마감 처리</span>
              <button
                onClick={() => setEditClosed(!editClosed)}
                className={`relative h-6 w-11 rounded-full transition-colors ${editClosed ? 'bg-red-500' : 'bg-surface-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${editClosed ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Order count info */}
            {(orderCounts[selectedDate] || 0) > 0 && (
              <div className="rounded-lg bg-primary-50 px-3 py-2">
                <p className="text-xs font-medium text-primary-700">
                  📋 이 날짜에 {orderCounts[selectedDate]}건의 주문이 있습니다.
                </p>
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSaveSlot}
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
