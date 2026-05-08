export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ThemeToggle } from '../../../components/theme/ThemeToggle';
import { createAdminClient } from '../../../lib/supabase/admin-client';
import { toggleTenantActive } from './actions';

export default async function AdminTenantsPage() {
  const supabase = createAdminClient();
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, active, created_at')
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-[var(--dashboard-bg)] p-8 text-[var(--dashboard-text)]">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Superadmin</p>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciar Clientes</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/admin/tenants/novo"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
            >
              + Novo cliente
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Nome</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Slug</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Plano</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Criado em</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(tenants ?? []).map(
                (t: {
                  id: string;
                  name: string;
                  slug: string;
                  plan: string;
                  active: boolean;
                  created_at: string;
                }) => {
                  const toggle = toggleTenantActive.bind(null, t.id, !t.active);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.slug}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
                          {t.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">
                        {new Date(t.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-3">
                        <form action={toggle}>
                          <button
                            type="submit"
                            className={`cursor-pointer rounded-full px-2 py-1 text-xs font-medium ${
                              t.active
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {t.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </form>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/${t.slug}/dashboard`} className="text-xs text-blue-600 hover:underline">
                          Painel →
                        </Link>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>

          {(tenants ?? []).length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">Nenhum cliente cadastrado.</div>
          )}
        </div>
      </div>
    </main>
  );
}
