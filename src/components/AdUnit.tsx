import React, { useEffect, useRef } from 'react';

interface AdUnitProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  className?: string;
}

export function AdUnit({ slot, format = 'auto', className = '' }: AdUnitProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!isLoaded.current && adRef.current) {
      try {
        const adsbygoogle = (window as any).adsbygoogle || [];
        adsbygoogle.push({});
        isLoaded.current = true;
      } catch (error) {
        console.error('Error loading ad:', error);
      }
    }
  }, []);

  return (
    <div className={`ad-container ${className}`} ref={adRef}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-5301414262654683"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}