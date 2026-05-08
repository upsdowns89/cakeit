'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';
import { CakeIcon, CakeSliceIcon, ChefHatIcon } from '@/components/icons';

type SignupStep = 'form' | 'verify';

export default function SignUpPage() {
  const router = useRouter();

  const [step, setStep] = useState<SignupStep>('form');
  const [role, setRole] = useState<UserRole>('buyer');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Step 1: Send OTP to email (signUp creates user + sends OTP)
  const handleSendOtp = async () => {
    setError('');

    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    setOtpSending(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname, role },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('이미 가입된 이메일입니다.');
        } else {
          setError(signUpError.message);
        }
        setOtpSending(false);
        return;
      }

      setOtpSent(true);
      setSuccess('인증 코드가 이메일로 전송되었습니다. 이메일을 확인해주세요.');
      setStep('verify');
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setOtpSending(false);
    }
  };

  // Step 2: Verify OTP and complete signup
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });

      if (verifyError) {
        if (verifyError.message.includes('expired')) {
          setError('인증 코드가 만료되었습니다. 다시 전송해주세요.');
        } else if (verifyError.message.includes('invalid')) {
          setError('잘못된 인증 코드입니다. 다시 확인해주세요.');
        } else {
          setError(verifyError.message);
        }
        setLoading(false);
        return;
      }

      if (!verifyData.user) {
        setError('인증에 실패했습니다.');
        setLoading(false);
        return;
      }

      // Create profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: verifyData.user.id,
        email,
        nickname,
        role,
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }

      // Redirect based on role
      if (role === 'seller') {
        router.push('/seller/register');
      } else {
        router.push('/');
      }
      router.refresh();
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setError('');
    setOtpSending(true);

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (resendError) {
        setError(resendError.message);
      } else {
        setSuccess('인증 코드가 재전송되었습니다.');
      }
    } catch {
      setError('재전송에 실패했습니다.');
    } finally {
      setOtpSending(false);
    }
  };

  // Kakao OAuth signup
  const handleKakaoSignup = async () => {
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?role=${role}`,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch {
      setError('카카오 연결에 실패했습니다.');
      setLoading(false);
    }
  };

  // Form submit handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSendOtp();
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
            EveryCake 회원가입
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            케이크의 모든 것, 지금 시작하세요
          </p>
        </div>

        {step === 'form' && (
          <>
            {/* Role Selection */}
            <div className="mb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setRole('buyer')}
                className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all ${
                  role === 'buyer'
                    ? 'border-primary-400 bg-primary-50 shadow-md shadow-primary-100'
                    : 'border-surface-200 bg-white hover:border-surface-300'
                }`}
              >
                <CakeSliceIcon className={`h-6 w-6 ${role === 'buyer' ? 'text-primary-600' : 'text-surface-400'}`} />
                <div>
                  <p className={`text-sm font-semibold ${role === 'buyer' ? 'text-primary-700' : 'text-surface-700'}`}>
                    소비자
                  </p>
                  <p className="text-xs text-surface-500">케이크를 주문해요</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRole('seller')}
                className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all ${
                  role === 'seller'
                    ? 'border-primary-400 bg-primary-50 shadow-md shadow-primary-100'
                    : 'border-surface-200 bg-white hover:border-surface-300'
                }`}
              >
                <ChefHatIcon className={`h-6 w-6 ${role === 'seller' ? 'text-primary-600' : 'text-surface-400'}`} />
                <div>
                  <p className={`text-sm font-semibold ${role === 'seller' ? 'text-primary-700' : 'text-surface-700'}`}>
                    판매자
                  </p>
                  <p className="text-xs text-surface-500">케이크를 판매해요</p>
                </div>
              </button>
            </div>

            {/* Kakao Signup Button */}
            <button
              type="button"
              onClick={handleKakaoSignup}
              disabled={loading}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: '#FEE500', color: '#191919' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M9 0.6C4.02944 0.6 0 3.71379 0 7.55262C0 9.94002 1.5584 12.0451 3.93152 13.2968L2.93304 16.8447C2.84603 17.1393 3.18747 17.3755 3.44643 17.2038L7.56302 14.3969C8.03024 14.4502 8.51058 14.5052 9 14.5052C13.9706 14.5052 18 11.3914 18 7.55262C18 3.71379 13.9706 0.6 9 0.6Z"
                  fill="#191919"
                />
              </svg>
              카카오로 시작하기
            </button>

            <div className="relative flex items-center py-2 mb-4">
              <div className="flex-grow border-t border-surface-200" />
              <span className="px-4 text-xs text-surface-400">또는 이메일로 가입</span>
              <div className="flex-grow border-t border-surface-200" />
            </div>

            {/* Sign Up Form */}
            <form
              onSubmit={handleFormSubmit}
              className="space-y-4 rounded-2xl border border-surface-200 bg-white p-6 shadow-sm"
            >
              {error && (
                <div className="animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-surface-700">
                  이메일 (아이디) <span className="text-danger">*</span>
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
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-surface-700">
                  비밀번호 <span className="text-danger">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="6자 이상 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-surface-700">
                  비밀번호 확인 <span className="text-danger">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div>
                <label htmlFor="nickname" className="mb-1.5 block text-sm font-medium text-surface-700">
                  닉네임 <span className="text-danger">*</span>
                </label>
                <input
                  id="nickname"
                  type="text"
                  placeholder="닉네임을 입력하세요"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <button
                type="submit"
                disabled={otpSending}
                className="w-full rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:shadow-xl hover:shadow-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {otpSending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    인증 코드 전송 중...
                  </span>
                ) : (
                  '인증 코드 전송'
                )}
              </button>

              <p className="text-center text-sm text-surface-500">
                이미 계정이 있으신가요?{' '}
                <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
                  로그인
                </Link>
              </p>
            </form>
          </>
        )}

        {step === 'verify' && (
          <form
            onSubmit={handleVerifyOtp}
            className="space-y-4 rounded-2xl border border-surface-200 bg-white p-6 shadow-sm"
          >
            {error && (
              <div className="animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            {success && (
              <div className="animate-fade-in rounded-xl bg-green-50 px-4 py-3 text-sm text-success">
                {success}
              </div>
            )}

            {/* Email display */}
            <div className="rounded-xl bg-surface-50 px-4 py-3">
              <p className="text-xs text-surface-500">인증 이메일</p>
              <p className="mt-0.5 text-sm font-medium text-surface-900">{email}</p>
            </div>

            {/* OTP Code Input */}
            <div>
              <label htmlFor="otpCode" className="mb-1.5 block text-sm font-medium text-surface-700">
                인증 코드 <span className="text-danger">*</span>
              </label>
              <input
                id="otpCode"
                type="text"
                inputMode="numeric"
                placeholder="6자리 인증 코드를 입력하세요"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                maxLength={6}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-center text-lg font-bold tracking-[0.5em] text-surface-900 placeholder:text-surface-400 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            {/* Resend Button */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpSending}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
              >
                {otpSending ? '전송 중...' : '인증 코드 재전송'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('form'); setOtpSent(false); setError(''); setSuccess(''); }}
                className="text-sm text-surface-500 hover:text-surface-700"
              >
                이전 단계로
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:shadow-xl hover:shadow-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  가입 완료 중...
                </span>
              ) : (
                '가입 완료'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
