import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import BottomTabBar from '@/components/BottomTabBar';
import SupabasePrewarm from '@/components/SupabasePrewarm';

export const metadata: Metadata = {
  title: 'EveryCake - 내 근처 맛있는 케이크를 찾아보세요',
  description:
    '동네 케이크 가게를 한눈에! 특별한 날을 위한 케이크를 쉽게 주문하세요. 케이크 판매자와 소비자를 연결하는 플랫폼.',
  keywords: ['케이크', '주문', '베이커리', '디저트', '케이크 배달', '맞춤 케이크'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-theme="light" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script
          type="text/javascript"
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || ''}&autoload=false`}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-screen bg-white antialiased" suppressHydrationWarning>
        <SupabasePrewarm />
        <Navbar />
        <main>{children}</main>
        <BottomTabBar />
      </body>
    </html>
  );
}
