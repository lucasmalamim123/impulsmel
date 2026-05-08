'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme !== 'light' : true;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`inline-flex items-center justify-center rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-control)] text-[var(--dashboard-text)] shadow-sm transition-colors hover:border-[var(--brand-red)] hover:text-[var(--brand-red)] ${
        compact ? 'h-9 w-9' : 'h-12 w-12'
      }`}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {isDark ? <Sun className={compact ? 'h-4 w-4' : 'h-5 w-5'} /> : <Moon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />}
    </button>
  );
}
