'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient, createDataClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';
import { UserCircleIcon, ArrowRightOnRectangleIcon, StorefrontIcon, CakeIcon } from '@/components/icons';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const dataClient = createDataClient();
      const { data } = await dataClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }, []);

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
    } = client.auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
      }
    });

    const timeout = setTimeout(() => setLoading(false), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [fetchProfile]);

  const handleSignOut = async () => {
    try {
      const client = createClient();
      await client.auth.signOut();
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return '관리자';
      case 'seller': return '판매자';
      default: return '소비자';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-surface-100 to-surface-200">
          <UserCircleIcon className="h-10 w-10 text-surface-400" />
        </div>
        <h1 className="text-xl font-bold text-surface-900">로그인이 필요해요</h1>
        <p className="mt-2 text-sm text-surface-500">
          로그인하고 다양한 서비스를 이용해보세요
        </p>
        <Link
          href="/login"
          className="mt-6 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
        >
          로그인하기
        </Link>
        <Link
          href="/signup"
          className="mt-3 text-sm font-medium text-primary-600"
        >
          회원가입
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] pb-24">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 px-6 py-8 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <UserCircleIcon className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{profile.nickname}</h1>
            <p className="mt-0.5 text-sm text-primary-100">{profile.email}</p>
            <span className="mt-1 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
              {getRoleLabel(profile.role)}
            </span>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-4 py-4">
        <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
          {(profile.role === 'seller' || profile.role === 'admin') && (
            <Link
              href="/seller/register"
              className="flex items-center gap-3 border-b border-surface-100 px-4 py-3.5 transition-colors hover:bg-surface-50"
            >
              <StorefrontIcon className="h-5 w-5 text-primary-500" />
              <span className="text-sm font-medium text-surface-800">내 가게 관리</span>
            </Link>
          )}
          <Link
            href="/orders"
            className="flex items-center gap-3 border-b border-surface-100 px-4 py-3.5 transition-colors hover:bg-surface-50"
          >
            <CakeIcon className="h-5 w-5 text-primary-500" />
            <span className="text-sm font-medium text-surface-800">주문 내역</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-50"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 text-red-400" />
            <span className="text-sm font-medium text-red-500">로그아웃</span>
          </button>
        </div>
      </div>
    </div>
  );
}
