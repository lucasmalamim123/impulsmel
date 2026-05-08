'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ImpulsmelMark } from '../brand/ImpulsmelMark';
import { ThemeToggle } from '../theme/ThemeToggle';

interface Props {
  tenantSlug: string;
  tenantName?: string;
  tenantPlan?: string;
}

const navItems = [
  { label: 'Dashboard', href: 'dashboard' },
  { label: 'Identidade do Bot', href: 'bot' },
  { label: 'Conteudo RAG', href: 'conteudo' },
  { label: 'Testar Bot', href: 'testar' },
  { label: 'Profissionais', href: 'profissionais' },
  { label: 'Servicos', href: 'servicos' },
  { label: 'Horarios', href: 'horarios' },
  { label: 'Integracoes', href: 'integracoes' },
  { label: 'Fila de Erros', href: 'dlq' },
  { label: 'Auditoria', href: 'auditoria' },
];

export function SidebarNav({ tenantSlug, tenantName, tenantPlan }: Props) {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]">
      <div className="border-b border-[var(--dashboard-border)] px-5 pb-5 pt-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="block">
            <ImpulsmelMark />
          </Link>
          <ThemeToggle compact />
        </div>
        <Link href="/dashboard" className="block group">
          <p className="mb-1 text-[11px] text-[var(--dashboard-text-soft)] transition-colors group-hover:text-[var(--dashboard-text-muted)]">
            ← todos os clientes
          </p>
          <p className="truncate text-sm font-semibold text-[var(--dashboard-text)]">{tenantName ?? tenantSlug}</p>
        </Link>
        {tenantPlan && (
          <span className="mt-2 inline-flex items-center rounded-full border border-[#d91e2e]/30 bg-[#d91e2e]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#ff404e]">
            {tenantPlan}
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map(item => {
          const href = `/${tenantSlug}/${item.href}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-[#d91e2e] font-semibold text-white shadow-lg shadow-black/10'
                  : 'text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-surface-strong)] hover:text-[var(--dashboard-text)]'
              }`}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
