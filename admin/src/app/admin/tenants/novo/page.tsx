import { ThemeToggle } from '../../../../components/theme/ThemeToggle';
import { createTenant } from '../actions';

export default function NovoTenantPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="min-h-screen bg-[var(--dashboard-bg)] p-8 text-[var(--dashboard-text)]">
      <div className="mx-auto max-w-md space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <a href="/admin/tenants" className="text-xs text-gray-400 hover:text-gray-600">
              ← Voltar
            </a>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Novo Cliente</h1>
          </div>
          <ThemeToggle />
        </div>

        <form action={createTenant} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nome do studio
            </label>
            <input
              name="name"
              required
              placeholder="Ex: Studio Fit SP"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Slug (URL)
            </label>
            <input
              name="slug"
              required
              placeholder="Ex: studio-fit-sp"
              pattern="[a-z0-9-]+"
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Apenas letras minúsculas, números e hífens.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Plano</label>
            <select
              name="plan"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          {searchParams.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {decodeURIComponent(searchParams.error)}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Criar cliente
          </button>
        </form>
      </div>
    </main>
  );
}
