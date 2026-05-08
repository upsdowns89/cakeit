'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SparklesIcon, SparklesSolidIcon,
  StorefrontIcon, StorefrontSolidIcon,
  LocationIcon, LocationSolidIcon,
  BookmarkIcon, BookmarkSolidIcon,
  UserCircleIcon, ProfileSolidIcon,
} from '@/components/icons';

const tabs = [
  { key: 'home', label: '발견', href: '/', icon: SparklesIcon, iconActive: SparklesSolidIcon },
  { key: 'explore', label: '베이커리', href: '/explore', icon: StorefrontIcon, iconActive: StorefrontSolidIcon },
  { key: 'nearby', label: '주변', href: '/map', icon: LocationIcon, iconActive: LocationSolidIcon },
  { key: 'saved', label: '저장', href: '/saved', icon: BookmarkIcon, iconActive: BookmarkSolidIcon },
  { key: 'mypage', label: '마이페이지', href: '/profile', icon: UserCircleIcon, iconActive: ProfileSolidIcon },
];

export default function BottomTabBar() {
  const pathname = usePathname();

  // Hide tab bar on certain pages
  const hiddenPaths = ['/login', '/signup', '/auth', '/seller', '/shop/', '/explore/category/'];
  const shouldHide = hiddenPaths.some((path) => pathname.startsWith(path));
  if (shouldHide) return null;

  return (
    <nav id="bottom-nav-bar" className="sticky bottom-0 z-50 border-t border-surface-200/60 bg-white safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const isActive =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href);
          const Icon = isActive ? tab.iconActive : tab.icon;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors ${
                isActive
                  ? 'text-primary-500'
                  : 'text-surface-400 active:text-surface-600'
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center">
                <Icon className="h-6 w-6" />
              </div>
              <span className={`text-[11px] font-medium leading-tight ${isActive ? 'font-semibold text-primary-500' : 'text-surface-400'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
