'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  MagnifyingGlassIcon,
  BookmarkIcon,
} from '@/components/icons';

/* ─── Route → Title map ─── */
const ROUTE_TITLES: Record<string, string> = {
  '/explore': '베이커리',
  '/map': '주변',
  '/saved': '저장',
  '/profile': '마이페이지',
  '/search': '검색',
  '/orders': '주문 내역',
};

function getPageTitle(pathname: string): string | null {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  for (const [route, title] of Object.entries(ROUTE_TITLES)) {
    if (pathname.startsWith(route)) return title;
  }
  return null;
}

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const pageTitle = getPageTitle(pathname);

  // Hide navbar on certain pages that have their own headers
  const hiddenPaths = ['/login', '/signup', '/auth', '/seller', '/shop/', '/saved', '/explore/category/'];
  const shouldHide = hiddenPaths.some((path) => pathname.startsWith(path));
  if (shouldHide) return null;

  return (
    <nav id="top-nav-bar" className="sticky top-0 z-50 bg-white">
      <div className="flex h-[52px] items-center justify-between px-5">
        {/* Left: Logo (home) or Page Title (other) */}
        {isHome ? (
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-everycake.svg"
              alt="EveryCake"
              width={97}
              height={20}
              priority
            />
          </Link>
        ) : (
          <h1 className="text-lg font-bold text-surface-900">
            {pageTitle || 'EveryCake'}
          </h1>
        )}

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
