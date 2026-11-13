import React, { useEffect, useRef } from 'react';

interface AdUnitProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  className?: string;
  responsive?: boolean;
}

export function AdUnit({
  slot,
  format = 'auto',
  className = '',
  responsive = true,
}: AdUnitProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    // Only attempt to push ad once per mounted component instance
    if (!pushedRef.current && adRef.current) {
      try {
        const win = window as unknown as { adsbygoogle?: unknown[] };
        const adsbygoogle = win.adsbygoogle || [];
        adsbygoogle.push({});
        pushedRef.current = true;
      } catch (error) {
        // Suppress expected adsbygoogle errors in local dev or when blocked by extensions
        console.debug('AdSense unit notice:', error);
      }
    }
  }, []);

  return (
    <div className={`ad-wrapper my-6 text-center overflow-hidden ${className}`}>
      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium block mb-1">
        Advertisement
      </span>
      <div
        ref={adRef}
        className="ad-container mx-auto flex justify-center items-center bg-gray-50/70 border border-dashed border-gray-200 rounded min-h-[90px]"
      >
        <ins
          className="adsbygoogle"
          style={{ display: 'block', minWidth: '250px' }}
          data-ad-client="ca-pub-5301414262654683"
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive={responsive ? 'true' : 'false'}
        />
      </div>
    </div>
  );
}
