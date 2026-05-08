'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CakeIcon } from '@/components/icons';

const TEST_ACCOUNTS = [
  // 셀러 (사장님)
  { email: 'seller1@test.com', label: '달콤한하루 케이크', area: '강남구 역삼동', role: 'seller' as const },
  { email: 'seller2@test.com', label: '슈가베이크', area: '마포구 연남동', role: 'seller' as const },
  { email: 'seller3@test.com', label: '버터플라워 케이크', area: '성동구 성수동', role: 'seller' as const },
  { email: 'seller4@test.com', label: '크림하우스', area: '송파구 잠실동', role: 'seller' as const },
  { email: 'seller5@test.com', label: '케이크팩토리', area: '성남시 분당구', role: 'seller' as const },
  { email: 'seller6@test.com', label: '봉봉케이크', area: '해운대구 좌동', role: 'seller' as const },
  { email: 'seller7@test.com', label: '르빵빵', area: '종로구 삼청동', role: 'seller' as const },
  { email: 'seller8@test.com', label: '마카롱앤 케이크', area: '유성구 봉명동', role: 'seller' as const },
  { email: 'seller9@test.com', label: '도레미케이크', area: '남동구 구월동', role: 'seller' as const },
  { email: 'seller10@test.com', label: '해피에이프릴', area: '제주시 노형동', role: 'seller' as const },
  // 소비자
  { email: 'buyer1@test.com', label: '케이크러버', area: '이하은', role: 'buyer' as const },
  { email: 'buyer2@test.com', label: '달달구리', area: '박서준', role: 'buyer' as const },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const [testLoginIdx, setTestLoginIdx] = useState<number | null>(null);

  const redirectTo = searchParams.get('redirect');
  const authError = searchParams.get('error');

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (signInError) {
      if (signInError.message === 'Invalid login credentials') {
        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (signInError.message.includes('Email not confirmed')) {
        throw new Error('이메일 인증이 완료되지 않았습니다.');
      } else {
        throw new Error(signInError.message);
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인에 실패했습니다.');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (redirectTo) {
      router.push(redirectTo);
    } else if (profile?.role === 'seller') {
      router.push('/seller');
    } else {
      router.push('/');
    }
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await doLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogin = async (idx: number) => {
    setError('');
    setTestLoginIdx(idx);

    try {
      await doLogin(TEST_ACCOUNTS[idx].email, 'test1234');
    } catch (err) {
      setError(err instanceof Error ? err.message : '테스트 로그인에 실패했습니다.');
    } finally {
      setTestLoginIdx(null);
    }
  };

  const handleKakaoLogin = async () => {
    setError('');
    setKakaoLoading(true);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setKakaoLoading(false);
      }
    } catch {
      setError('카카오 로그인에 실패했습니다.');
      setKakaoLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-200">
            <CakeIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-2 text-2xl font-bold text-surface-900">
            다시 오셨군요!
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            계정에 로그인하여 계속하세요
          </p>
        </div>

        {/* Auth error from callback */}
        {authError && (
          <div className="mb-4 animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
            인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.
          </div>
        )}

        {/* Kakao Login Button */}
        <button
          type="button"
          onClick={handleKakaoLogin}
          disabled={kakaoLoading}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: '#FEE500', color: '#191919' }}
        >
          {kakaoLoading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              연결 중...
            </span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M9 0.6C4.02944 0.6 0 3.71379 0 7.55262C0 9.94002 1.5584 12.0451 3.93152 13.2968L2.93304 16.8447C2.84603 17.1393 3.18747 17.3755 3.44643 17.2038L7.56302 14.3969C8.03024 14.4502 8.51058 14.5052 9 14.5052C13.9706 14.5052 18 11.3914 18 7.55262C18 3.71379 13.9706 0.6 9 0.6Z"
                  fill="#191919"
                />
              </svg>
              카카오로 로그인
            </>
          )}
        </button>

        <div className="relative flex items-center py-2 mb-4">
          <div className="flex-grow border-t border-surface-200" />
          <span className="px-4 text-xs text-surface-400">또는 이메일로 로그인</span>
          <div className="flex-grow border-t border-surface-200" />
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-surface-200 bg-white p-6 shadow-sm"
        >
          {error && (
            <div className="animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-surface-700"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              placeholder="hello@everycake.kr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-surface-700"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:shadow-xl hover:shadow-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                로그인 중...
              </span>
            ) : (
              '로그인'
            )}
          </button>

          <p className="text-center text-sm text-surface-500">
            아직 계정이 없으신가요?{' '}
            <Link
              href="/signup"
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              회원가입
            </Link>
          </p>
        </form>

        {/* ─── Test Accounts (개발용) ─── */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowTestAccounts(!showTestAccounts)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-surface-300 px-4 py-3 text-sm text-surface-500 transition-all hover:border-surface-400 hover:text-surface-700 hover:bg-surface-50"
          >
            <span>🧪</span>
            <span>테스트 계정으로 로그인</span>
            <svg
              className={`h-4 w-4 transition-transform ${showTestAccounts ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTestAccounts && (
            <div className="mt-3 rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-surface-50 border-b border-surface-200">
                <p className="text-xs text-surface-500">
                  비밀번호: <code className="px-1.5 py-0.5 bg-surface-100 rounded text-surface-700 font-mono">test1234</code>
                  <span className="mx-2">·</span>
                  클릭하면 바로 로그인됩니다
                </p>
              </div>
              <div className="divide-y divide-surface-100 max-h-80 overflow-y-auto">
                {TEST_ACCOUNTS.map((acc, idx) => {
                  const isBuyer = acc.role === 'buyer';
                  // Show section divider before first buyer
                  const showDivider = isBuyer && idx > 0 && TEST_ACCOUNTS[idx - 1].role === 'seller';
                  return (
                    <div key={acc.email}>
                      {showDivider && (
                        <div className="px-4 py-2 bg-surface-50 border-t border-surface-200">
                          <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">👤 소비자 계정</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTestLogin(idx)}
                        disabled={testLoginIdx !== null}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all hover:bg-primary-50 disabled:opacity-50"
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shrink-0 ${
                          isBuyer
                            ? 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700'
                            : 'bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700'
                        }`}>
                          {isBuyer ? '👤' : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-surface-900 truncate">{acc.label}</p>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              isBuyer
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-primary-50 text-primary-600'
                            }`}>
                              {isBuyer ? '소비자' : '사장님'}
                            </span>
                          </div>
                          <p className="text-xs text-surface-500 truncate">{acc.email} · {acc.area}</p>
                        </div>
                        {testLoginIdx === idx ? (
                          <svg className="h-4 w-4 animate-spin text-primary-500 shrink-0" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 text-surface-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
