'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isInternalHref(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin && url.href !== window.location.href;
  } catch {
    return false;
  }
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pending) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setPending(false), 180);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [pathname, searchParams, pending]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (isModifiedClick(event)) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      if (isInternalHref(anchor.href)) setPending(true);
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      const method = (form.method || 'get').toLowerCase();
      if (method === 'dialog') return;
      setPending(true);
    }

    window.addEventListener('click', handleClick, true);
    window.addEventListener('submit', handleSubmit, true);
    return () => {
      window.removeEventListener('click', handleClick, true);
      window.removeEventListener('submit', handleSubmit, true);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const fallback = window.setTimeout(() => setPending(false), 12000);
    return () => window.clearTimeout(fallback);
  }, [pending]);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999]">
      <div className="h-1 w-full overflow-hidden bg-[#d91e2e]/10">
        <div className="navigation-progress h-full bg-[#d91e2e]" />
      </div>
      <div className="absolute right-4 top-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-semibold text-[#1f252b] shadow-lg">
        Carregando...
      </div>
    </div>
  );
}
