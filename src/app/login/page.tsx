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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
