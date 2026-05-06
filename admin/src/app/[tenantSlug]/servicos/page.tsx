export const dynamic = 'force-dynamic';

import { createAdminClient } from '../../../lib/supabase/admin-client';
import { createServico } from './actions';
import { ServicosClient, type Service } from './ServicosClient';

interface Props { params: { tenantSlug: string } }

export default async function ServicosPage({ params }: Props) {
  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', params.tenantSlug).single();

  const { data: services } = tenant
    ? await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .order('name')
    : { data: [] };

  const create = createServico.bind(null, params.tenantSlug);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Servicos</h1>

      <form action={create} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm">Novo servico</h3>
        <div className="grid grid-cols-2 gap-3">
          <input name="name" required placeholder="Nome do servico" className="border rounded-lg px-3 py-2 text-sm col-span-2" />
          <input name="price" type="number" step="0.01" placeholder="Preco (R$)" className="border rounded-lg px-3 py-2 text-sm" />
          <input name="duration_minutes" type="number" placeholder="Duracao (min)" defaultValue={60} className="border rounded-lg px-3 py-2 text-sm" />
          <select name="scheduling_mode" defaultValue="individual" className="border rounded-lg px-3 py-2 text-sm col-span-2">
            <option value="individual">Individual</option>
            <option value="group">Turma</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="requires_handoff" /> Agendamento exige atendente humano
        </label>
        <button type="submit" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
          Adicionar
        </button>
      </form>

      <ServicosClient tenantSlug={params.tenantSlug} services={((services ?? []) as Service[])} />
    </div>
  );
}
