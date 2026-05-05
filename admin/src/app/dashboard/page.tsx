import Link from 'next/link';
import { ImpulsmelMark } from '../../components/brand/ImpulsmelMark';
import { createAdminClient } from '../../lib/supabase/admin-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createAdminClient();
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, active')
    .order('name');

  const list = (tenants ?? []) as { id: string; name: string; slug: string; plan: string; active: boolean }[];

  return (
    <div className="min-h-screen bg-[#1f252b] flex flex-col">
      <header className="px-8 py-5 border-b border-white/10 flex items-center justify-between">
        <ImpulsmelMark inverted />
        <Link href="/admin/tenants/novo" className="brand-button">
          + Novo cliente
        </Link>
      </header>

      <main className="flex-1 px-8 py-10 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase text-[#d91e2e] mb-1">Operação</p>
            <h1 className="font-display text-2xl font-bold text-white">Clientes</h1>
          </div>
          <Link href="/admin/tenants" className="text-xs font-semibold text-white/50 hover:text-white transition-colors">
            Gerenciar →
          </Link>
        </div>

        <div className="space-y-2">
          {list.map(t => (
            <Link
              key={t.id}
              href={`/${t.slug}/dashboard`}
              className="flex items-center justify-between bg-white hover:bg-[#f3f4f6] border border-white/10 rounded-lg px-5 py-4 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-[#d91e2e] flex items-center justify-center text-white font-bold text-sm">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1f252b]">{t.name}</p>
                  <p className="text-xs text-[#6b7280]">{t.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  t.active ? 'bg-[#d91e2e]/10 text-[#d91e2e]' : 'bg-[#f3f4f6] text-[#6b7280]'
                }`}>
                  {t.active ? 'Ativo' : 'Inativo'}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#1f252b] text-white">
                  {t.plan ?? 'basic'}
                </span>
                <span className="text-[#6b7280] group-hover:text-[#d91e2e] transition-colors">→</span>
              </div>
            </Link>
          ))}

          {list.length === 0 && (
            <div className="text-center py-16">
              <p className="text-white/45 text-sm">Nenhum cliente cadastrado ainda.</p>
              <Link href="/admin/tenants/novo" className="brand-button mt-4">
                Criar primeiro cliente
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
