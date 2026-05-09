'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  MagnifyingGlassIcon,
} from '@/components/icons';

/* ─── 공통 GNB: 로고 + 검색 (발견탭 기준 통일) ─── */

export default function GNB() {
  const pathname = usePathname();

  // Hide navbar on depth/detail pages that have their own headers
  const hiddenPaths = ['/login', '/signup', '/auth', '/seller', '/shop/', '/explore/category/'];
  const shouldHide = hiddenPaths.some((path) => pathname.startsWith(path));
  if (shouldHide) return null;

  return (
    <nav id="top-nav-bar" className="sticky top-0 z-50 bg-white">
      <div className="flex h-[52px] items-center justify-between px-5">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo-everycake.svg"
            alt="EveryCake"
            width={97}
            height={20}
            priority
          />
        </Link>

        {/* Right: Search icon */}
        <div className="flex items-center gap-4">
          <Link
            href="/search"
            className="flex items-center justify-center text-surface-900"
          >
            <MagnifyingGlassIcon className="h-6 w-6" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
