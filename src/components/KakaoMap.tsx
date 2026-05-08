'use client';

import { useEffect, useRef } from 'react';
import type { Shop } from '@/lib/types';

declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoMapProps {
  shops: Shop[];
  className?: string;
}

export default function KakaoMap({ shops, className = '' }: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (typeof window === 'undefined' || !window.kakao?.maps) {
      // SDK not loaded yet — wait for it
      const checkInterval = setInterval(() => {
        if (window.kakao?.maps) {
          clearInterval(checkInterval);
          window.kakao.maps.load(() => initMap());
        }
      }, 200);
      return () => clearInterval(checkInterval);
    } else {
      window.kakao.maps.load(() => initMap());
    }

    function initMap() {
      if (!mapRef.current) return;

      const defaultCenter = new window.kakao.maps.LatLng(37.5665, 126.978);
      const options = {
        center: defaultCenter,
        level: 7,
      };

      const map = new window.kakao.maps.Map(mapRef.current, options);
      mapInstanceRef.current = map;

      updateMarkers(map);
    }
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) {
      updateMarkers(mapInstanceRef.current);
    }
  }, [shops]);

  function updateMarkers(map: any) {
    // Clear existing markers by re-creating overlay handling
    const bounds = new window.kakao.maps.LatLngBounds();
    let hasValidCoords = false;

    shops.forEach((shop) => {
      if (!shop.lat || !shop.lng) return;
      hasValidCoords = true;

      const position = new window.kakao.maps.LatLng(shop.lat, shop.lng);
      bounds.extend(position);

      const marker = new window.kakao.maps.Marker({
        map,
        position,
        title: shop.name,
      });

      const infoContent = `
        <div style="padding:8px 12px;min-width:180px;font-family:Pretendard,sans-serif;">
          <a href="/shop/${shop.id}" style="text-decoration:none;color:inherit;">
            <p style="font-size:14px;font-weight:700;margin:0 0 4px;color:#1A1A1A;">${shop.name}</p>
            <p style="font-size:12px;color:#757575;margin:0 0 4px;">${shop.address || ''}</p>
            ${shop.min_order_price ? `<p style="font-size:12px;color:#FF5C8D;font-weight:600;margin:0;">₩${shop.min_order_price.toLocaleString()}~</p>` : ''}
          </a>
        </div>
      `;

      const infowindow = new window.kakao.maps.InfoWindow({
        content: infoContent,
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        infowindow.open(map, marker);
      });
    });

    if (hasValidCoords) {
      map.setBounds(bounds);
    }
  }

  return (
    <div ref={mapRef} className={`w-full ${className}`} style={{ minHeight: '400px' }} />
  );
}
