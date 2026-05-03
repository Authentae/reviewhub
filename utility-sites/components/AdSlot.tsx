'use client';
import { useEffect } from 'react';
import { env } from '@/lib/env';

type Slot = 'header' | 'inContent' | 'sidebar';

declare global {
  interface Window {
    adsbygoogle?: object[];
  }
}

const DEV_MIN_HEIGHTS: Record<Slot, string> = {
  header: 'min-h-[90px]',
  inContent: 'min-h-[280px]',
  sidebar: 'min-h-[600px]',
};

export function AdSlot({ slot, className }: { slot: Slot; className?: string }) {
  const client = env.adsense.clientId();
  const slotId =
    slot === 'header'
      ? env.adsense.slotHeader()
      : slot === 'inContent'
        ? env.adsense.slotInContent()
        : env.adsense.slotSidebar();

  useEffect(() => {
    if (!client || !slotId) return;
    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      /* ignore push errors */
    }
  }, [client, slotId]);

  if (!client || !slotId) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 dark:border-gray-700 dark:bg-gray-900 ${DEV_MIN_HEIGHTS[slot]} ${className ?? ''}`}
        aria-hidden="true"
      >
        Ad placeholder · {slot}
      </div>
    );
  }
  return (
    <ins
      className={`adsbygoogle ${className ?? ''}`}
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slotId}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
