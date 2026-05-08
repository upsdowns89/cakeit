'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, createDataClient } from '@/lib/supabase/client';
import type { Profile, Shop } from '@/lib/types';
import SellerBottomTabBar from '@/components/SellerBottomTabBar';
import { CakeIcon } from '@/components/icons';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [shop, setShop] = useState<Shop | null>(null);

  useEffect(() => {
    let client: ReturnType<typeof createClient> | null = null;
    try {
      client = createClient();
    } catch {
      setLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event: string, session: { user: { id: string } } | null) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (!session?.user) {
          router.push('/login');
          return;
        }

        try {
          const dataClient = createDataClient();
          // Check profile role
          const { data: profile } = await dataClient
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

          const p = profile as { role: string } | null;
          if (!p || (p.role !== 'seller' && p.role !== 'admin')) {
            router.push('/');
            return;
          }

          // Get seller's shop
          const { data: shopData } = await dataClient
            .from('shops')
            .select('*')
            .eq('owner_id', session.user.id)
            .limit(1)
            .single();

          setShop(shopData as Shop | null);
          setAuthorized(true);
        } catch (err) {
          console.error('Seller auth check failed:', err);
          router.push('/');
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });

    const timeout = setTimeout(() => setLoading(false), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-primary-100">
            <CakeIcon className="h-6 w-6 text-primary-400" />
          </div>
          <p className="text-sm text-surface-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-6 text-center">
        <div>
          <p className="text-sm text-surface-500">접근 권한이 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {children}
      <SellerBottomTabBar />
    </div>
  );
}
