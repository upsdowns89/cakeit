'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { UserRole } from '@/lib/types';

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const nickname = formData.get('nickname') as string;
  const role = formData.get('role') as UserRole;

  // 1. Sign up with Supabase Auth (sends OTP email)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname,
        role,
      },
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: '회원가입에 실패했습니다.' };
  }

  return { success: true, message: '인증 코드가 이메일로 전송되었습니다.' };
}

export async function verifyOtpAndCreateProfile(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const token = formData.get('token') as string;
  const nickname = formData.get('nickname') as string;
  const role = formData.get('role') as UserRole;

  // Verify OTP
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });

  if (verifyError) {
    return { error: verifyError.message };
  }

  if (!verifyData.user) {
    return { error: '인증에 실패했습니다.' };
  }

  // Create profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: verifyData.user.id,
    email,
    nickname,
    role,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  // Redirect based on role
  if (role === 'seller') {
    redirect('/seller/register');
  } else {
    redirect('/');
  }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const redirectTo = (formData.get('redirect') as string) || null;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Get user profile to determine redirect
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인에 실패했습니다.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (redirectTo) {
    redirect(redirectTo);
  }

  if (profile?.role === 'seller') {
    redirect('/seller');
  } else {
    redirect('/');
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}
