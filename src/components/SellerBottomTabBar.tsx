'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  ChatBubbleIcon,
  StorefrontIcon,
  PlusIcon,
} from '@/components/icons';

const sellerTabs = [
  { key: 'dashboard', label: '대시보드', href: '/seller', icon: HomeIcon, exact: true },
  { key: 'orders', label: '주문', href: '/seller/orders', icon: ClipboardDocumentListIcon },
  { key: 'schedule', label: '스케줄', href: '/seller/schedule', icon: CalendarIcon },
  { key: 'chat', label: '채팅', href: '/seller/chat', icon: ChatBubbleIcon },
  { key: 'shop', label: '내 스토어', href: '/seller/shop', icon: StorefrontIcon },
];

export default function SellerBottomTabBar() {
  const pathname = usePathname();

  // Hide on the portfolio posting page itself
  if (pathname.startsWith('/seller/portfolio/new')) return null;

  return (
    <>
      {/* ─── Floating '+' Button (inside 480px container) ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
        <div className="w-full max-w-[480px] relative pointer-events-auto">
          <Link
            href="/seller/portfolio/new"
            className="absolute right-4 bottom-0 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-xl shadow-primary-300/40 transition-all hover:scale-105 hover:shadow-2xl active:scale-95"
          >
            <PlusIcon className="h-7 w-7" />
          </Link>
        </div>
      </div>

      {/* ─── Tab Bar (inside 480px container) ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
        <div className="w-full max-w-[480px] border-t border-surface-200 bg-white/95 backdrop-blur-lg safe-area-bottom">
          <div className="flex items-center justify-around">
            {sellerTabs.map((tab) => {
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 transition-colors ${
                    isActive
                      ? 'text-primary-600'
                      : 'text-surface-400 active:text-surface-600'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-primary-600' : ''}`} />
                  <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
