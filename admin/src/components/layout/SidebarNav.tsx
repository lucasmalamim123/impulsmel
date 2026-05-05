'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ImpulsmelMark } from '../brand/ImpulsmelMark';

interface Props {
  tenantSlug: string;
  tenantName?: string;
  tenantPlan?: string;
}

const navItems = [
  { label: 'Dashboard', href: 'dashboard', key: 'D' },
  { label: 'Identidade do Bot', href: 'bot', key: 'I' },
  { label: 'Testar Bot', href: 'testar', key: 'T' },
  { label: 'Profissionais', href: 'profissionais', key: 'P' },
  { label: 'Serviços', href: 'servicos', key: 'S' },
  { label: 'Horários', href: 'horarios', key: 'H' },
  { label: 'Integrações', href: 'integracoes', key: 'N' },
  { label: 'Fila de Erros', href: 'dlq', key: 'F' },
  { label: 'Auditoria', href: 'auditoria', key: 'A' },
];

export function SidebarNav({ tenantSlug, tenantName, tenantPlan }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#1f252b] flex flex-col min-h-screen shrink-0">
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <Link href="/dashboard" className="block group">
          <ImpulsmelMark inverted />
          <p className="mt-5 text-[11px] text-white/40 group-hover:text-white/70 transition-colors mb-1">
            ← todos os clientes
          </p>
          <p className="text-sm font-semibold text-white truncate">
            {tenantName ?? tenantSlug}
          </p>
        </Link>
        {tenantPlan && (
          <span className="mt-2 inline-flex items-center text-[10px] font-bold uppercase bg-[#d91e2e]/15 text-white px-2 py-0.5 rounded-full border border-[#d91e2e]/30">
            {tenantPlan}
          </span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const href = `/${tenantSlug}/${item.href}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[#d91e2e] text-white font-semibold shadow-lg shadow-black/10'
                  : 'text-white/55 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
              <kbd className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                active
                  ? 'border-white/25 text-white/70 bg-white/10'
                  : 'border-white/10 text-white/25'
              }`}>
                {item.key}
              </kbd>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-5 pt-3 border-t border-white/10 space-y-1">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-white/35 hover:bg-white/8 hover:text-white/70 transition-colors">
          <span>Buscar</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10">Ctrl K</kbd>
        </button>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-white/35 hover:bg-white/8 hover:text-white/70 transition-colors">
          <span>Reconectar WA</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10">R</kbd>
        </button>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-white/35 hover:bg-white/8 hover:text-white/70 transition-colors">
          <span>Nova ação</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10">N</kbd>
        </button>
      </div>
    </aside>
  );
}
