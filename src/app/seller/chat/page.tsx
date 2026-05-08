'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient, createDataClient } from '@/lib/supabase/client';
import type { Order, MessageWithSender } from '@/lib/types';
import { ORDER_STATUS_MAP } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { ChatBubbleIcon, CakeIcon, ChevronRightIcon } from '@/components/icons';

interface ChatThread {
  order_id: string;
  buyer_nickname: string;
  buyer_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  order_status: string;
}

export default function SellerChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let client: ReturnType<typeof createClient> | null = null;
    try { client = createClient(); } catch { setLoading(false); return; }

    async function init() {
      if (!client) return;
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const dataClient = createDataClient();
      const { data: shopData } = await dataClient
        .from('shops').select('id').eq('owner_id', user.id).limit(1).single();
      if (!shopData) { setLoading(false); return; }
      setShopId((shopData as any).id);

      await fetchThreads((shopData as any).id);
      setLoading(false);
    }
    init();

    // Realtime for new messages
    const channel = client
      .channel('seller-chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          if (shopId) fetchThreads(shopId);
          if (selectedOrderId) fetchMessages(selectedOrderId);
        }
      )
      .subscribe();

    const supabaseRef = client;
    return () => { supabaseRef.removeChannel(channel); };
  }, []);

  const fetchThreads = async (sid: string) => {
    const dataClient = createDataClient();
    // Get all orders with messages for this shop
    const { data: orders } = await dataClient
      .from('orders')
      .select('id, status, buyer_id, profiles!orders_buyer_id_fkey(nickname, avatar_url)')
      .eq('shop_id', sid)
      .order('created_at', { ascending: false });

    if (!orders) return;

    const threadList: ChatThread[] = [];
    for (const order of (orders as any[])) {
      const { data: msgs } = await dataClient
        .from('messages')
        .select('content, created_at, is_read, sender_id')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (msgs && (msgs as any[]).length > 0) {
        const profile = (order as Record<string, unknown>).profiles as { nickname: string; avatar_url: string | null } | null;
        const unreadMsgs = await dataClient
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('order_id', order.id)
          .eq('is_read', false)
          .neq('sender_id', userId || '');

        threadList.push({
          order_id: order.id,
          buyer_nickname: profile?.nickname || '고객',
          buyer_avatar: profile?.avatar_url || null,
          last_message: (msgs as any[])[0].content,
          last_message_at: (msgs as any[])[0].created_at,
          unread_count: unreadMsgs.count || 0,
          order_status: order.status,
        });
      }
    }

    threadList.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    setThreads(threadList);
  };

  const fetchMessages = async (orderId: string) => {
    const dataClient = createDataClient();
    const { data } = await dataClient
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(nickname, avatar_url)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    setMessages((data as MessageWithSender[]) || []);

    // Fetch order details for sidebar
    const { data: orderData } = await dataClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    setSelectedOrder(orderData ? (orderData as unknown as Order) : null);

    // Mark messages as read
    if (userId) {
      await (dataClient as any)
        .from('messages')
        .update({ is_read: true })
        .eq('order_id', orderId)
        .neq('sender_id', userId);
    }

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSelectThread = (orderId: string) => {
    setSelectedOrderId(orderId);
    fetchMessages(orderId);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedOrderId || !userId) return;
    setSending(true);

    try {
      const dataClient = createDataClient();
      await (dataClient as any).from('messages').insert({
        order_id: selectedOrderId,
        sender_id: userId,
        content: newMessage.trim(),
      });
      setNewMessage('');
      await fetchMessages(selectedOrderId);
    } catch (err) {
      console.error('Message send failed:', err);
    }
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '방금';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="h-6 w-32 animate-shimmer rounded-lg" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Chat detail view
  if (selectedOrderId) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-50">
        {/* Chat Header */}
        <div className="section-header-sticky">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedOrderId(null); setMessages([]); }}
              className="text-sm font-medium text-primary-600"
            >
              ← 목록
            </button>
            <div className="flex-1">
              <p className="text-sm font-bold text-surface-900">
                {threads.find((t) => t.order_id === selectedOrderId)?.buyer_nickname || '고객'}
              </p>
            </div>
            <Link
              href={`/seller/orders/${selectedOrderId}`}
              className="rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-100"
            >
              주문서 보기
            </Link>
          </div>
        </div>

        {/* Order Summary Sidebar (collapsed on mobile, shown as bar) */}
        {selectedOrder && (
          <div className="section-panel py-2 border-b" style={{ borderColor: 'var(--color-surface-200)' }}>
            <Link href={`/seller/orders/${selectedOrderId}`} className="flex items-center gap-2">
              <CakeIcon className="h-4 w-4 text-primary-500" />
              <span className="text-xs font-medium text-primary-700">
                {[selectedOrder.cake_size, selectedOrder.cake_flavor, selectedOrder.cream_type].filter(Boolean).join(' · ') || '옵션 미지정'}
              </span>
              {selectedOrder.total_price && (
                <span className="ml-auto text-xs font-bold text-primary-700">
                  ₩{selectedOrder.total_price.toLocaleString()}
                </span>
              )}
              <StatusBadge status={selectedOrder.status} />
            </Link>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ChatBubbleIcon className="mb-2 h-8 w-8 text-surface-300" />
              <p className="text-sm text-surface-400">아직 메시지가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMe = msg.sender_id === userId;
                const isSystem = msg.content.startsWith('[시스템]');
                return (
                  <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isMe ? 'justify-end' : 'justify-start'}`}>
                    {isSystem ? (
                      <div className="rounded-full bg-surface-100 px-3 py-1">
                        <p className="text-[11px] text-surface-400">{msg.content.replace('[시스템] ', '')}</p>
                      </div>
                    ) : (
                      <div className={`max-w-[75%] ${isMe ? 'order-2' : ''}`}>
                        {!isMe && (
                          <p className="mb-0.5 text-[10px] font-medium text-surface-400">
                            {msg.profiles?.nickname || '고객'}
                          </p>
                        )}
                        <div className={`rounded-2xl px-3 py-2 ${
                          isMe
                            ? 'chat-bubble-mine'
                            : 'chat-bubble-other'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <p className={`mt-0.5 text-[10px] text-surface-300 ${isMe ? 'text-right' : ''}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="action-bar bottom-16">
          <div className="flex items-center gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="메시지를 입력하세요..."
              className="flex-1 rounded-full border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm outline-none focus:border-primary-400"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white transition-all hover:bg-primary-600 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Thread List View
  return (
    <div className="page-container">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <ChatBubbleIcon className="h-5 w-5 text-primary-500" />
          <h1 className="text-lg font-bold text-surface-900">채팅</h1>
        </div>
      </div>

      <div className="px-4 py-4">
        {threads.length === 0 ? (
          <div className="card-empty-state">
            <ChatBubbleIcon className="mb-2 h-8 w-8 text-surface-300" />
            <p className="text-sm font-medium text-surface-500">채팅 내역이 없습니다</p>
            <p className="mt-0.5 text-xs text-surface-400">고객이 메시지를 보내면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <button
                key={thread.order_id}
                onClick={() => handleSelectThread(thread.order_id)}
                className="card-interactive w-full text-left"
              >
                {/* Avatar */}
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {thread.buyer_nickname.charAt(0)}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-surface-900">{thread.buyer_nickname}</span>
                    <StatusBadge status={thread.order_status as import('@/lib/types').OrderStatus} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-surface-400">{thread.last_message}</p>
                </div>
                {/* Time & unread */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-surface-300">{formatTime(thread.last_message_at)}</span>
                  {thread.unread_count > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-white">
                      {thread.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
